#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) 2026 Marcus Krueger

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const {
	copyDirectory,
	computeChecksum,
	ensureCodeforgeScaffold,
	generateChecksums,
	mergeManifestEntries,
	main,
} = require("./setup.js");

const root = __dirname;
const defaultsDir = path.join(root, ".devcontainer", "defaults", "codeforge");
const generatedSettingsDir = path.join(
	root,
	".devcontainer",
	".generated",
	"codeforge",
	"claude",
	"settings",
);

let failed = false;

function pass(message) {
	console.log(`ok - ${message}`);
}

function fail(message) {
	console.log(`not ok - ${message}`);
	failed = true;
}

function assert(condition, message) {
	if (condition) {
		pass(message);
	} else {
		fail(message);
	}
}

function readJson(file) {
	return JSON.parse(fs.readFileSync(file, "utf8"));
}

function exists(relativePath) {
	return fs.existsSync(path.join(root, relativePath));
}

console.log("Running CodeForge package tests\n");

assert(typeof copyDirectory === "function", "copyDirectory export exists");
assert(typeof main === "function", "main export exists");
assert(typeof computeChecksum === "function", "computeChecksum export exists");
assert(
	typeof generateChecksums === "function",
	"generateChecksums export exists",
);
assert(
	typeof ensureCodeforgeScaffold === "function",
	"ensureCodeforgeScaffold export exists",
);
assert(
	typeof mergeManifestEntries === "function",
	"mergeManifestEntries export exists",
);

const requiredFiles = [
	"package.json",
	"setup.js",
	"README.md",
	".devcontainer/devcontainer.json",
	".devcontainer/scripts/setup.sh",
	".devcontainer/scripts/setup-config.sh",
	".devcontainer/scripts/setup-migrate-codeforge.sh",
	".devcontainer/scripts/setup-migrate-codeforge-v3.sh",
	".devcontainer/scripts/ensure-settings-generated.sh",
	".devcontainer/scripts/generate-settings-profiles.js",
	".devcontainer/defaults/codeforge/file-manifest.json",
	".devcontainer/defaults/codeforge/claude/settings/base.json",
	".devcontainer/defaults/codeforge/claude/settings/profiles/opus-45-200k.json",
	".devcontainer/defaults/codeforge/claude/settings/profiles/opus-46-200k.json",
	".devcontainer/defaults/codeforge/claude/settings/profiles/opus-46-1m-400k.json",
	".devcontainer/defaults/codeforge/claude/settings/profiles/opus-47-200k.json",
	".devcontainer/defaults/codeforge/claude/settings/profiles/opus-47-1m-400k.json",
	".devcontainer/defaults/codeforge/claude/system-prompts/main.md",
	".devcontainer/defaults/codeforge/claude/system-prompts/writing.md",
	".devcontainer/defaults/codeforge/claude/system-prompts/orchestrator.md",
	".devcontainer/defaults/codeforge/claude/statusline/settings.json",
	".devcontainer/defaults/codeforge/claude/router/config.json",
	".devcontainer/defaults/codeforge/codex/config.toml",
	".devcontainer/defaults/codeforge/rtk/config.toml",
	".devcontainer/features/oh-my-claude/devcontainer-feature.json",
	".devcontainer/features/claude-code-karma/devcontainer-feature.json",
];
for (const file of requiredFiles) {
	assert(exists(file), `${file} exists`);
}

const removedSourceFiles = [
	".devcontainer/defaults/codeforge/config/settings.json",
	".devcontainer/defaults/codeforge/config/settings-opus-45-200k.json",
	".devcontainer/defaults/codeforge/config/settings-opus-46-200k.json",
	".devcontainer/defaults/codeforge/config/settings-opus-46-1m-400k.json",
	".devcontainer/defaults/codeforge/config/settings-opus-47-1m-400k.json",
];
for (const file of removedSourceFiles) {
	assert(!exists(file), `${file} is not a packaged source file`);
}

const packageJson = readJson(path.join(root, "package.json"));
assert(packageJson.name, "package.json has name");
assert(packageJson.version, "package.json has version");
assert(packageJson.bin, "package.json has bin");
assert(Array.isArray(packageJson.files), "package.json has files list");
assert(
	!packageJson.files.some((entry) => entry.startsWith(".codeforge")),
	"package does not publish a .codeforge defaults tree",
);

const scaffoldDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeforge-scaffold-"));
ensureCodeforgeScaffold(scaffoldDir);
assert(fs.existsSync(path.join(scaffoldDir, "README.md")), "scaffold writes README");
assert(
	fs.existsSync(path.join(scaffoldDir, ".markers")),
	"scaffold creates marker directory",
);
assert(
	fs.existsSync(path.join(scaffoldDir, "data")),
	"scaffold creates data directory",
);
fs.rmSync(scaffoldDir, { recursive: true, force: true });

const checksums = generateChecksums(defaultsDir);
assert(Object.keys(checksums).length > 0, "generateChecksums sees defaults");
assert(
	Object.values(checksums).every(
		(value) => typeof value === "string" && value.length === 64,
	),
	"generateChecksums returns SHA-256 hex values",
);

const generatorMarkerDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeforge-marker-"));
execFileSync(
	process.execPath,
	[path.join(root, ".devcontainer", "scripts", "generate-settings-profiles.js")],
	{
		cwd: root,
		stdio: "inherit",
		env: {
			...process.env,
			WORKSPACE_ROOT: root,
			CODEFORGE_DIR: generatorMarkerDir,
		},
	},
);

const generatedDefault = readJson(path.join(generatedSettingsDir, "settings.json"));
const generatedOpus46 = readJson(
	path.join(generatedSettingsDir, "settings-opus-46-200k.json"),
);
assert(
	JSON.stringify(generatedDefault) === JSON.stringify(generatedOpus46),
	"settings.json matches opus-46-200k",
);

const nonOneMillionOutputs = [
	"settings.json",
	"settings-opus-46-200k.json",
	"settings-opus-47-200k.json",
	"settings-opus-45-200k.json",
];
for (const output of nonOneMillionOutputs) {
	const settings = readJson(path.join(generatedSettingsDir, output));
	assert(
		settings.env?.CLAUDE_CODE_DISABLE_1M_CONTEXT === "1",
		`${output} disables 1M context`,
	);
}
for (const output of [
	"settings-opus-46-1m-400k.json",
	"settings-opus-47-1m-400k.json",
]) {
	const settings = readJson(path.join(generatedSettingsDir, output));
	assert(
		!("CLAUDE_CODE_DISABLE_1M_CONTEXT" in (settings.env ?? {})),
		`${output} does not disable 1M context`,
	);
}
assert(
	fs.existsSync(path.join(generatorMarkerDir, ".markers", "settings-generated-v3")),
	"settings generator writes v3 marker",
);
fs.rmSync(generatorMarkerDir, { recursive: true, force: true });

const legacyProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeforge-legacy-profile-"));
const legacyOverrideDir = path.join(
	legacyProfileDir,
	"claude",
	"settings",
	"profiles",
);
fs.mkdirSync(legacyOverrideDir, { recursive: true });
fs.writeFileSync(
	path.join(legacyOverrideDir, "opus-46-200k.json"),
	JSON.stringify(
		{
			model: "claude-opus-4-6",
			autoCompactWindow: 200000,
			env: {
				CLAUDE_CODE_MAX_CONTEXT_TOKENS: "200000",
				CLAUDE_CODE_AUTO_COMPACT_WINDOW: "200000",
			},
		},
		null,
		"\t",
	) + "\n",
);
execFileSync(
	process.execPath,
	[path.join(root, ".devcontainer", "scripts", "generate-settings-profiles.js")],
	{
		cwd: root,
		stdio: "inherit",
		env: {
			...process.env,
			WORKSPACE_ROOT: root,
			CODEFORGE_DIR: legacyProfileDir,
		},
	},
);
const generatedLegacyProfile = readJson(
	path.join(generatedSettingsDir, "settings-opus-46-200k.json"),
);
assert(
	generatedLegacyProfile.env?.CLAUDE_CODE_DISABLE_1M_CONTEXT === "1",
	"legacy non-1M profile override disables 1M context",
);
fs.rmSync(legacyProfileDir, { recursive: true, force: true });

const manifest = readJson(path.join(defaultsDir, "file-manifest.json"));
assert(manifest.length > 0, "default manifest has entries");
assert(manifest.every((entry) => entry.id), "default manifest entries have stable ids");
assert(
	manifest.find((entry) => entry.id === "claude.state")?.dest === "${HOME}",
	"Claude state deploys to home directory",
);
const merged = mergeManifestEntries(manifest, [
	{ id: manifest[0].id, disabled: true, src: manifest[0].src },
	{
		id: "custom.example",
		src: "claude/system-prompts/main.md",
		dest: "${CLAUDE_CONFIG_DIR}",
		overwrite: "if-changed",
	},
]);
assert(
	merged.find((entry) => entry.id === manifest[0].id)?.enabled === false,
	"user manifest can disable a default by id",
);
assert(
	merged.some((entry) => entry.id === "custom.example"),
	"user manifest can add entries by id",
);
for (const entry of manifest) {
	const source = [
		path.join(root, ".devcontainer", ".generated", "codeforge", entry.src),
		path.join(defaultsDir, entry.src),
	].find((candidate) => fs.existsSync(candidate));
	assert(Boolean(source), `manifest source exists: ${entry.id}`);
}

const migrationScript = fs.readFileSync(
	path.join(root, ".devcontainer", "scripts", "setup-migrate-codeforge-v3.sh"),
	"utf8",
);
assert(
	migrationScript.includes("config-layout-v3") &&
		migrationScript.includes("config-layout-v3-report.md"),
	"v3 migration script writes marker and report",
);

const setupScript = fs.readFileSync(path.join(root, ".devcontainer", "scripts", "setup.sh"), "utf8");
assert(
	setupScript.includes("setup-migrate-codeforge-v3.sh") &&
		setupScript.includes("ensure-settings-generated.sh"),
	"setup runs v3 migration and settings generation",
);

console.log("");
if (failed) {
	console.log("Some tests failed.");
	process.exit(1);
}

console.log("All tests passed.");
