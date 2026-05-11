import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";
import type { DaemonConfig, LimitsConfig } from "../schemas/goal.js";

const DEFAULT_LIMITS: LimitsConfig = {
	maxGoalLoops: 30,
	maxRepeatedInstructions: 3,
	maxFailedValidations: 5,
	maxJobRuntimeSeconds: 300,
	maxHookOutputChars: 8000,
};

function defaultConfig(cwd: string): DaemonConfig {
	return {
		host: "127.0.0.1",
		port: 17332,
		dbPath: join(cwd, ".codeforge", "goal", "daemon.db"),
		logPath: join(cwd, ".codeforge", "goal", "logs", "daemon.log"),
		pidPath: join(cwd, ".codeforge", "goal", "daemon.pid"),
		models: {
			planner: [
				"openrouter:meta-llama/llama-4-scout",
				"openrouter:qwen/qwen3-30b-a3b",
			],
			evaluator: [
				"groq:meta-llama/llama-4-scout-17b-16e-instruct",
				"openrouter:meta-llama/llama-4-scout",
			],
		},
		limits: { ...DEFAULT_LIMITS },
	};
}

function deepMerge(
	target: Record<string, unknown>,
	source: Record<string, unknown>,
): Record<string, unknown> {
	const result = { ...target };
	for (const key of Object.keys(source)) {
		const srcVal = source[key];
		const tgtVal = target[key];
		if (
			srcVal !== null &&
			typeof srcVal === "object" &&
			!Array.isArray(srcVal) &&
			tgtVal !== null &&
			typeof tgtVal === "object" &&
			!Array.isArray(tgtVal)
		) {
			result[key] = deepMerge(
				tgtVal as Record<string, unknown>,
				srcVal as Record<string, unknown>,
			);
		} else {
			result[key] = srcVal;
		}
	}
	return result;
}

export function loadDaemonConfig(cwd?: string): DaemonConfig {
	const resolvedCwd = resolve(cwd ?? process.cwd());
	const defaults = defaultConfig(resolvedCwd);
	const configPath = join(resolvedCwd, ".codeforge", "goal", "config.json");

	if (!existsSync(configPath)) {
		return defaults;
	}

	const raw = readFileSync(configPath, "utf-8");
	const parsed = JSON.parse(raw) as Record<string, unknown>;

	// Resolve relative paths from config file against cwd
	if (typeof parsed.dbPath === "string" && !parsed.dbPath.startsWith("/")) {
		parsed.dbPath = join(resolvedCwd, parsed.dbPath);
	}
	if (typeof parsed.logPath === "string" && !parsed.logPath.startsWith("/")) {
		parsed.logPath = join(resolvedCwd, parsed.logPath);
	}
	if (typeof parsed.pidPath === "string" && !parsed.pidPath.startsWith("/")) {
		parsed.pidPath = join(resolvedCwd, parsed.pidPath);
	}

	const merged = deepMerge(
		defaults as unknown as Record<string, unknown>,
		parsed,
	) as unknown as DaemonConfig;

	validateConfig(merged);
	return merged;
}

/** Basic config validation — catches obvious typos before they cause cryptic failures downstream. */
function validateConfig(config: DaemonConfig): void {
	if (
		typeof config.port !== "number" ||
		config.port < 1 ||
		config.port > 65535
	) {
		throw new Error(`Invalid daemon port: ${config.port} — must be 1-65535`);
	}
	if (!config.host || typeof config.host !== "string") {
		throw new Error("Invalid daemon host: must be a non-empty string");
	}
	if (!config.dbPath || typeof config.dbPath !== "string") {
		throw new Error("Invalid daemon dbPath: must be a non-empty string");
	}
	if (!config.models || typeof config.models !== "object") {
		throw new Error("Invalid daemon config: models must be an object");
	}
	if (
		!Array.isArray(config.models.evaluator) ||
		config.models.evaluator.length === 0
	) {
		throw new Error(
			"Invalid daemon config: models.evaluator must be a non-empty array",
		);
	}
	if (
		!Array.isArray(config.models.planner) ||
		config.models.planner.length === 0
	) {
		throw new Error(
			"Invalid daemon config: models.planner must be a non-empty array",
		);
	}
}
