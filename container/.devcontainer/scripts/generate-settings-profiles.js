#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) 2026 Marcus Krueger

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const devcontainerDir = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(
	process.env.WORKSPACE_ROOT || path.resolve(devcontainerDir, ".."),
);
const defaultsRoot = path.join(devcontainerDir, "defaults", "codeforge");
const overrideRoot = path.resolve(
	process.env.CODEFORGE_DIR || path.join(workspaceRoot, ".codeforge"),
);
const generatedRoot = path.join(devcontainerDir, ".generated", "codeforge");
const generatedSettingsDir = path.join(generatedRoot, "claude", "settings");
const markerFile = path.join(overrideRoot, ".markers", "settings-generated-v3");

// isDefault marks which profile settings.json symlinks to.
const profiles = [
	{
		overlay: "opus-46-200k.json",
		output: "settings-opus-46-200k.json",
		isDefault: true,
	},
	{
		overlay: "opus-46-1m-400k.json",
		output: "settings-opus-46-1m-400k.json",
	},
	{
		overlay: "opus-47-200k.json",
		output: "settings-opus-47-200k.json",
	},
	{
		overlay: "opus-47-1m-400k.json",
		output: "settings-opus-47-1m-400k.json",
	},
	{
		overlay: "opus-45-200k.json",
		output: "settings-opus-45-200k.json",
	},
];

function isPlainObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function merge(base, overlay) {
	const result = { ...base };
	for (const [key, value] of Object.entries(overlay)) {
		if (isPlainObject(value) && isPlainObject(result[key])) {
			result[key] = merge(result[key], value);
		} else {
			result[key] = value;
		}
	}
	return result;
}

// Expand _meta shorthand into model, env context/window fields, and 1M flag.
// Keeps overlay env on top of meta-derived env, so explicit env always wins.
function expandMeta(overlay) {
	if (!overlay._meta) return overlay;
	const { _meta, env: overlayEnv, ...rest } = overlay;
	const { model, contextWindow } = _meta;
	const isOneMillion = model.includes("[1m]");

	const metaEnv = {
		CLAUDE_CODE_MAX_CONTEXT_TOKENS: String(contextWindow),
		CLAUDE_CODE_AUTO_COMPACT_WINDOW: String(contextWindow),
	};
	if (!isOneMillion) {
		metaEnv.CLAUDE_CODE_DISABLE_1M_CONTEXT = "1";
	}

	return {
		model,
		env: { ...metaEnv, ...(overlayEnv || {}) },
		...rest,
	};
}

function normalizeLegacyProfile(overlay) {
	if (overlay._meta) return overlay;
	const model = overlay.model || "";
	const env = overlay.env || {};
	if (!model.includes("[1m]") && !("CLAUDE_CODE_DISABLE_1M_CONTEXT" in env)) {
		return {
			...overlay,
			env: {
				...env,
				CLAUDE_CODE_DISABLE_1M_CONTEXT: "1",
			},
		};
	}
	return overlay;
}

function readJson(file) {
	return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, `${JSON.stringify(data, null, "\t")}\n`);
}

function sha256(file) {
	return crypto
		.createHash("sha256")
		.update(fs.readFileSync(file))
		.digest("hex");
}

function statMtime(file) {
	try {
		return fs.statSync(file).mtimeMs;
	} catch {
		return 0;
	}
}

function resolveInput(relativePath) {
	const overridePath = path.join(overrideRoot, relativePath);
	if (fs.existsSync(overridePath)) {
		return {
			path: overridePath,
			source: "override",
			relativePath,
		};
	}
	return {
		path: path.join(defaultsRoot, relativePath),
		source: "default",
		relativePath,
	};
}

function getInputs() {
	const inputs = [resolveInput("claude/settings/base.json")];
	for (const profile of profiles) {
		inputs.push(
			resolveInput(
				path.join("claude", "settings", "profiles", profile.overlay),
			),
		);
	}
	const seen = new Map();
	for (const input of inputs) {
		seen.set(input.path, input);
	}
	return [...seen.values()];
}

function formatInput(input) {
	return `${input.source} ${input.path}`;
}

function validateProfile(profile, expanded, overlayInput) {
	const env = expanded.env || {};
	const isOneMillion = (expanded.model || "").includes("[1m]");
	const hasDisable = env.CLAUDE_CODE_DISABLE_1M_CONTEXT === "1";
	if (!isOneMillion && !hasDisable) {
		throw new Error(
			`Profile ${profile.output} (overlay: ${profile.overlay}, source: ${formatInput(overlayInput)}): must set CLAUDE_CODE_DISABLE_1M_CONTEXT=1`,
		);
	}
	if (isOneMillion && "CLAUDE_CODE_DISABLE_1M_CONTEXT" in env) {
		throw new Error(
			`Profile ${profile.output} (overlay: ${profile.overlay}, source: ${formatInput(overlayInput)}): must not set CLAUDE_CODE_DISABLE_1M_CONTEXT`,
		);
	}
}

