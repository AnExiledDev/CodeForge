import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { patchSettings, hasGoalHooks } from "../../src/daemon/templates/settings-patch.js";

let tmpDir: string;

beforeEach(() => {
	tmpDir = join(import.meta.dir, ".tmp-settings-patch-" + Date.now());
	mkdirSync(join(tmpDir, ".claude"), { recursive: true });
});

afterEach(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

describe("patchSettings", () => {
	test("creates settings.json when it does not exist", () => {
		const result = patchSettings(tmpDir);

		expect(result.created).toBe(true);
		expect(result.patched).toBe(true);
		expect(result.backedUp).toBe(false);

		const settingsPath = join(tmpDir, ".claude", "settings.json");
		expect(existsSync(settingsPath)).toBe(true);

		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		expect(settings.hooks).toBeDefined();
		expect(settings.hooks.Stop).toHaveLength(1);
		expect(settings.hooks.SessionStart).toHaveLength(1);
		expect(settings.hooks.PostToolUse).toHaveLength(1);
		expect(settings.hooks.UserPromptSubmit).toHaveLength(1);

		expect(settings.hooks.Stop[0].hooks[0].command).toBe(
			"bun run .claude/hooks/goal-stop.ts",
		);
	});

	test("merges with existing hooks in settings.json", () => {
		const settingsPath = join(tmpDir, ".claude", "settings.json");
		const existing = {
			hooks: {
				Stop: [
					{
						matcher: "",
						hooks: [{ type: "command", command: "echo existing-stop" }],
					},
				],
			},
		};
		writeFileSync(settingsPath, JSON.stringify(existing, null, 2));

		const result = patchSettings(tmpDir);

		expect(result.patched).toBe(true);
		expect(result.backedUp).toBe(true);

		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		// Existing hook preserved
		expect(settings.hooks.Stop).toHaveLength(2);
		expect(settings.hooks.Stop[0].hooks[0].command).toBe("echo existing-stop");
		expect(settings.hooks.Stop[1].hooks[0].command).toBe(
			"bun run .claude/hooks/goal-stop.ts",
		);
		// New hooks added
		expect(settings.hooks.SessionStart).toHaveLength(1);
	});

	test("preserves unrelated keys", () => {
		const settingsPath = join(tmpDir, ".claude", "settings.json");
		const existing = {
			enabledPlugins: { "my-plugin": true },
			customKey: "hello",
		};
		writeFileSync(settingsPath, JSON.stringify(existing, null, 2));

		patchSettings(tmpDir);

		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		expect(settings.enabledPlugins).toEqual({ "my-plugin": true });
		expect(settings.customKey).toBe("hello");
		expect(settings.hooks).toBeDefined();
	});

	test("updates existing goal hooks in place (no duplicates)", () => {
		const settingsPath = join(tmpDir, ".claude", "settings.json");
		// First patch
		patchSettings(tmpDir);
		// Second patch
		const result = patchSettings(tmpDir);

		expect(result.patched).toBe(false);
		expect(result.backedUp).toBe(false);

		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		expect(settings.hooks.Stop).toHaveLength(1);
		expect(settings.hooks.SessionStart).toHaveLength(1);
		expect(settings.hooks.PostToolUse).toHaveLength(1);
		expect(settings.hooks.UserPromptSubmit).toHaveLength(1);
	});

	test("appends to existing hooks array", () => {
		const settingsPath = join(tmpDir, ".claude", "settings.json");
		const existing = {
			hooks: {
				PostToolUse: [
					{
						matcher: "Bash",
						hooks: [{ type: "command", command: "echo bash-hook" }],
					},
				],
			},
		};
		writeFileSync(settingsPath, JSON.stringify(existing, null, 2));

		patchSettings(tmpDir);

		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		expect(settings.hooks.PostToolUse).toHaveLength(2);
		expect(settings.hooks.PostToolUse[0].matcher).toBe("Bash");
		expect(settings.hooks.PostToolUse[1].hooks[0].command).toBe(
			"bun run .claude/hooks/goal-post-tool.ts",
		);
	});

	test("creates .bak backup when modifying existing file", () => {
		const settingsPath = join(tmpDir, ".claude", "settings.json");
		writeFileSync(settingsPath, JSON.stringify({ existing: true }, null, 2));

		patchSettings(tmpDir);

		const bakPath = `${settingsPath}.bak`;
		expect(existsSync(bakPath)).toBe(true);
		const bakContent = JSON.parse(readFileSync(bakPath, "utf-8"));
		expect(bakContent.existing).toBe(true);
	});
});

describe("hasGoalHooks", () => {
	test("returns false when settings.json does not exist", () => {
		expect(hasGoalHooks(tmpDir)).toBe(false);
	});

	test("returns false when hooks are missing", () => {
		const settingsPath = join(tmpDir, ".claude", "settings.json");
		writeFileSync(settingsPath, JSON.stringify({ hooks: {} }, null, 2));
		expect(hasGoalHooks(tmpDir)).toBe(false);
	});

	test("returns true when all goal hooks are registered", () => {
		patchSettings(tmpDir);
		expect(hasGoalHooks(tmpDir)).toBe(true);
	});
});
