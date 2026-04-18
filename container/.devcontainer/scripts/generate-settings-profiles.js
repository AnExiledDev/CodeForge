#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) 2026 Marcus Krueger

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const configDir = path.join(repoRoot, "defaults", "codeforge", "config");

const profiles = [
	{
		overlay: "opus-47-200k.json",
		output: "settings.json",
	},
	{
		overlay: "opus-47-1m-400k.json",
		output: "settings-opus-47-1m-400k.json",
	},
	{
		overlay: "opus-46-200k.json",
		output: "settings-opus-46-200k.json",
	},
	{
		overlay: "opus-46-1m-400k.json",
		output: "settings-opus-46-1m-400k.json",
	},
	{
		overlay: "opus-45-200k.json",
		output: "settings-opus-45-200k.json",
	},
];

function readJson(file) {
	return JSON.parse(fs.readFileSync(file, "utf8"));
}

function isPlainObject(value) {
	return (
		value !== null &&
		typeof value === "object" &&
		!Array.isArray(value)
	);
}

function merge(base, overlay) {
	const result = { ...base };
	for (const [key, value] of Object.entries(overlay)) {
		if (
			isPlainObject(value) &&
			isPlainObject(result[key])
		) {
			result[key] = merge(result[key], value);
		} else {
			result[key] = value;
		}
	}
	return result;
}

function writeJson(file, data) {
	fs.writeFileSync(file, `${JSON.stringify(data, null, "\t")}\n`);
}

function main() {
	const base = readJson(path.join(configDir, "settings.base.json"));
	const profileDir = path.join(configDir, "settings-profiles");

	for (const profile of profiles) {
		const overlay = readJson(path.join(profileDir, profile.overlay));
		const settings = merge(base, overlay);
		writeJson(path.join(configDir, profile.output), settings);
		console.log(`generated ${profile.output}`);
	}
}

if (require.main === module) {
	main();
}
