#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) 2026 Marcus Krueger

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

// ── Default preserve list ────────────────────────────────────────
// Files in .devcontainer that should NOT overwrite user customizations.
// The package version is saved as <file>.codeforge-new for diffing.
// Note: .codeforge/ uses checksum-based preservation instead.
const DEFAULT_PRESERVE = [".codeforge-preserve"];

// ── copyDirectory ────────────────────────────────────────────────
// Simple recursive copy (used for fresh install and --reset).
function copyDirectory(src, dest) {
	if (!fs.existsSync(dest)) {
		fs.mkdirSync(dest, { recursive: true });
	}

	const entries = fs.readdirSync(src, { withFileTypes: true });

	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);

		if (entry.isDirectory()) {
			copyDirectory(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

// ── loadPreserveList ─────────────────────────────────────────────
// Builds the set of relative paths to preserve during --force update.
// Combines built-in defaults with user entries from .codeforge-preserve.
function loadPreserveList(devcontainerDest) {
	const preserveFile = path.join(devcontainerDest, ".codeforge-preserve");
	let custom = [];

	if (fs.existsSync(preserveFile)) {
		custom = fs
			.readFileSync(preserveFile, "utf-8")
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("#"));
	}

	return new Set([...DEFAULT_PRESERVE, ...custom]);
}

// ── computeChecksum ──────────────────────────────────────────────
// Returns SHA-256 hex digest of a file's contents.
function computeChecksum(filePath) {
	if (!fs.existsSync(filePath)) {
		throw new Error(`File not found for checksum: ${filePath}`);
	}
	return crypto
		.createHash("sha256")
		.update(fs.readFileSync(filePath))
		.digest("hex");
}

// ── generateChecksums ────────────────────────────────────────────
// Walks directory recursively, returns { relativePath: sha256hex } map.
// Skips .checksums/ and .markers/ directories.
function generateChecksums(dir) {
	const checksums = {};

	function walk(currentDir, relativeBase) {
		const entries = fs.readdirSync(currentDir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(currentDir, entry.name);
			const relativePath = relativeBase
				? `${relativeBase}/${entry.name}`
				: entry.name;

			if (entry.isDirectory()) {
				if (entry.name === ".checksums" || entry.name === ".markers") {
					continue;
				}
				walk(fullPath, relativePath);
			} else {
				checksums[relativePath] = computeChecksum(fullPath);
			}
		}
	}

	walk(dir, "");
	return checksums;
}

// ── writeChecksums ───────────────────────────────────────────────
// Writes .checksums/<version>.json with version, timestamp, and file hashes.
function writeChecksums(codeforgeDir, version, checksums) {
	const checksumsDir = path.join(codeforgeDir, ".checksums");
	fs.mkdirSync(checksumsDir, { recursive: true });
	const data = {
		version,
		generated: new Date().toISOString(),
		files: checksums,
	};
	fs.writeFileSync(
		path.join(checksumsDir, `${version}.json`),
		JSON.stringify(data, null, "\t") + "\n",
	);
}

function ensureCodeforgeScaffold(codeforgeDir) {
	fs.mkdirSync(path.join(codeforgeDir, ".markers"), { recursive: true });
	fs.mkdirSync(path.join(codeforgeDir, ".checksums"), { recursive: true });
	fs.mkdirSync(path.join(codeforgeDir, "data"), { recursive: true });

	const readme = path.join(codeforgeDir, "README.md");
	if (!fs.existsSync(readme)) {
		fs.writeFileSync(
			readme,
			[
				"# CodeForge Project Overrides",
				"",
				"This directory is intentionally small and user-owned.",
				"",
				"Packaged defaults live in `.devcontainer/defaults/codeforge/`. Put files here only when you want to override a packaged default, add project-local state, or store CodeForge marker files.",
				"",
				"Override files use the same logical path as packaged defaults. For example:",
				"",
				"- `.codeforge/claude/system-prompts/main.md`",
				"- `.codeforge/claude/settings/base.json`",
				"- `.codeforge/file-manifest.json`",
				"",
				"CodeForge may also create marker and audit files under `.codeforge/.markers/`.",
				"",
			].join("\n"),
		);
	}
}

// ── readChecksums ────────────────────────────────────────────────
// Reads latest version's checksums from .checksums/ dir.
// Returns { files: {} } if none found.
function readChecksums(codeforgeDir) {
	const checksumsDir = path.join(codeforgeDir, ".checksums");
	if (!fs.existsSync(checksumsDir)) {
		return { files: {} };
	}

	const files = fs
		.readdirSync(checksumsDir)
		.filter((f) => f.endsWith(".json"))
		.sort((a, b) => {
			const parse = (v) => {
				const m = v.replace(".json", "").match(/^(\d+)\.(\d+)\.(\d+)/);
				return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : [0, 0, 0];
			};
			const pa = parse(a);
			const pb = parse(b);
			for (let i = 0; i < 3; i++) {
				const diff = pa[i] - pb[i];
				if (diff !== 0) return diff;
			}
			return 0;
		});

	if (files.length === 0) {
		return { files: {} };
	}

	const latest = files[files.length - 1];
	try {
		return JSON.parse(
			fs.readFileSync(path.join(checksumsDir, latest), "utf-8"),
		);
	} catch {
		console.log(
			"  Warning: Could not read checksums from " +
				latest +
				", treating as fresh install.",
		);
		return { files: {} };
	}
}

// ── syncCodeforgeDirectory ───────────────────────────────────────
// Checksum-aware sync for .codeforge/ directory.
// Unmodified files get overwritten; modified files are preserved
// and new defaults are written as <file>.default.
function syncCodeforgeDirectory(src, dest) {
	const stored = readChecksums(dest);
	const stats = {
		updated: 0,
		preserved: 0,
		added: 0,
		preservedFiles: [],
		defaultFiles: [],
	};

	function walk(srcDir, destDir, relativeBase) {
		if (!fs.existsSync(destDir)) {
			fs.mkdirSync(destDir, { recursive: true });
		}

		const entries = fs.readdirSync(srcDir, { withFileTypes: true });

		for (const entry of entries) {
			const srcPath = path.join(srcDir, entry.name);
			const destPath = path.join(destDir, entry.name);
			const relativePath = relativeBase
				? `${relativeBase}/${entry.name}`
				: entry.name;

			if (entry.isDirectory()) {
				if (entry.name === ".checksums" || entry.name === ".markers") {
					continue;
				}
				walk(srcPath, destPath, relativePath);
				continue;
			}

			const storedHash = stored.files[relativePath];
			const currentHash = fs.existsSync(destPath)
				? computeChecksum(destPath)
				: null;

			if (!storedHash) {
				// First install or new file
				if (currentHash === null) {
					fs.copyFileSync(srcPath, destPath);
					stats.added++;
				} else {
					// File exists but no stored hash — treat as user-created
					fs.copyFileSync(srcPath, `${destPath}.default`);
					stats.preserved++;
					stats.preservedFiles.push(relativePath);
					stats.defaultFiles.push(relativePath);
				}
			} else if (currentHash === storedHash) {
				// File UNMODIFIED — overwrite with new version
				fs.copyFileSync(srcPath, destPath);
				stats.updated++;
			} else {
				// File USER-MODIFIED — keep user's file, write new as .default
				fs.copyFileSync(srcPath, `${destPath}.default`);
				stats.preserved++;
				stats.preservedFiles.push(relativePath);
				stats.defaultFiles.push(relativePath);
			}
		}
	}

	walk(src, dest, "");
	return stats;
}

// ── syncDirectory ────────────────────────────────────────────────
// Selective overwrite: walks the package tree and copies files to dest.
// - Framework files (scripts, features, plugins): always overwrite
// - Preserved files: skip, save package version as .codeforge-new
// - devcontainer.json: overwrite, save user's as .bak
// - User-created files not in package: untouched (never visited)
function syncDirectory(src, dest, preserveSet) {
	const stats = {
		updated: 0,
		preserved: 0,
		added: 0,
		backedUp: 0,
		preservedFiles: [],
	};

	function walk(srcDir, destDir, relativeBase) {
		if (!fs.existsSync(destDir)) {
			fs.mkdirSync(destDir, { recursive: true });
		}

		const entries = fs.readdirSync(srcDir, { withFileTypes: true });

		for (const entry of entries) {
			const srcPath = path.join(srcDir, entry.name);
			const destPath = path.join(destDir, entry.name);
			const relativePath = relativeBase
				? `${relativeBase}/${entry.name}`
				: entry.name;

			if (entry.isDirectory()) {
				walk(srcPath, destPath, relativePath);
				continue;
			}

			// Special handling for devcontainer.json: overwrite + save .bak
			if (relativePath === "devcontainer.json" && fs.existsSync(destPath)) {
				fs.copyFileSync(destPath, `${destPath}.bak`);
				fs.copyFileSync(srcPath, destPath);
				stats.backedUp++;
				stats.updated++;
				continue;
			}

			// Preserved files: skip overwrite, save package version as .codeforge-new
			if (preserveSet.has(relativePath)) {
				if (fs.existsSync(destPath)) {
					fs.copyFileSync(srcPath, `${destPath}.codeforge-new`);
					stats.preserved++;
					stats.preservedFiles.push(relativePath);
					continue;
				}
				// Preserve-listed but missing at dest — copy and count as new
				fs.copyFileSync(srcPath, destPath);
				stats.added++;
				continue;
			}

			// Framework files: always overwrite (or create if new)
			const isNew = !fs.existsSync(destPath);
			fs.copyFileSync(srcPath, destPath);
			if (isNew) {
				stats.added++;
			} else {
				stats.updated++;
			}
		}
	}

	walk(src, dest, "");
	return stats;
}

// ── main ─────────────────────────────────────────────────────────
function main() {
	const args = process.argv.slice(2);

	// Subcommand: config apply
	if (args[0] === "config" && args[1] === "apply") {
		return configApply();
	}

	const force = args.includes("--force") || args.includes("-f");
	const reset = args.includes("--reset");

	if (args.includes("--help") || args.includes("-h")) {
		console.log("Usage: codeforge [options]");
		console.log("       codeforge config apply");
		console.log("");
		console.log("Options:");
		console.log(
			"  --force, -f     Update existing .devcontainer and .codeforge (preserves user config)",
		);
		console.log(
			"  --reset         Remove .devcontainer customizations and install fresh defaults",
		);
		console.log("                  (.codeforge user modifications preserved)");
		console.log("  --help, -h      Show this help message");
		console.log("");
		console.log("Subcommands:");
		console.log(
			"  config apply    Deploy effective CodeForge defaults plus overrides",
		);
		console.log("");
		console.log(
			"Without flags, installs only if .devcontainer does not exist.",
		);
		process.exit(0);
	}

	const currentDir = process.cwd();
	const packageDir = __dirname;
	const devcontainerSrc = path.join(packageDir, ".devcontainer");
	const devcontainerDest = path.join(currentDir, ".devcontainer");
	const codeforgeDest = path.join(currentDir, ".codeforge");

	console.log("");

	// Check if source .devcontainer exists in the package
	if (!fs.existsSync(devcontainerSrc)) {
		console.error(
			"Error: .devcontainer source directory not found in package.",
		);
		process.exit(1);
	}

	if (fs.existsSync(devcontainerDest)) {
		if (reset) {
			// Nuclear: delete .devcontainer and copy fresh
			console.log("Resetting .devcontainer to package defaults...");
			console.log("");
			fs.rmSync(devcontainerDest, { recursive: true, force: true });
			copyDirectory(devcontainerSrc, devcontainerDest);
			console.log(
				"  Reset complete. All .devcontainer customizations removed.",
			);

			ensureCodeforgeScaffold(codeforgeDest);
			console.log("  .codeforge/ overrides/state scaffold ensured.");

			console.log("");
			printNextSteps();
		} else if (force) {
			// Smart update: selective overwrite with preservation
			console.log("Updating .devcontainer (preserving user config)...");
			console.log("");

			const preserveSet = loadPreserveList(devcontainerDest);
			const stats = syncDirectory(
				devcontainerSrc,
				devcontainerDest,
				preserveSet,
			);

			// Summary
			console.log(`  Updated:   ${stats.updated} files`);
			console.log(`  Added:     ${stats.added} new files`);
			console.log(`  Preserved: ${stats.preserved} user config files`);
			console.log("");

			if (stats.backedUp > 0) {
				console.log(
					"  devcontainer.json updated (previous saved as devcontainer.json.bak)",
				);
				console.log("");
			}

			if (stats.preservedFiles.length > 0) {
				console.log(
					"  Review .codeforge-new files for new defaults you may want to merge:",
				);
				for (const file of stats.preservedFiles) {
					console.log(`    ${file}.codeforge-new`);
				}
				console.log("");
			}

			ensureCodeforgeScaffold(codeforgeDest);
			console.log("  .codeforge/ overrides/state scaffold ensured.");
			console.log("");

			printNextSteps();
		} else {
			// No flags: error with guidance
			console.log(".devcontainer directory already exists.");
			console.log("");
			console.log("  --force   Update (preserves your config files)");
			console.log("  --reset   Start fresh (removes all customizations)");
			console.log("");
			process.exit(1);
		}
	} else {
		// Fresh install
		console.log("Setting up CodeForge DevContainer...");
		console.log("");

		try {
			copyDirectory(devcontainerSrc, devcontainerDest);
			ensureCodeforgeScaffold(codeforgeDest);

			console.log("  CodeForge DevContainer configuration installed!");
			console.log("");
			printNextSteps();
			printFeatures();
		} catch (error) {
			console.error("Error copying .devcontainer:", error.message);
			process.exit(1);
		}
	}
}

// ── configApply ──────────────────────────────────────────────────
// Deploys effective CodeForge defaults plus optional .codeforge/ overrides.
function configApply() {
	const codeforgeDir =
		process.env.CODEFORGE_DIR || path.join(process.cwd(), ".codeforge");
	const workspaceRoot = process.env.WORKSPACE_ROOT || process.cwd();
	const devcontainerDir = path.join(workspaceRoot, ".devcontainer");
	const defaultsRoot = path.join(devcontainerDir, "defaults", "codeforge");
	const generatedRoot = path.join(devcontainerDir, ".generated", "codeforge");
	const defaultManifest = path.join(defaultsRoot, "file-manifest.json");
	const userManifest = path.join(codeforgeDir, "file-manifest.json");

	if (!fs.existsSync(defaultManifest)) {
		console.error(
			"Error: default file-manifest.json not found at " + defaultManifest,
		);
		console.error("Are you in a CodeForge project directory?");
		process.exit(1);
	}

	ensureCodeforgeScaffold(codeforgeDir);

	const generator = path.join(
		devcontainerDir,
		"scripts",
		"generate-settings-profiles.js",
	);
	if (fs.existsSync(generator)) {
		execFileSync(process.execPath, [generator, "--if-stale"], {
			stdio: "inherit",
			env: {
				...process.env,
				WORKSPACE_ROOT: workspaceRoot,
				CODEFORGE_DIR: codeforgeDir,
			},
		});
	}

	const defaultEntries = JSON.parse(fs.readFileSync(defaultManifest, "utf-8"));
	const userEntries = fs.existsSync(userManifest)
		? JSON.parse(fs.readFileSync(userManifest, "utf-8"))
		: [];
	const entries = mergeManifestEntries(defaultEntries, userEntries);
	const claudeConfigDir =
		process.env.CLAUDE_CONFIG_DIR ||
		path.join(process.env.HOME || "/home/vscode", ".claude");

	function expandVars(val) {
		const expanded = val
			.replace(/\$\{CLAUDE_CONFIG_DIR\}/g, claudeConfigDir)
			.replace(/\$\{WORKSPACE_ROOT\}/g, workspaceRoot)
			.replace(/\$\{HOME\}/g, process.env.HOME || "/home/vscode");
		return path.resolve(expanded);
	}

	function isPathWithin(root, candidate) {
		const relative = path.relative(path.resolve(root), path.resolve(candidate));
		return (
			relative === "" ||
			(!relative.startsWith("..") && !path.isAbsolute(relative))
		);
	}

	function resolveSource(src) {
		for (const root of [codeforgeDir, generatedRoot, defaultsRoot]) {
			const candidate = path.resolve(root, src);
			if (!isPathWithin(root, candidate)) {
				continue;
			}
			if (fs.existsSync(candidate)) {
				return candidate;
			}
		}
		return null;
	}

	console.log("");
	console.log("Applying effective CodeForge configuration...");
	console.log("");

	let deployed = 0;
	let skipped = 0;

	const validOverwrite = ["always", "if-changed", "never"];

	for (const entry of entries) {
		if (entry.enabled === false) {
			skipped++;
			continue;
		}

		if (entry.overwrite && !validOverwrite.includes(entry.overwrite)) {
			console.log(
				'  Warning: Unknown overwrite value "' +
					entry.overwrite +
					'" for ' +
					entry.src +
					', defaulting to "always"',
			);
		}

		const srcPath = resolveSource(entry.src);
		if (!srcPath) {
			console.log(
				"  Skip: " +
					entry.src +
					" (not found in overrides, generated output, or defaults)",
			);
			skipped++;
			continue;
		}

		const homeDir = path.resolve(process.env.HOME || "/home/vscode");
		const allowedDestRoots = [
			path.resolve(claudeConfigDir),
			homeDir,
			"/usr/local/share",
		];
		const destDir = path.resolve(expandVars(entry.dest));
		const destAllowed = allowedDestRoots.some(
			(root) => destDir === root || destDir.startsWith(root + path.sep),
		);
		if (!destAllowed) {
			console.log(
				"  Skip: " + entry.dest + " (destination outside allowed directories)",
			);
			skipped++;
			continue;
		}

		const filename = entry.destFilename || path.basename(entry.src);
		const destPath = path.join(destDir, filename);
		fs.mkdirSync(destDir, { recursive: true });

		if (entry.overwrite === "never" && fs.existsSync(destPath)) {
			console.log("  Skip: " + filename + " (exists, overwrite=never)");
			skipped++;
			continue;
		}

		if (entry.overwrite === "if-changed" && fs.existsSync(destPath)) {
			const srcHash = computeChecksum(srcPath);
			const destHash = computeChecksum(destPath);
			if (srcHash === destHash) {
				skipped++;
				continue;
			}
		}

		if (
			entry.id &&
			entry.id.startsWith("claude.settings") &&
			fs.existsSync(destPath) &&
			mergeSettingsFile(srcPath, destPath)
		) {
			console.log("  Deployed: " + entry.src + " → " + destPath + " (merged)");
			deployed++;
		} else {
			fs.copyFileSync(srcPath, destPath);
			console.log("  Deployed: " + entry.src + " → " + destPath);
			deployed++;
		}
	}

	console.log("");
	console.log(
		"Config apply complete: " + deployed + " deployed, " + skipped + " skipped",
	);
}

function mergeSettingsFile(srcPath, destPath) {
	try {
		const src = JSON.parse(fs.readFileSync(srcPath, "utf-8"));
		const dest = JSON.parse(fs.readFileSync(destPath, "utf-8"));

		if (!dest.enabledPlugins) return false;

		// Start with source, overlay user's false values for enabledPlugins
		const merged = { ...src };
		if (!merged.enabledPlugins) merged.enabledPlugins = {};

		for (const [key, value] of Object.entries(dest.enabledPlugins)) {
			if (value === false) {
				merged.enabledPlugins[key] = false;
			}
		}

		fs.writeFileSync(destPath, JSON.stringify(merged, null, 2) + "\n");
		return true;
	} catch {
		return false;
	}
}

function mergeManifestEntries(defaultEntries, userEntries) {
	const byId = new Map();
	for (const entry of [...defaultEntries, ...userEntries]) {
		const id = entry.id || entry.src;
		if (!id) {
			console.warn("Manifest entry missing id/src — skipping");
			continue;
		}
		const previous = byId.get(id) || {};
		const merged = {
			...previous,
			...entry,
			id,
			overwrite: entry.overwrite || previous.overwrite || "if-changed",
		};
		if (entry.disabled === true) {
			merged.enabled = false;
		}
		byId.set(id, merged);
	}
	return [...byId.values()];
}

function printNextSteps() {
	console.log("Next steps:");
	console.log("  1. Open this folder in VS Code");
	console.log('  2. Select "Reopen in Container" from the command palette');
	console.log("  3. Run: claude");
	console.log("");
	console.log("Documentation: .devcontainer/README.md and .codeforge/");
	console.log("");
}

function printFeatures() {
	console.log("Features included:");
	console.log("  - Claude Code CLI with optimized tool configuration");
	console.log("  - MCP servers: Qdrant (vector memory)");
	console.log("  - Development tools: Node.js LTS, Python 3.14, Rust, Bun");
	console.log("  - Persistent configuration and shell history");
	console.log("");
}

if (require.main === module) {
	main();
}

module.exports = {
	copyDirectory,
	syncDirectory,
	syncCodeforgeDirectory,
	loadPreserveList,
	computeChecksum,
	generateChecksums,
	ensureCodeforgeScaffold,
	mergeManifestEntries,
	main,
};
