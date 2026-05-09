import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { loadDaemonConfig } from "../../src/daemon/config.js";

describe("loadDaemonConfig", () => {
	test("returns defaults when no config file exists", () => {
		const tmp = mkdtempSync(join(tmpdir(), "cfg-test-"));
		const config = loadDaemonConfig(tmp);

		expect(config.host).toBe("127.0.0.1");
		expect(config.port).toBe(17332);
		expect(config.dbPath).toBe(join(tmp, ".codeforge", "goal", "daemon.db"));
		expect(config.logPath).toBe(
			join(tmp, ".codeforge", "goal", "logs", "daemon.log"),
		);
		expect(config.pidPath).toBe(
			join(tmp, ".codeforge", "goal", "daemon.pid"),
		);
		expect(config.models).toEqual({
			planner: [
				"openrouter:meta-llama/llama-4-scout",
				"openrouter:qwen/qwen3-30b-a3b",
			],
			evaluator: [
				"groq:meta-llama/llama-4-scout-17b-16e-instruct",
				"openrouter:meta-llama/llama-4-scout",
			],
		});
		expect(config.limits.maxGoalLoops).toBe(30);
		expect(config.limits.maxRepeatedInstructions).toBe(3);
		expect(config.limits.maxFailedValidations).toBe(5);
		expect(config.limits.maxJobRuntimeSeconds).toBe(300);
		expect(config.limits.maxHookOutputChars).toBe(8000);
	});

	test("merges partial config file with defaults", () => {
		const tmp = mkdtempSync(join(tmpdir(), "cfg-test-"));
		const configDir = join(tmp, ".codeforge", "goal");
		mkdirSync(configDir, { recursive: true });

		const partial = {
			port: 9999,
			limits: { maxGoalLoops: 50 },
		};
		writeFileSync(join(configDir, "config.json"), JSON.stringify(partial));

		const config = loadDaemonConfig(tmp);

		expect(config.port).toBe(9999);
		expect(config.limits.maxGoalLoops).toBe(50);
		// Defaults preserved for unspecified fields
		expect(config.host).toBe("127.0.0.1");
		expect(config.limits.maxRepeatedInstructions).toBe(3);
		expect(config.dbPath).toBe(join(tmp, ".codeforge", "goal", "daemon.db"));
	});

	test("resolves relative paths in config file against cwd", () => {
		const tmp = mkdtempSync(join(tmpdir(), "cfg-test-"));
		const configDir = join(tmp, ".codeforge", "goal");
		mkdirSync(configDir, { recursive: true });

		const partial = {
			dbPath: "custom/my.db",
		};
		writeFileSync(join(configDir, "config.json"), JSON.stringify(partial));

		const config = loadDaemonConfig(tmp);

		expect(config.dbPath).toBe(join(tmp, "custom", "my.db"));
	});
});
