import { describe, expect, test } from "bun:test";
import {
	formatPluginListJson,
	formatPluginListText,
} from "../src/output/plugin-list.js";
import {
	formatPluginShowJson,
	formatPluginShowText,
} from "../src/output/plugin-show.js";
import type { PluginInfo } from "../src/schemas/plugin.js";

const makePlugin = (overrides?: Partial<PluginInfo>): PluginInfo => ({
	name: "test-plugin",
	marketplace: "test-marketplace",
	qualifiedName: "test-plugin@test-marketplace",
	enabled: true,
	version: "1.0.0",
	installPath: "/tmp/test-plugin",
	description: "A test plugin",
	author: "Test Author",
	installedAt: "2026-03-01T00:00:00.000Z",
	hooks: [],
	agents: [],
	skills: [],
	scripts: [],
	...overrides,
});

describe("formatPluginListText", () => {
	test("includes plugin name in output", () => {
		const output = formatPluginListText([makePlugin()], { noColor: true });
		expect(output).toContain("test-plugin");
	});

	test("shows enabled for enabled plugins", () => {
		const output = formatPluginListText([makePlugin({ enabled: true })], {
			noColor: true,
		});
		expect(output).toContain("enabled");
	});

	test("shows disabled for disabled plugins", () => {
		const output = formatPluginListText([makePlugin({ enabled: false })], {
			noColor: true,
		});
		expect(output).toContain("disabled");
	});

	test("includes summary count", () => {
		const plugins = [
			makePlugin({ name: "plugin-a" }),
			makePlugin({ name: "plugin-b", enabled: false }),
		];
		const output = formatPluginListText(plugins, { noColor: true });
		expect(output).toContain("2 plugins");
		expect(output).toContain("1 enabled");
		expect(output).toContain("1 disabled");
	});

	test("includes marketplace name", () => {
		const output = formatPluginListText(
			[makePlugin({ marketplace: "my-marketplace" })],
			{ noColor: true },
		);
		expect(output).toContain("my-marketplace");
	});

	test("shows hook/agent/skill counts", () => {
		const plugin = makePlugin({
			hooks: [
				{
					event: "onSave",
					commands: [{ command: "echo hi", timeout: 10 }],
				},
			],
			agents: [
				{ name: "explorer", description: "test", filename: "explorer.md" },
			],
		});
		const output = formatPluginListText([plugin], { noColor: true });
		expect(output).toContain("1");
	});
});

describe("formatPluginListJson", () => {
	test("returns valid JSON array", () => {
		const output = formatPluginListJson([makePlugin()]);
		const parsed = JSON.parse(output);
		expect(Array.isArray(parsed)).toBe(true);
		expect(parsed.length).toBe(1);
	});

	test("includes expected fields", () => {
		const output = formatPluginListJson([makePlugin()]);
		const parsed = JSON.parse(output);
		expect(parsed[0].name).toBe("test-plugin");
		expect(parsed[0].marketplace).toBe("test-marketplace");
		expect(parsed[0].qualifiedName).toBe("test-plugin@test-marketplace");
		expect(parsed[0].enabled).toBe(true);
		expect(parsed[0].version).toBe("1.0.0");
		expect(parsed[0].hookCount).toBe(0);
		expect(parsed[0].agentCount).toBe(0);
		expect(parsed[0].skillCount).toBe(0);
	});

	test("reflects disabled state", () => {
		const output = formatPluginListJson([makePlugin({ enabled: false })]);
		const parsed = JSON.parse(output);
		expect(parsed[0].enabled).toBe(false);
	});
});

describe("formatPluginShowText", () => {
	test("shows plugin name", () => {
		const output = formatPluginShowText(makePlugin(), { noColor: true });
		expect(output).toContain("test-plugin");
	});

	test("shows plugin description", () => {
		const output = formatPluginShowText(
			makePlugin({ description: "Does amazing things" }),
			{ noColor: true },
		);
		expect(output).toContain("Does amazing things");
	});

	test("shows version", () => {
		const output = formatPluginShowText(makePlugin({ version: "2.5.0" }), {
			noColor: true,
		});
		expect(output).toContain("2.5.0");
	});

	test("shows enabled status", () => {
		const output = formatPluginShowText(makePlugin({ enabled: true }), {
			noColor: true,
		});
		expect(output).toContain("enabled");
	});

	test("shows disabled status", () => {
		const output = formatPluginShowText(makePlugin({ enabled: false }), {
			noColor: true,
		});
		expect(output).toContain("disabled");
	});

	test("shows install path", () => {
		const output = formatPluginShowText(
			makePlugin({ installPath: "/home/user/.claude/plugins/my-plugin" }),
			{ noColor: true },
		);
		expect(output).toContain("/home/user/.claude/plugins/my-plugin");
	});

	test("shows hooks section when hooks exist", () => {
		const plugin = makePlugin({
			hooks: [
				{
					event: "PostToolUse",
					matcher: "Write",
					commands: [{ command: "/bin/lint.sh", timeout: 30 }],
				},
			],
		});
		const output = formatPluginShowText(plugin, { noColor: true });
		expect(output).toContain("Hooks (1)");
		expect(output).toContain("PostToolUse");
	});

	test("shows agents section when agents exist", () => {
		const plugin = makePlugin({
			agents: [
				{
					name: "explorer",
					description: "Explore code",
					filename: "explorer.md",
				},
			],
		});
		const output = formatPluginShowText(plugin, { noColor: true });
		expect(output).toContain("Agents (1)");
		expect(output).toContain("explorer");
	});

	test("shows skills section when skills exist", () => {
		const plugin = makePlugin({
			skills: [
				{ name: "ast-grep", description: "AST search", dirname: "ast-grep" },
			],
		});
		const output = formatPluginShowText(plugin, { noColor: true });
		expect(output).toContain("Skills (1)");
		expect(output).toContain("ast-grep");
	});
});

describe("formatPluginShowJson", () => {
	test("returns full plugin data as valid JSON", () => {
		const plugin = makePlugin();
		const output = formatPluginShowJson(plugin);
		const parsed = JSON.parse(output);
		expect(parsed.name).toBe("test-plugin");
		expect(parsed.marketplace).toBe("test-marketplace");
		expect(parsed.qualifiedName).toBe("test-plugin@test-marketplace");
		expect(parsed.enabled).toBe(true);
		expect(parsed.version).toBe("1.0.0");
		expect(parsed.description).toBe("A test plugin");
		expect(parsed.author).toBe("Test Author");
		expect(parsed.installPath).toBe("/tmp/test-plugin");
		expect(Array.isArray(parsed.hooks)).toBe(true);
		expect(Array.isArray(parsed.agents)).toBe(true);
		expect(Array.isArray(parsed.skills)).toBe(true);
		expect(Array.isArray(parsed.scripts)).toBe(true);
	});

	test("includes nested hook data", () => {
		const plugin = makePlugin({
			hooks: [
				{
					event: "onSave",
					matcher: "*.ts",
					commands: [{ command: "bun lint", timeout: 15 }],
				},
			],
		});
		const output = formatPluginShowJson(plugin);
		const parsed = JSON.parse(output);
		expect(parsed.hooks[0].event).toBe("onSave");
		expect(parsed.hooks[0].matcher).toBe("*.ts");
		expect(parsed.hooks[0].commands[0].command).toBe("bun lint");
	});
});
