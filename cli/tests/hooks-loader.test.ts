import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";
import {
	extractScriptName,
	loadDisabledHooks,
	resolveHookNames,
	writeDisabledHooks,
} from "../src/loaders/hooks-loader.js";
import type { PluginInfo } from "../src/schemas/plugin.js";

function makeTempDir(): string {
	return mkdtempSync(resolve(tmpdir(), "codeforge-hooks-test-"));
}

function makePlugin(overrides: Partial<PluginInfo> = {}): PluginInfo {
	return {
		name: "test-plugin",
		marketplace: "test-mp",
		qualifiedName: "test-plugin@test-mp",
		enabled: true,
		version: "1.0.0",
		installPath: "/tmp/test",
		description: "Test plugin",
		author: "test",
		installedAt: "2026-01-01",
		hooks: [],
		agents: [],
		skills: [],
		scripts: [],
		...overrides,
	};
}

describe("extractScriptName", () => {
	test("extracts basename from path argument", () => {
		expect(
			extractScriptName("/usr/local/bin/guard-workspace-scope"),
		).toBe("guard-workspace-scope");
	});

	test("extracts script from complex command and strips .py", () => {
		expect(
			extractScriptName("python3 /path/to/scripts/my-hook.py"),
		).toBe("my-hook");
	});

	test("returns last word when no path segments", () => {
		expect(extractScriptName("simple-command")).toBe("simple-command");
	});

	test("handles command with arguments after path", () => {
		expect(extractScriptName("bash /scripts/run.sh --verbose")).toBe(
			"run.sh",
		);
	});

	test("strips .py extension from script name", () => {
		expect(
			extractScriptName("/plugins/workspace-scope-guard/scripts/guard-workspace-scope.py"),
		).toBe("guard-workspace-scope");
	});
});

describe("resolveHookNames", () => {
	const plugins: PluginInfo[] = [
		makePlugin({
			name: "workspace-scope-guard",
			qualifiedName: "workspace-scope-guard@devs-marketplace",
			hooks: [
				{
					event: "PreToolUse",
					matcher: "Write|Edit",
					commands: [
						{
							command: "/path/to/guard-workspace-scope",
							timeout: 10,
						},
					],
				},
				{
					event: "PreToolUse",
					matcher: "Bash",
					commands: [
						{
							command: "/path/to/annotate-bash-scope",
							timeout: 5,
						},
					],
				},
			],
		}),
		makePlugin({
			name: "session-context",
			qualifiedName: "session-context@devs-marketplace",
			hooks: [
				{
					event: "SessionStart",
					commands: [
						{
							command: "/path/to/git-state-injector",
							timeout: 10,
						},
					],
				},
			],
		}),
	];

	test("resolves plugin name to all hook scripts", () => {
		const result = resolveHookNames("workspace-scope-guard", plugins);
		expect(result).toContain("guard-workspace-scope");
		expect(result).toContain("annotate-bash-scope");
		expect(result).toHaveLength(2);
	});

	test("resolves qualified plugin name", () => {
		const result = resolveHookNames(
			"workspace-scope-guard@devs-marketplace",
			plugins,
		);
		expect(result).toContain("guard-workspace-scope");
		expect(result).toHaveLength(2);
	});

	test("resolves script name to itself", () => {
		const result = resolveHookNames("git-state-injector", plugins);
		expect(result).toEqual(["git-state-injector"]);
	});

	test("returns empty array for unknown name", () => {
		const result = resolveHookNames("nonexistent", plugins);
		expect(result).toEqual([]);
	});

	test("deduplicates scripts when plugin has duplicate commands", () => {
		const dupePlugins: PluginInfo[] = [
			makePlugin({
				name: "dupe-plugin",
				qualifiedName: "dupe-plugin@mp",
				hooks: [
					{
						event: "PreToolUse",
						matcher: "Write",
						commands: [
							{ command: "/path/to/my-hook", timeout: 10 },
						],
					},
					{
						event: "PreToolUse",
						matcher: "Edit",
						commands: [
							{ command: "/path/to/my-hook", timeout: 10 },
						],
					},
				],
			}),
		];
		const result = resolveHookNames("dupe-plugin", dupePlugins);
		expect(result).toEqual(["my-hook"]);
	});
});

describe("loadDisabledHooks", () => {
	test("reads and parses the disabled array", async () => {
		const dir = makeTempDir();
		const path = resolve(dir, "disabled-hooks.json");
		await Bun.write(
			path,
			JSON.stringify({ disabled: ["hook-a", "hook-b"] }),
		);

		const result = await loadDisabledHooks(path);
		expect(result).toEqual(["hook-a", "hook-b"]);

		rmSync(dir, { recursive: true });
	});

	test("returns empty array for missing file", async () => {
		const result = await loadDisabledHooks(
			"/tmp/nonexistent-codeforge-disabled-hooks.json",
		);
		expect(result).toEqual([]);
	});

	test("returns empty array for invalid JSON", async () => {
		const dir = makeTempDir();
		const path = resolve(dir, "disabled-hooks.json");
		await Bun.write(path, "not valid json {{{");

		const result = await loadDisabledHooks(path);
		expect(result).toEqual([]);

		rmSync(dir, { recursive: true });
	});

	test("returns empty array when disabled is not an array", async () => {
		const dir = makeTempDir();
		const path = resolve(dir, "disabled-hooks.json");
		await Bun.write(path, JSON.stringify({ disabled: "not-an-array" }));

		const result = await loadDisabledHooks(path);
		expect(result).toEqual([]);

		rmSync(dir, { recursive: true });
	});
});

describe("writeDisabledHooks", () => {
	test("writes valid JSON with sorted deduplicated array", async () => {
		const dir = makeTempDir();
		const path = resolve(dir, "disabled-hooks.json");

		await writeDisabledHooks(
			["hook-c", "hook-a", "hook-b", "hook-a"],
			path,
		);

		const raw = await Bun.file(path).text();
		expect(raw.endsWith("\n")).toBe(true);

		const parsed = JSON.parse(raw);
		expect(parsed.disabled).toEqual(["hook-a", "hook-b", "hook-c"]);

		// Verify 2-space indentation
		expect(raw).toContain('  "disabled"');

		rmSync(dir, { recursive: true });
	});

	test("creates parent directories if needed", async () => {
		const dir = makeTempDir();
		const path = resolve(dir, "nested/deep/disabled-hooks.json");

		await writeDisabledHooks(["hook-a"], path);

		const result = await loadDisabledHooks(path);
		expect(result).toEqual(["hook-a"]);

		rmSync(dir, { recursive: true });
	});
});

describe("round-trip", () => {
	test("write then read preserves data", async () => {
		const dir = makeTempDir();
		const path = resolve(dir, "disabled-hooks.json");

		await writeDisabledHooks(["hook-b", "hook-a", "hook-c"], path);
		const result = await loadDisabledHooks(path);

		expect(result).toEqual(["hook-a", "hook-b", "hook-c"]);

		rmSync(dir, { recursive: true });
	});

	test("disabling already-disabled hook does not duplicate", async () => {
		const dir = makeTempDir();
		const path = resolve(dir, "disabled-hooks.json");

		await writeDisabledHooks(["hook-a", "hook-b"], path);

		// Simulate disable: load, add if missing, write
		const disabled = await loadDisabledHooks(path);
		if (!disabled.includes("hook-a")) {
			disabled.push("hook-a");
		}
		await writeDisabledHooks(disabled, path);

		const result = await loadDisabledHooks(path);
		expect(result).toEqual(["hook-a", "hook-b"]);

		rmSync(dir, { recursive: true });
	});
});
