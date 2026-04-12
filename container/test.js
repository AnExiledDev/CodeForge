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
		".codeforge/config/settings.json",
		".codeforge/file-manifest.json",
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
	const codeforgeDir = path.join(__dirname, ".codeforge");
	if (fs.existsSync(codeforgeDir)) {
		const checksums = generateChecksums(codeforgeDir);
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
		console.log("❌ Test 7: .codeforge directory not found, skipping");
		checksumStructureValid = false;
	}

	// Test 8: Bundled defaults in .devcontainer/defaults/codeforge/ match .codeforge/
	let bundledDefaultsInSync = true;
	const bundledDir = path.join(
		__dirname,
		".devcontainer",
		"defaults",
		"codeforge",
	);
	if (fs.existsSync(bundledDir) && fs.existsSync(codeforgeDir)) {
		const sourceChecksums = generateChecksums(codeforgeDir);
		const bundledChecksums = generateChecksums(bundledDir);
		const sourceKeys = Object.keys(sourceChecksums).sort();
		const bundledKeys = Object.keys(bundledChecksums).sort();

		if (JSON.stringify(sourceKeys) !== JSON.stringify(bundledKeys)) {
			console.log(
				"❌ Test 8: Bundled defaults file list differs from .codeforge/",
			);
			const missing = sourceKeys.filter((k) => !bundledKeys.includes(k));
			const extra = bundledKeys.filter((k) => !sourceKeys.includes(k));
			if (missing.length)
				console.log(`    Missing from bundled: ${missing.join(", ")}`);
			if (extra.length)
				console.log(`    Extra in bundled: ${extra.join(", ")}`);
			bundledDefaultsInSync = false;
		} else {
			const drifted = sourceKeys.filter(
				(k) => sourceChecksums[k] !== bundledChecksums[k],
			);
			if (drifted.length > 0) {
				console.log(
					"❌ Test 8: Bundled defaults content differs from .codeforge/",
				);
				console.log(`    Drifted files: ${drifted.join(", ")}`);
				bundledDefaultsInSync = false;
			} else {
				console.log("✓ Test 8: Bundled defaults match .codeforge/");
			}
		}
	} else if (!fs.existsSync(bundledDir)) {
		console.log("❌ Test 8: .devcontainer/defaults/codeforge/ not found");
		bundledDefaultsInSync = false;
	} else {
		console.log("❌ Test 8: .codeforge/ not found, cannot compare");
		bundledDefaultsInSync = false;
	}

	// Summary
	console.log("\n📊 Test Results:");
	if (
		allFilesExist &&
		packageValid &&
		setupExecutable &&
		checksumFunctionsExist &&
		checksumStructureValid &&
		bundledDefaultsInSync
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
