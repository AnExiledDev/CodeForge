#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) 2026 Marcus Krueger

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

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
			const pa = a.replace(".json", "").split(".").map(Number);
			const pb = b.replace(".json", "").split(".").map(Number);
			for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
				const diff = (pa[i] || 0) - (pb[i] || 0);
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
			if (preserveSet.has(relativePath) && fs.existsSync(destPath)) {
				fs.copyFileSync(srcPath, `${destPath}.codeforge-new`);
				stats.preserved++;
				stats.preservedFiles.push(relativePath);
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
			"  config apply    Deploy .codeforge/config/ files to ~/.claude/",
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
	const codeforgeSrc = path.join(packageDir, ".codeforge");
	const codeforgeDest = path.join(currentDir, ".codeforge");
	const packageVersion = JSON.parse(
		fs.readFileSync(path.join(packageDir, "package.json"), "utf8"),
	).version;

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

			// .codeforge uses checksum-based preservation (not wipe)
			if (fs.existsSync(codeforgeSrc)) {
				if (fs.existsSync(codeforgeDest)) {
					const codeforgeStats = syncCodeforgeDirectory(
						codeforgeSrc,
						codeforgeDest,
					);
					console.log("  .codeforge/ user modifications preserved.");
					console.log(`    Updated:   ${codeforgeStats.updated} files`);
					console.log(`    Added:     ${codeforgeStats.added} new files`);
					console.log(
						`    Preserved: ${codeforgeStats.preserved} user config files`,
					);
					if (codeforgeStats.defaultFiles.length > 0) {
						console.log("");
						console.log(
							"  Review .default files for new defaults you may want to merge:",
						);
						for (const f of codeforgeStats.defaultFiles) {
							console.log(`    ${f}.default`);
						}
					}
				} else {
					copyDirectory(codeforgeSrc, codeforgeDest);
				}
				const newChecksums = generateChecksums(codeforgeSrc);
				writeChecksums(codeforgeDest, packageVersion, newChecksums);
			}

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

			// .codeforge sync with checksum-based preservation
			if (fs.existsSync(codeforgeSrc)) {
				const codeforgeStats = syncCodeforgeDirectory(
					codeforgeSrc,
					codeforgeDest,
				);
				const newChecksums = generateChecksums(codeforgeSrc);
				writeChecksums(codeforgeDest, packageVersion, newChecksums);

				console.log("  .codeforge/ update:");
				console.log(`    Updated:   ${codeforgeStats.updated} files`);
				console.log(`    Added:     ${codeforgeStats.added} new files`);
				console.log(
					`    Preserved: ${codeforgeStats.preserved} user config files`,
				);

				if (codeforgeStats.defaultFiles.length > 0) {
					console.log("");
					console.log(
						"  Review .default files for new defaults you may want to merge:",
					);
					for (const f of codeforgeStats.defaultFiles) {
						console.log(`    ${f}.default`);
					}
				}
				console.log("");
			}

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

			if (fs.existsSync(codeforgeSrc)) {
				copyDirectory(codeforgeSrc, codeforgeDest);
				const checksums = generateChecksums(codeforgeSrc);
				writeChecksums(codeforgeDest, packageVersion, checksums);
			}

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
// Deploys .codeforge/config/ files to ~/.claude/ using file-manifest.json.
function configApply() {
	const codeforgeDir =
		process.env.CODEFORGE_DIR || path.join(process.cwd(), ".codeforge");
	const manifest = path.join(codeforgeDir, "file-manifest.json");

	if (!fs.existsSync(manifest)) {
		console.error("Error: file-manifest.json not found at " + manifest);
		console.error("Are you in a CodeForge project directory?");
		process.exit(1);
	}

	const entries = JSON.parse(fs.readFileSync(manifest, "utf-8"));
	const claudeConfigDir =
		process.env.CLAUDE_CONFIG_DIR ||
		path.join(process.env.HOME || "/home/vscode", ".claude");
	const workspaceRoot = process.env.WORKSPACE_ROOT || process.cwd();

	function expandVars(val) {
		return val
			.replace(/\$\{CLAUDE_CONFIG_DIR\}/g, claudeConfigDir)
			.replace(/\$\{WORKSPACE_ROOT\}/g, workspaceRoot)
			.replace(/\$\{HOME\}/g, process.env.HOME || "/home/vscode");
	}

	console.log("");
	console.log("Applying .codeforge/config/ to Claude configuration...");
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

		const srcPath = path.join(codeforgeDir, entry.src);
		if (!fs.existsSync(srcPath)) {
			console.log("  Skip: " + entry.src + " (not found)");
			skipped++;
			continue;
		}

		const destDir = expandVars(entry.dest);
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

		fs.copyFileSync(srcPath, destPath);
		console.log("  Deployed: " + entry.src + " → " + destPath);
		deployed++;
	}

	console.log("");
	console.log(
		"Config apply complete: " + deployed + " deployed, " + skipped + " skipped",
	);
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
	main,
};
