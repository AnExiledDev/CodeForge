#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// ── Default preserve list ────────────────────────────────────────
// Files in the package that should NOT overwrite user customizations.
// The package version is saved as <file>.codeforge-new for diffing.
const DEFAULT_PRESERVE = [
	"config/defaults/settings.json",
	"config/defaults/main-system-prompt.md",
	"config/defaults/keybindings.json",
	"config/file-manifest.json",
	".codeforge-preserve",
];

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
				? relativeBase + "/" + entry.name
				: entry.name;

			if (entry.isDirectory()) {
				walk(srcPath, destPath, relativePath);
				continue;
			}

			// Special handling for devcontainer.json: overwrite + save .bak
			if (relativePath === "devcontainer.json" && fs.existsSync(destPath)) {
				fs.copyFileSync(destPath, destPath + ".bak");
				fs.copyFileSync(srcPath, destPath);
				stats.backedUp++;
				stats.updated++;
				continue;
			}

			// Preserved files: skip overwrite, save package version as .codeforge-new
			if (preserveSet.has(relativePath) && fs.existsSync(destPath)) {
				fs.copyFileSync(srcPath, destPath + ".codeforge-new");
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
	const force = args.includes("--force") || args.includes("-f");
	const reset = args.includes("--reset");

	if (args.includes("--help") || args.includes("-h")) {
		console.log("Usage: codeforge [options]");
		console.log("");
		console.log("Options:");
		console.log(
			"  --force, -f   Update existing .devcontainer (preserves user config)",
		);
		console.log(
			"  --reset       Remove all customizations and install fresh defaults",
		);
		console.log("  --help, -h    Show this help message");
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
			// Nuclear: delete everything and copy fresh
			console.log("Resetting .devcontainer to package defaults...");
			console.log("");
			fs.rmSync(devcontainerDest, { recursive: true, force: true });
			copyDirectory(devcontainerSrc, devcontainerDest);
			console.log("  Reset complete. All user customizations removed.");
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

function printNextSteps() {
	console.log("Next steps:");
	console.log("  1. Open this folder in VS Code");
	console.log('  2. Select "Reopen in Container" from the command palette');
	console.log("  3. Run: claude");
	console.log("");
	console.log("Documentation: .devcontainer/README.md");
	console.log("");
}

function printFeatures() {
	console.log("Features included:");
	console.log("  - Claude Code CLI with optimized tool configuration");
	console.log("  - MCP servers: Qdrant (vector memory), Reasoner");
	console.log("  - Development tools: Node.js LTS, Python 3.14, Go, Bun");
	console.log("  - Persistent configuration and shell history");
	console.log("");
}

if (require.main === module) {
	main();
}

module.exports = { copyDirectory, syncDirectory, loadPreserveList, main };
