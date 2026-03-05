import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";
import { loadSettings, writeSettings } from "../src/loaders/config-loader.js";

function makeTempDir(): string {
	return mkdtempSync(resolve(tmpdir(), "codeforge-test-"));
}

describe("loadSettings", () => {
	test("reads and parses settings.json", async () => {
		const dir = makeTempDir();
		const path = resolve(dir, "settings.json");
		await Bun.write(
			path,
			JSON.stringify({ enabledPlugins: { "test@mp": true } }),
		);

		const result = await loadSettings(path);
		expect(result.enabledPlugins).toEqual({ "test@mp": true });

		rmSync(dir, { recursive: true });
	});

	test("returns empty object for missing file", async () => {
		const result = await loadSettings(
			"/tmp/nonexistent-codeforge-settings.json",
		);
		expect(result).toEqual({});
	});

	test("returns empty object for invalid JSON", async () => {
		const dir = makeTempDir();
		const path = resolve(dir, "settings.json");
		await Bun.write(path, "not valid json {{{");

		const result = await loadSettings(path);
		expect(result).toEqual({});

		rmSync(dir, { recursive: true });
	});
});

describe("writeSettings", () => {
	test("writes valid JSON with 2-space indentation and trailing newline", async () => {
		const dir = makeTempDir();
		const path = resolve(dir, "settings.json");

		await writeSettings(path, { enabledPlugins: { "test@mp": true } });

		const raw = await Bun.file(path).text();
		expect(raw.endsWith("\n")).toBe(true);

		const parsed = JSON.parse(raw);
		expect(parsed.enabledPlugins["test@mp"]).toBe(true);

		// Verify 2-space indentation
		expect(raw).toContain('  "enabledPlugins"');

		rmSync(dir, { recursive: true });
	});

	test("creates parent directories if needed", async () => {
		const dir = makeTempDir();
		const path = resolve(dir, "nested/deep/settings.json");

		await writeSettings(path, { env: { FOO: "bar" } });

		const result = await loadSettings(path);
		expect(result.env?.FOO).toBe("bar");

		rmSync(dir, { recursive: true });
	});
});

describe("round-trip", () => {
	test("write then read preserves data", async () => {
		const dir = makeTempDir();
		const path = resolve(dir, "settings.json");

		const original = {
			enabledPlugins: {
				"plugin-a@marketplace-1": true,
				"plugin-b@marketplace-2": false,
			},
			env: { NODE_ENV: "production" },
			permissions: {
				allow: ["read", "write"],
				deny: ["delete"],
			},
		};

		await writeSettings(path, original);
		const result = await loadSettings(path);

		expect(result.enabledPlugins).toEqual(original.enabledPlugins);
		expect(result.env).toEqual(original.env);
		expect(result.permissions).toEqual(original.permissions);

		rmSync(dir, { recursive: true });
	});

	test("preserves other settings when updating enabledPlugins", async () => {
		const dir = makeTempDir();
		const path = resolve(dir, "settings.json");

		await writeSettings(path, {
			env: { KEY: "value" },
			enabledPlugins: { "old@mp": true },
		});

		const settings = await loadSettings(path);
		if (!settings.enabledPlugins) {
			settings.enabledPlugins = {};
		}
		settings.enabledPlugins["new@mp"] = false;
		await writeSettings(path, settings);

		const result = await loadSettings(path);
		expect(result.env?.KEY).toBe("value");
		expect(result.enabledPlugins?.["old@mp"]).toBe(true);
		expect(result.enabledPlugins?.["new@mp"]).toBe(false);

		rmSync(dir, { recursive: true });
	});
});
