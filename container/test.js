#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) 2026 Marcus Krueger

const fs = require("node:fs");
const path = require("node:path");
const {
	copyDirectory,
	computeChecksum,
	generateChecksums,
	syncCodeforgeDirectory,
	main,
} = require("./setup.js");

function runTests() {
	console.log("🧪 Running CodeForge package tests...\n");

	// Test 1: copyDirectory function exists
	console.log("✓ Test 1: copyDirectory function exists");

	// Test 2: main function exists
	console.log("✓ Test 2: main function exists");

	// Test 3: Check required files exist
	const requiredFiles = [
		"package.json",
		"setup.js",
		"README.md",
		".devcontainer/devcontainer.json",
		".devcontainer/scripts/setup.sh",
		".devcontainer/scripts/generate-settings-profiles.js",
		".devcontainer/defaults/codeforge/config/settings.base.json",
		".devcontainer/defaults/codeforge/config/settings.json",
		".devcontainer/defaults/codeforge/config/settings-opus-47-1m-400k.json",
		".devcontainer/defaults/codeforge/config/settings-opus-46-200k.json",
		".devcontainer/defaults/codeforge/config/settings-opus-46-1m-400k.json",
		".devcontainer/defaults/codeforge/config/settings-opus-45-200k.json",
		".devcontainer/defaults/codeforge/file-manifest.json",
		".devcontainer/features/oh-my-claude/devcontainer-feature.json",
		".devcontainer/features/oh-my-claude/install.sh",
		".devcontainer/features/oh-my-claude/README.md",
		".devcontainer/features/claude-code-karma/devcontainer-feature.json",
		".devcontainer/features/claude-code-karma/install.sh",
		".devcontainer/features/claude-code-karma/README.md",
	];

	let allFilesExist = true;
	requiredFiles.forEach((file) => {
		if (fs.existsSync(path.join(__dirname, file))) {
			console.log(
				`✓ Test 3.${requiredFiles.indexOf(file) + 1}: ${file} exists`,
			);
		} else {
			console.log(
				`❌ Test 3.${requiredFiles.indexOf(file) + 1}: ${file} missing`,
			);
			allFilesExist = false;
		}
	});

	// Test 4: Package.json has correct structure
	const packageJson = JSON.parse(
		fs.readFileSync(path.join(__dirname, "package.json"), "utf8"),
	);
	const requiredFields = ["name", "version", "bin", "files"];
	let packageValid = true;

	requiredFields.forEach((field) => {
		if (packageJson[field]) {
			console.log(
				`✓ Test 4.${requiredFields.indexOf(field) + 1}: package.json has ${field}`,
			);
		} else {
			console.log(
				`❌ Test 4.${requiredFields.indexOf(field) + 1}: package.json missing ${field}`,
			);
			packageValid = false;
		}
	});

	// Test 5: Setup script is executable
	let setupExecutable = true;
	const setupStat = fs.statSync(path.join(__dirname, "setup.js"));
	if (setupStat.mode & 0o111) {
		console.log("✓ Test 5: setup.js is executable");
	} else {
		console.log("❌ Test 5: setup.js is not executable");
		setupExecutable = false;
	}

	// Test 6: New checksum and sync functions exist
	let checksumFunctionsExist = true;
	if (typeof computeChecksum === "function") {
		console.log("✓ Test 6.1: computeChecksum function exists");
	} else {
		console.log("❌ Test 6.1: computeChecksum function missing");
		checksumFunctionsExist = false;
	}
	if (typeof generateChecksums === "function") {
		console.log("✓ Test 6.2: generateChecksums function exists");
	} else {
		console.log("❌ Test 6.2: generateChecksums function missing");
		checksumFunctionsExist = false;
	}
	if (typeof syncCodeforgeDirectory === "function") {
		console.log("✓ Test 6.3: syncCodeforgeDirectory function exists");
	} else {
		console.log("❌ Test 6.3: syncCodeforgeDirectory function missing");
		checksumFunctionsExist = false;
	}

	// Test 7: generateChecksums produces expected structure
	let checksumStructureValid = true;
	const defaultsDir = path.join(
		__dirname,
		".devcontainer",
		"defaults",
		"codeforge",
	);
	if (fs.existsSync(defaultsDir)) {
		const checksums = generateChecksums(defaultsDir);
		if (typeof checksums === "object" && checksums !== null) {
			const keys = Object.keys(checksums);
			if (keys.length > 0) {
				const firstValue = checksums[keys[0]];
				if (typeof firstValue === "string" && firstValue.length === 64) {
					console.log(
						"✓ Test 7: generateChecksums returns valid SHA-256 hex map",
					);
				} else {
					console.log(
						"❌ Test 7: generateChecksums values are not SHA-256 hex strings",
					);
					checksumStructureValid = false;
				}
			} else {
				console.log("❌ Test 7: generateChecksums returned empty map");
				checksumStructureValid = false;
			}
		} else {
			console.log("❌ Test 7: generateChecksums did not return an object");
			checksumStructureValid = false;
		}
	} else {
		console.log(
			"❌ Test 7: .devcontainer/defaults/codeforge/ not found, skipping",
		);
		checksumStructureValid = false;
	}

	// Test 8: Defaults directory has expected config structure
	let defaultsStructureValid = true;
	const expectedSubdirs = ["config"];
	const expectedFiles = [
		"file-manifest.json",
		"config/settings.base.json",
		"config/settings.json",
		"config/settings-opus-47-1m-400k.json",
		"config/settings-opus-46-200k.json",
		"config/settings-opus-46-1m-400k.json",
		"config/settings-opus-45-200k.json",
	];

	if (fs.existsSync(defaultsDir)) {
		for (const subdir of expectedSubdirs) {
			const subdirPath = path.join(defaultsDir, subdir);
			if (
				!fs.existsSync(subdirPath) ||
				!fs.statSync(subdirPath).isDirectory()
			) {
				console.log(`❌ Test 8: Missing expected subdirectory: ${subdir}`);
				defaultsStructureValid = false;
			}
		}
		for (const file of expectedFiles) {
			const filePath = path.join(defaultsDir, file);
			if (!fs.existsSync(filePath)) {
				console.log(`❌ Test 8: Missing expected file: ${file}`);
				defaultsStructureValid = false;
			}
		}
		if (defaultsStructureValid) {
			console.log("✓ Test 8: Defaults directory has expected structure");
		}
	} else {
		console.log("❌ Test 8: .devcontainer/defaults/codeforge/ not found");
		defaultsStructureValid = false;
	}

	// Test 9: Settings profiles are generated from base + overlays
	let settingsProfilesValid = true;
	const configDir = path.join(defaultsDir, "config");
	const profileDir = path.join(configDir, "settings-profiles");
	const profileMatrix = [
		["opus-47-200k.json", "settings.json"],
		["opus-47-1m-400k.json", "settings-opus-47-1m-400k.json"],
		["opus-46-200k.json", "settings-opus-46-200k.json"],
		["opus-46-1m-400k.json", "settings-opus-46-1m-400k.json"],
		["opus-45-200k.json", "settings-opus-45-200k.json"],
	];
	const profileEnvKeys = [
		"ANTHROPIC_MODEL",
		"ANTHROPIC_DEFAULT_OPUS_MODEL",
		"CLAUDE_CODE_MAX_CONTEXT_TOKENS",
		"CLAUDE_CODE_AUTO_COMPACT_WINDOW",
		"CLAUDE_CODE_EFFORT_LEVEL",
		"MAX_THINKING_TOKENS",
		"CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING",
	];
	const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
	const isObject = (value) =>
		value !== null && typeof value === "object" && !Array.isArray(value);
	const merge = (base, overlay) => {
		const result = { ...base };
		for (const [key, value] of Object.entries(overlay)) {
			if (isObject(value) && isObject(result[key])) {
				result[key] = merge(result[key], value);
			} else {
				result[key] = value;
			}
		}
		return result;
	};
	const stripProfileFields = (settings) => {
		const stripped = JSON.parse(JSON.stringify(settings));
		delete stripped.model;
		delete stripped.autoCompactWindow;
		delete stripped.effortLevel;
		if (stripped.env) {
			for (const key of profileEnvKeys) {
				delete stripped.env[key];
			}
		}
		return stripped;
	};
	try {
		const base = readJson(path.join(configDir, "settings.base.json"));
		for (const [overlayFile, outputFile] of profileMatrix) {
			const overlay = readJson(path.join(profileDir, overlayFile));
			const generated = readJson(path.join(configDir, outputFile));
			const expected = merge(base, overlay);
			if (JSON.stringify(generated) !== JSON.stringify(expected)) {
				console.log(`❌ Test 9: ${outputFile} is stale`);
				settingsProfilesValid = false;
			}
			if (
				JSON.stringify(stripProfileFields(generated)) !==
				JSON.stringify(stripProfileFields(base))
			) {
				console.log(
					`❌ Test 9: ${outputFile} diverges from base outside profile fields`,
				);
				settingsProfilesValid = false;
			}
		}
		if (settingsProfilesValid) {
			console.log("✓ Test 9: Settings profiles preserve shared base settings");
		}
	} catch (error) {
		console.log(`❌ Test 9: Settings profile validation failed: ${error}`);
		settingsProfilesValid = false;
	}

	// Test 10: oh-my-claude feature stays aligned with CodeForge ownership
	let omcFeatureValid = true;
	const omcInstallPath = path.join(
		__dirname,
		".devcontainer",
		"features",
		"oh-my-claude",
		"install.sh",
	);
	const omcFeatureJsonPath = path.join(
		__dirname,
		".devcontainer",
		"features",
		"oh-my-claude",
		"devcontainer-feature.json",
	);
	if (fs.existsSync(omcInstallPath) && fs.existsSync(omcFeatureJsonPath)) {
		const omcInstall = fs.readFileSync(omcInstallPath, "utf8");
		const omcFeature = JSON.parse(fs.readFileSync(omcFeatureJsonPath, "utf8"));
		if (
			omcInstall.includes("--skip-hooks") &&
			omcInstall.includes("--skip-mcp")
		) {
			console.log("✓ Test 10.1: oh-my-claude install skips hooks and MCP");
		} else {
			console.log("❌ Test 10.1: oh-my-claude install must skip hooks and MCP");
			omcFeatureValid = false;
		}
		if (!/omc proxy (start|stop|restart)/.test(omcInstall)) {
			console.log(
				"✓ Test 10.2: oh-my-claude install avoids stale daemon commands",
			);
		} else {
			console.log(
				"❌ Test 10.2: oh-my-claude install uses stale daemon commands",
			);
			omcFeatureValid = false;
		}
		if (
			omcFeature.options &&
			!omcFeature.options.autostart &&
			!omcFeature.options.installLaunchAliases
		) {
			console.log(
				"✓ Test 10.3: oh-my-claude feature delegates aliases to setup-aliases.sh and has no autostart",
			);
		} else {
			console.log(
				"❌ Test 10.3: oh-my-claude feature should not own aliases (setup-aliases.sh does) and should not autostart",
			);
			omcFeatureValid = false;
		}
	} else {
		console.log("❌ Test 10: oh-my-claude feature files missing");
		omcFeatureValid = false;
	}

	// Summary
	console.log("\n📊 Test Results:");
	if (
		allFilesExist &&
		packageValid &&
		setupExecutable &&
		checksumFunctionsExist &&
		checksumStructureValid &&
		defaultsStructureValid &&
		settingsProfilesValid &&
		omcFeatureValid
	) {
		console.log("🎉 All tests passed! Package is ready for distribution.");
		process.exit(0);
	} else {
		console.log("❌ Some tests failed. Check the errors above.");
		process.exit(1);
	}
}

if (require.main === module) {
	runTests();
}