function buildGenerated() {
	const baseInput = resolveInput("claude/settings/base.json");
	const base = readJson(baseInput.path);
	const outputs = [];

	for (const profile of profiles) {
		const overlayInput = resolveInput(
			path.join("claude", "settings", "profiles", profile.overlay),
		);
		const rawOverlay = readJson(overlayInput.path);
		const expanded = normalizeLegacyProfile(expandMeta(rawOverlay));
		validateProfile(profile, expanded, overlayInput);
		const settings = merge(base, expanded);
		outputs.push({
			file: path.join(generatedSettingsDir, profile.output),
			profile,
			settings,
		});
	}

	return outputs;
}

// Write settings.json as a symlink to the default profile.
// Falls back to a file copy on platforms that don't support symlinks.
function writeDefaultLink(defaultProfile) {
	const symlinkPath = path.join(generatedSettingsDir, "settings.json");
	try {
		fs.unlinkSync(symlinkPath);
	} catch {
		/* not present */
	}
	try {
		fs.symlinkSync(defaultProfile.output, symlinkPath);
		console.log(`symlinked settings.json -> ${defaultProfile.output}`);
	} catch {
		fs.copyFileSync(
			path.join(generatedSettingsDir, defaultProfile.output),
			symlinkPath,
		);
		console.log(
			`copied settings.json from ${defaultProfile.output} (symlink unavailable)`,
		);
	}
}

// Returns true if settings.json is the correct symlink or an identical copy.
function isDefaultLinkValid(defaultProfile) {
	const symlinkPath = path.join(generatedSettingsDir, "settings.json");
	if (!fs.existsSync(symlinkPath)) return false;
	try {
		return fs.readlinkSync(symlinkPath) === defaultProfile.output;
	} catch {
		const a = fs.readFileSync(symlinkPath, "utf8");
		const b = fs.readFileSync(
			path.join(generatedSettingsDir, defaultProfile.output),
			"utf8",
		);
		return a === b;
	}
}

function readMarker() {
	try {
		return JSON.parse(fs.readFileSync(markerFile, "utf8"));
	} catch {
		return null;
	}
}

function isStale() {
	const marker = readMarker();
	if (!marker) return true;

	const markerTime = statMtime(markerFile);
	for (const input of getInputs()) {
		if (!fs.existsSync(input.path)) return true;
		if (statMtime(input.path) > markerTime) return true;
	}

	for (const profile of profiles) {
		if (!fs.existsSync(path.join(generatedSettingsDir, profile.output))) {
			return true;
		}
	}

	const defaultProfile = profiles.find((p) => p.isDefault);
	if (defaultProfile && !isDefaultLinkValid(defaultProfile)) return true;

	return false;
}

function writeMarker() {
	fs.mkdirSync(path.dirname(markerFile), { recursive: true });
	const inputs = {};
	for (const input of getInputs()) {
		inputs[input.relativePath] = {
			path: input.path,
			source: input.source,
			sha256: fs.existsSync(input.path) ? sha256(input.path) : null,
		};
	}
	const outputs = {};
	for (const profile of profiles) {
		const file = path.join(generatedSettingsDir, profile.output);
		outputs[`claude/settings/${profile.output}`] = {
			path: file,
			sha256: fs.existsSync(file) ? sha256(file) : null,
		};
	}
	const defaultProfile = profiles.find((p) => p.isDefault);
	if (defaultProfile) {
		outputs["claude/settings/settings.json"] = {
			path: path.join(generatedSettingsDir, "settings.json"),
			default: defaultProfile.output,
		};
	}
	writeJson(markerFile, {
		version: 3,
		generatedAt: new Date().toISOString(),
		defaultProfile: defaultProfile?.output ?? null,
		inputs,
		outputs,
	});
}

function checkGenerated() {
	const outputs = buildGenerated();
	const diffs = [];
	for (const output of outputs) {
		if (!fs.existsSync(output.file)) {
			diffs.push(`${output.profile.output}: missing`);
			continue;
		}
		const actual = readJson(output.file);
		if (JSON.stringify(actual) !== JSON.stringify(output.settings)) {
			diffs.push(`${path.basename(output.file)} is stale`);
		}
	}

	const defaultProfile = profiles.find((p) => p.isDefault);
	if (defaultProfile && !isDefaultLinkValid(defaultProfile)) {
		diffs.push(
			`settings.json is missing or does not match ${defaultProfile.output}`,
		);
	}

	if (diffs.length > 0) {
		for (const diff of diffs) {
			console.error(diff);
		}
		process.exit(1);
	}
	console.log("settings profiles are current");
}

function writeGenerated() {
	const outputs = buildGenerated();
	for (const output of outputs) {
		writeJson(output.file, output.settings);
		console.log(`generated ${path.relative(devcontainerDir, output.file)}`);
	}

	const defaultProfile = profiles.find((p) => p.isDefault);
	if (defaultProfile) {
		writeDefaultLink(defaultProfile);
	}

	writeMarker();
}

function main() {
	const args = new Set(process.argv.slice(2));
	if (args.has("--check")) {
		checkGenerated();
		return;
	}
	if (args.has("--if-stale") && !isStale()) {
		return;
	}
	writeGenerated();
}

if (require.main === module) {
	main();
}
