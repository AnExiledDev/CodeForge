import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { safeWriteFile } from "../../src/commands/goal/install.js";
import { generateStopHook } from "../../src/daemon/templates/hooks/stop.js";
import { generateSessionStartHook } from "../../src/daemon/templates/hooks/session-start.js";
import { generatePostToolHook } from "../../src/daemon/templates/hooks/post-tool-event.js";
import { generateUserPromptHook } from "../../src/daemon/templates/hooks/user-prompt.js";
import { generateGoalSkill } from "../../src/daemon/templates/skills/goal.js";
import { generateGoalStatusSkill } from "../../src/daemon/templates/skills/goal-status.js";
import { generateGoalPauseSkill } from "../../src/daemon/templates/skills/goal-pause.js";
import { generateGoalResumeSkill } from "../../src/daemon/templates/skills/goal-resume.js";
import { generateGoalClearSkill } from "../../src/daemon/templates/skills/goal-clear.js";

let tmpDir: string;

beforeEach(() => {
	tmpDir = join(import.meta.dir, ".tmp-install-" + Date.now());
	mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

describe("safeWriteFile", () => {
	test("creates a new file", () => {
		const filePath = join(tmpDir, "subdir", "test.txt");
		const result = safeWriteFile(filePath, "hello");

		expect(result.action).toBe("created");
		expect(result.path).toBe(filePath);
		expect(readFileSync(filePath, "utf-8")).toBe("hello");
	});

	test("skips unchanged file", () => {
		const filePath = join(tmpDir, "test.txt");
		writeFileSync(filePath, "hello");

		const result = safeWriteFile(filePath, "hello");

		expect(result.action).toBe("unchanged");
	});

	test("backs up and updates changed file", () => {
		const filePath = join(tmpDir, "test.txt");
		writeFileSync(filePath, "old content");

		const result = safeWriteFile(filePath, "new content");

		expect(result.action).toBe("updated");
		expect(readFileSync(filePath, "utf-8")).toBe("new content");
		expect(readFileSync(`${filePath}.bak`, "utf-8")).toBe("old content");
	});
});

describe("install creates hook files", () => {
	test("generates all 4 hook scripts", () => {
		const hooksDir = join(tmpDir, ".claude", "hooks");
		mkdirSync(hooksDir, { recursive: true });

		const hooks = [
			{ name: "goal-stop.ts", content: generateStopHook() },
			{ name: "goal-session-start.ts", content: generateSessionStartHook() },
			{ name: "goal-post-tool.ts", content: generatePostToolHook() },
			{ name: "goal-user-prompt.ts", content: generateUserPromptHook() },
		];

		for (const hook of hooks) {
			safeWriteFile(join(hooksDir, hook.name), hook.content);
		}

		for (const hook of hooks) {
			const filePath = join(hooksDir, hook.name);
			expect(existsSync(filePath)).toBe(true);
			const content = readFileSync(filePath, "utf-8");
			expect(content).toContain("#!/usr/bin/env bun");
			expect(content).toContain("CODEFORGE_GOAL_PORT");
		}
	});
});

describe("install creates skill files", () => {
	test("generates all 5 SKILL.md files", () => {
		const skills = [
			{ dir: "goal", content: generateGoalSkill() },
			{ dir: "goal-status", content: generateGoalStatusSkill() },
			{ dir: "goal-pause", content: generateGoalPauseSkill() },
			{ dir: "goal-resume", content: generateGoalResumeSkill() },
			{ dir: "goal-clear", content: generateGoalClearSkill() },
		];

		for (const skill of skills) {
			const skillDir = join(tmpDir, ".claude", "skills", skill.dir);
			mkdirSync(skillDir, { recursive: true });
			safeWriteFile(join(skillDir, "SKILL.md"), skill.content);
		}

		for (const skill of skills) {
			const filePath = join(tmpDir, ".claude", "skills", skill.dir, "SKILL.md");
			expect(existsSync(filePath)).toBe(true);
			const content = readFileSync(filePath, "utf-8");
			expect(content).toContain(`name: ${skill.dir}`);
		}
	});
});

describe("install idempotency", () => {
	test("re-run produces no unnecessary changes", () => {
		const hooksDir = join(tmpDir, ".claude", "hooks");
		mkdirSync(hooksDir, { recursive: true });

		const content = generateStopHook();
		const first = safeWriteFile(join(hooksDir, "goal-stop.ts"), content);
		expect(first.action).toBe("created");

		const second = safeWriteFile(join(hooksDir, "goal-stop.ts"), content);
		expect(second.action).toBe("unchanged");

		// No .bak created on unchanged
		expect(existsSync(join(hooksDir, "goal-stop.ts.bak"))).toBe(false);
	});
});

describe("install backs up changed files", () => {
	test("creates .bak when hook content changes", () => {
		const hooksDir = join(tmpDir, ".claude", "hooks");
		mkdirSync(hooksDir, { recursive: true });

		const oldContent = generateStopHook(17332);
		safeWriteFile(join(hooksDir, "goal-stop.ts"), oldContent);

		const newContent = generateStopHook(9999);
		const result = safeWriteFile(join(hooksDir, "goal-stop.ts"), newContent);

		expect(result.action).toBe("updated");
		expect(existsSync(join(hooksDir, "goal-stop.ts.bak"))).toBe(true);
		expect(readFileSync(join(hooksDir, "goal-stop.ts.bak"), "utf-8")).toBe(
			oldContent,
		);
		expect(readFileSync(join(hooksDir, "goal-stop.ts"), "utf-8")).toBe(
			newContent,
		);
	});
});
