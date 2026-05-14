#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (c) 2026 Marcus Krueger

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const nunjucks = require("nunjucks");

const devcontainerDir = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(
	process.env.WORKSPACE_ROOT || path.resolve(devcontainerDir, ".."),
);
const defaultsRoot = path.join(devcontainerDir, "defaults", "codeforge");
const overrideRoot = path.resolve(
	process.env.CODEFORGE_DIR || path.join(workspaceRoot, ".codeforge"),
);

const MODEL_MAP = {
	"opus-45-200k": { name: "Opus 4.5", id: "claude-opus-4-5-20250819" },
	"opus-46-200k": { name: "Opus 4.6", id: "claude-opus-4-6" },
	"opus-46-1m-400k": { name: "Opus 4.6", id: "claude-opus-4-6" },
	"opus-47-200k": { name: "Opus 4.7", id: "claude-opus-4-7" },
	"opus-47-1m-400k": { name: "Opus 4.7", id: "claude-opus-4-7" },
};

const LATEST_MODELS = {
	opus: { name: "Opus 4.7", id: "claude-opus-4-7" },
	sonnet: { name: "Sonnet 4.6", id: "claude-sonnet-4-6" },
	haiku: { name: "Haiku 4.5", id: "claude-haiku-4-5-20251001" },
};

function parseArgs(argv) {
	const args = argv.slice(2);
	const result = { profile: null, prompt: null, quiet: false };

	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--profile" && i + 1 < args.length) {
			result.profile = args[++i];
		} else if (args[i] === "--prompt" && i + 1 < args.length) {
			result.prompt = args[++i];
		} else if (args[i] === "--quiet") {
			result.quiet = true;
		}
	}

	return result;
}

function printUsage() {
	console.error(
		"Usage: node generate-system-prompts.js --profile <profile-name> --prompt <prompt-name> [--quiet]",
	);
	console.error("");
	console.error("Profiles:", Object.keys(MODEL_MAP).join(", "));
}

function resolveTemplatePath(promptName) {
	const relativePath = path.join(
		"claude",
		"system-prompts",
		"template.md",
	);
	const overridePath = path.join(overrideRoot, relativePath);
	if (fs.existsSync(overridePath)) {
		return overridePath;
	}
	const defaultPath = path.join(defaultsRoot, relativePath);
	if (fs.existsSync(defaultPath)) {
		return defaultPath;
	}
	return null;
}

function buildContext(profile, modelInfo) {
	return {
		platform: os.platform(),
		shell: process.env.SHELL || "/bin/zsh",
		os_version: `${os.type()} ${os.release()}`,
		model_name: modelInfo.name,
		model_id: modelInfo.id,
		knowledge_cutoff: "May 2025",
		model_family: "Claude 4.X",
		latest_opus_name: LATEST_MODELS.opus.name,
		latest_opus_id: LATEST_MODELS.opus.id,
		latest_sonnet_name: LATEST_MODELS.sonnet.name,
		latest_sonnet_id: LATEST_MODELS.sonnet.id,
		latest_haiku_name: LATEST_MODELS.haiku.name,
		latest_haiku_id: LATEST_MODELS.haiku.id,
		memory_dir:
			process.env.MEMORY_DIR ||
			`${path.join(os.homedir(), ".claude", "memory")}/`,
	};
}

function main() {
	const args = parseArgs(process.argv);

	if (!args.profile || !args.prompt) {
		printUsage();
		process.exit(1);
	}

	const modelInfo = MODEL_MAP[args.profile];
	if (!modelInfo) {
		console.error(`Unknown profile: ${args.profile}`);
		printUsage();
		process.exit(1);
	}

	const templatePath = resolveTemplatePath(args.prompt);
	if (!templatePath) {
		console.error(
			`Template not found: claude/system-prompts/template.md (checked override and default paths)`,
		);
		process.exit(1);
	}

	const overrideSearchPath = path.join(
		overrideRoot,
		"claude",
		"system-prompts",
	);
	const defaultSearchPath = path.join(
		defaultsRoot,
		"claude",
		"system-prompts",
	);

	const searchPaths = [];
	if (fs.existsSync(overrideSearchPath)) {
		searchPaths.push(overrideSearchPath);
	}
	searchPaths.push(defaultSearchPath);

	const env = new nunjucks.Environment(
		new nunjucks.FileSystemLoader(searchPaths),
		{ autoescape: false, throwOnUndefined: true },
	);

	const context = buildContext(args.profile, modelInfo);

	let rendered;
	try {
		rendered = env.render("template.md", context);
	} catch (err) {
		console.error(`Template render failed: ${err.message}`);
		process.exit(1);
	}

	const outputDir = path.join(os.homedir(), ".claude");
	fs.mkdirSync(outputDir, { recursive: true });

	const outputPath = path.join(outputDir, `${args.prompt}-system-prompt.md`);
	fs.writeFileSync(outputPath, rendered);

	if (!args.quiet) {
		console.log(`generated ${outputPath}`);
	}
}

if (require.main === module) {
	main();
}
