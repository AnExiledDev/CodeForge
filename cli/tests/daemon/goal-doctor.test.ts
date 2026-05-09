import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import {
	checkHookFiles,
	checkSkillFiles,
	checkSettingsHooks,
	checkConfigFile,
	checkGoalDirWritable,
	checkEnvVar,
	checkGitAvailable,
	formatGoalDoctorJson,
	type GoalCheckResult,
	type GoalDoctorReport,
} from "../../src/commands/goal/doctor.js";

let tmpDir: string;

beforeEach(() => {
	tmpDir = join(import.meta.dir, ".tmp-goal-doctor-" + Date.now());
	mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

describe("checkHookFiles", () => {
	test("reports missing hook files", () => {
		const result = checkHookFiles(tmpDir);
		expect(result.status).toBe("fail");
		expect(result.message).toContain("goal-stop.ts");
		expect(result.message).toContain("goal-session-start.ts");
		expect(result.message).toContain("goal-post-tool.ts");
		expect(result.message).toContain("goal-user-prompt.ts");
	});

	test("passes when all hooks exist", () => {
		const hooksDir = join(tmpDir, ".claude", "hooks");
		mkdirSync(hooksDir, { recursive: true });
		for (const file of [
			"goal-stop.ts",
			"goal-session-start.ts",
			"goal-post-tool.ts",
			"goal-user-prompt.ts",
		]) {
			writeFileSync(join(hooksDir, file), "// hook");
		}

		const result = checkHookFiles(tmpDir);
		expect(result.status).toBe("pass");
	});

	test("reports partial missing hooks", () => {
		const hooksDir = join(tmpDir, ".claude", "hooks");
		mkdirSync(hooksDir, { recursive: true });
		writeFileSync(join(hooksDir, "goal-stop.ts"), "// hook");
		writeFileSync(join(hooksDir, "goal-post-tool.ts"), "// hook");

		const result = checkHookFiles(tmpDir);
		expect(result.status).toBe("fail");
		expect(result.message).toContain("goal-session-start.ts");
		expect(result.message).toContain("goal-user-prompt.ts");
		expect(result.message).not.toContain("goal-stop.ts");
	});
});

describe("checkSkillFiles", () => {
	test("reports missing skill files", () => {
		const result = checkSkillFiles(tmpDir);
		expect(result.status).toBe("fail");
		expect(result.message).toContain("goal");
	});

	test("passes when all skills exist", () => {
		for (const dir of ["goal", "goal-status", "goal-pause", "goal-resume", "goal-clear"]) {
			const skillDir = join(tmpDir, ".claude", "skills", dir);
			mkdirSync(skillDir, { recursive: true });
			writeFileSync(join(skillDir, "SKILL.md"), "# skill");
		}

		const result = checkSkillFiles(tmpDir);
		expect(result.status).toBe("pass");
	});
});

describe("checkSettingsHooks", () => {
	test("fails when settings.json does not exist", () => {
		const result = checkSettingsHooks(tmpDir);
		expect(result.status).toBe("fail");
	});

	test("fails when hooks are not registered", () => {
		const settingsPath = join(tmpDir, ".claude", "settings.json");
		mkdirSync(join(tmpDir, ".claude"), { recursive: true });
		writeFileSync(settingsPath, JSON.stringify({ hooks: {} }));

		const result = checkSettingsHooks(tmpDir);
		expect(result.status).toBe("fail");
	});
});

describe("checkConfigFile", () => {
	test("fails when config.json is missing", () => {
		const result = checkConfigFile(tmpDir);
		expect(result.status).toBe("fail");
	});

	test("passes when config.json exists", () => {
		const configDir = join(tmpDir, ".codeforge", "goal");
		mkdirSync(configDir, { recursive: true });
		writeFileSync(join(configDir, "config.json"), "{}");

		const result = checkConfigFile(tmpDir);
		expect(result.status).toBe("pass");
	});
});

describe("checkGoalDirWritable", () => {
	test("passes when .claude/goal is writable", () => {
		const goalDir = join(tmpDir, ".claude", "goal");
		mkdirSync(goalDir, { recursive: true });

		const result = checkGoalDirWritable(tmpDir);
		expect(result.status).toBe("pass");
	});

	test("warns when .claude does not exist", () => {
		// tmpDir has no .claude directory
		const emptyDir = join(tmpDir, "empty-project");
		mkdirSync(emptyDir, { recursive: true });

		const result = checkGoalDirWritable(emptyDir);
		expect(result.status).toBe("warn");
	});
});

describe("checkEnvVar", () => {
	test("passes when env var is set", () => {
		const original = process.env.PATH;
		// PATH is always set
		const result = checkEnvVar("PATH", "PATH");
		expect(result.status).toBe("pass");
	});

	test("warns when env var is not set", () => {
		const result = checkEnvVar("NONEXISTENT_VAR_FOR_TEST_12345", "Test var");
		expect(result.status).toBe("warn");
	});
});

describe("checkGitAvailable", () => {
	test("passes when git is available", () => {
		const result = checkGitAvailable();
		expect(result.status).toBe("pass");
	});
});

describe("JSON output format", () => {
	test("produces valid JSON with checks and summary", () => {
		const checks: GoalCheckResult[] = [
			{ name: "Test check", status: "pass", message: "OK" },
			{ name: "Failing check", status: "fail", message: "Bad", hint: "Fix it" },
			{ name: "Warning check", status: "warn", message: "Hmm" },
		];
		const report: GoalDoctorReport = {
			checks,
			passed: 1,
			failed: 1,
			warnings: 1,
		};

		const json = formatGoalDoctorJson(report);
		const parsed = JSON.parse(json);

		expect(parsed.checks).toHaveLength(3);
		expect(parsed.checks[0].name).toBe("Test check");
		expect(parsed.checks[0].status).toBe("pass");
		expect(parsed.checks[1].hint).toBe("Fix it");
		expect(parsed.summary.passed).toBe(1);
		expect(parsed.summary.failed).toBe(1);
		expect(parsed.summary.warnings).toBe(1);
	});
});
