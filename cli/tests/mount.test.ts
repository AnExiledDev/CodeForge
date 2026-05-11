import {
	afterEach,
	beforeEach,
	describe,
	expect,
	spyOn,
	test,
} from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Command } from "commander";
import { registerMountAddCommand } from "../src/commands/mount/add.js";
import { registerMountListCommand } from "../src/commands/mount/list.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_ROOT = "/tmp/mount-test-workspace";
const CODEFORGE_DIR = join(TEST_ROOT, ".codeforge");
const MOUNTS_PATH = join(CODEFORGE_DIR, "mounts.json");
const DEVCONTAINER_DIR = join(TEST_ROOT, ".devcontainer");
const COMPOSE_PATH = join(DEVCONTAINER_DIR, "docker-compose.yml");

function setupTestWorkspace(): void {
	rmSync(TEST_ROOT, { recursive: true, force: true });
	mkdirSync(join(TEST_ROOT, "projects", "my-app", "node_modules"), {
		recursive: true,
	});
	mkdirSync(CODEFORGE_DIR, { recursive: true });
}

function cleanTestWorkspace(): void {
	rmSync(TEST_ROOT, { recursive: true, force: true });
}

async function runMountAdd(path: string): Promise<void> {
	const program = new Command();
	const mount = program.command("mount");
	registerMountAddCommand(mount);
	await program.parseAsync(["node", "test", "mount", "add", path]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("mount add", () => {
	let logSpy: ReturnType<typeof spyOn>;
	let errorSpy: ReturnType<typeof spyOn>;
	let exitSpy: ReturnType<typeof spyOn>;
	let originalWorkspaceRoot: string | undefined;

	beforeEach(() => {
		setupTestWorkspace();
		logSpy = spyOn(console, "log").mockImplementation(() => {});
		errorSpy = spyOn(console, "error").mockImplementation(() => {});
		exitSpy = spyOn(process, "exit").mockImplementation((() => {
			throw new Error("process.exit called");
		}) as any);
		originalWorkspaceRoot = process.env.WORKSPACE_ROOT;
		process.env.WORKSPACE_ROOT = TEST_ROOT;
	});

	afterEach(() => {
		logSpy.mockRestore();
		errorSpy.mockRestore();
		exitSpy.mockRestore();
		if (originalWorkspaceRoot !== undefined) {
			process.env.WORKSPACE_ROOT = originalWorkspaceRoot;
		} else {
			delete process.env.WORKSPACE_ROOT;
		}
		cleanTestWorkspace();
	});

	test("writes entry to mounts.json with source 'user'", async () => {
		await runMountAdd("projects/my-app/node_modules");

		const raw = await readFile(MOUNTS_PATH, "utf-8");
		const mounts = JSON.parse(raw);

		expect(mounts.version).toBe(1);
		expect(mounts.volumes).toHaveLength(1);
		expect(mounts.volumes[0].path).toBe("projects/my-app/node_modules");
		expect(mounts.volumes[0].source).toBe("user");
		expect(mounts.volumes[0].signal).toBe("manual");
		expect(mounts.volumes[0].added).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	test("rejects non-existent paths", async () => {
		expect(
			runMountAdd("projects/nonexistent/node_modules"),
		).rejects.toThrow();
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	test("rejects duplicate entries gracefully", async () => {
		// Pre-populate mounts.json
		writeFileSync(
			MOUNTS_PATH,
			JSON.stringify({
				version: 1,
				volumes: [
					{
						path: "projects/my-app/node_modules",
						source: "auto",
						signal: "package.json",
						added: "2026-01-01",
					},
				],
			}),
		);

		await runMountAdd("projects/my-app/node_modules");

		// Should not have exited with error
		expect(exitSpy).not.toHaveBeenCalled();

		// Should still have exactly one entry (not duplicated)
		const raw = await readFile(MOUNTS_PATH, "utf-8");
		const mounts = JSON.parse(raw);
		expect(mounts.volumes).toHaveLength(1);
	});

	test("shows rebuild guidance in output", async () => {
		await runMountAdd("projects/my-app/node_modules");

		const allOutput = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(allOutput).toContain("rebuild");
		expect(allOutput).toContain("Rebuild Container");
	});

	test("registers as a subcommand of mount", () => {
		const program = new Command();
		const mount = program.command("mount");
		registerMountAddCommand(mount);

		const addCmd = mount.commands.find((c) => c.name() === "add");
		expect(addCmd).toBeDefined();
		expect(addCmd!.description()).toContain("volume");
	});
});

// ---------------------------------------------------------------------------
// mount list
// ---------------------------------------------------------------------------

describe("mount list", () => {
	let logSpy: ReturnType<typeof spyOn>;
	let originalWorkspaceRoot: string | undefined;

	beforeEach(() => {
		setupTestWorkspace();
		logSpy = spyOn(console, "log").mockImplementation(() => {});
		originalWorkspaceRoot = process.env.WORKSPACE_ROOT;
		process.env.WORKSPACE_ROOT = TEST_ROOT;
	});

	afterEach(() => {
		logSpy.mockRestore();
		if (originalWorkspaceRoot !== undefined) {
			process.env.WORKSPACE_ROOT = originalWorkspaceRoot;
		} else {
			delete process.env.WORKSPACE_ROOT;
		}
		cleanTestWorkspace();
	});

	async function runMountList(args: string[] = []): Promise<void> {
		const program = new Command();
		const mount = program.command("mount");
		registerMountListCommand(mount);
		await program.parseAsync(["node", "test", "mount", "list", ...args]);
	}

	test("lists entries from a pre-populated mounts.json", async () => {
		writeFileSync(
			MOUNTS_PATH,
			JSON.stringify({
				version: 1,
				volumes: [
					{
						path: "projects/my-app/node_modules",
						source: "auto",
						signal: "package.json",
						added: "2026-01-15",
					},
					{
						path: "projects/other/.venv",
						source: "user",
						signal: "manual",
						added: "2026-02-01",
					},
				],
			}),
		);

		await runMountList();

		const allOutput = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(allOutput).toContain("projects/my-app/node_modules");
		expect(allOutput).toContain("projects/other/.venv");
		expect(allOutput).toContain("PATH");
		expect(allOutput).toContain("SOURCE");
		expect(allOutput).toContain("SIGNAL");
		expect(allOutput).toContain("ADDED");
	});

	test("shows empty-state message when no mounts", async () => {
		await runMountList();

		const allOutput = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(allOutput).toContain("No mounts configured.");
	});

	test("shows tip in both populated and empty states", async () => {
		// Empty state
		await runMountList();
		let allOutput = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(allOutput).toContain("codeforge mount add");

		logSpy.mockClear();

		// Populated state
		writeFileSync(
			MOUNTS_PATH,
			JSON.stringify({
				version: 1,
				volumes: [
					{
						path: "projects/my-app/node_modules",
						source: "user",
						signal: "manual",
						added: "2026-01-01",
					},
				],
			}),
		);

		await runMountList();
		allOutput = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(allOutput).toContain("codeforge mount add");
	});

	test("json format outputs valid JSON with all fields", async () => {
		writeFileSync(
			MOUNTS_PATH,
			JSON.stringify({
				version: 1,
				volumes: [
					{
						path: "projects/my-app/node_modules",
						source: "auto",
						signal: "package.json",
						added: "2026-01-15",
					},
				],
			}),
		);

		await runMountList(["--format", "json"]);

		// First log call should be the JSON output
		const jsonOutput = logSpy.mock.calls[0][0];
		const parsed = JSON.parse(jsonOutput);
		expect(parsed.version).toBe(1);
		expect(parsed.volumes).toHaveLength(1);
		expect(parsed.volumes[0].path).toBe("projects/my-app/node_modules");
		expect(parsed.volumes[0].source).toBe("auto");
		expect(parsed.volumes[0].signal).toBe("package.json");
		expect(parsed.volumes[0].added).toBe("2026-01-15");
		expect(parsed.composeVolumes).toBeArrayOfSize(0);
	});

	test("includes compose volumes in text output", async () => {
		mkdirSync(DEVCONTAINER_DIR, { recursive: true });
		writeFileSync(
			COMPOSE_PATH,
			[
				"services:",
				"  codeforge:",
				"    volumes:",
				"      - my-config:/home/vscode/.config",
				"      - my-cache:/home/vscode/.cache",
				"      - ..:/workspaces",
				"",
			].join("\n"),
		);

		await runMountList();

		const allOutput = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(allOutput).toContain("/home/vscode/.config");
		expect(allOutput).toContain("/home/vscode/.cache");
		expect(allOutput).toContain("compose");
		expect(allOutput).toContain("my-config");
		expect(allOutput).toContain("my-cache");
		// Bind mount should not appear
		expect(allOutput).not.toContain("..:");
	});

	test("includes compose volumes in json output", async () => {
		mkdirSync(DEVCONTAINER_DIR, { recursive: true });
		writeFileSync(
			COMPOSE_PATH,
			[
				"services:",
				"  codeforge:",
				"    volumes:",
				"      - app-data:/home/vscode/.data",
				"",
			].join("\n"),
		);

		await runMountList(["--format", "json"]);

		const jsonOutput = logSpy.mock.calls[0][0];
		const parsed = JSON.parse(jsonOutput);
		expect(parsed.composeVolumes).toHaveLength(1);
		expect(parsed.composeVolumes[0].path).toBe("/home/vscode/.data");
		expect(parsed.composeVolumes[0].source).toBe("compose");
		expect(parsed.composeVolumes[0].volumeName).toBe("app-data");
	});

	test("shows compose volumes even when mounts.json is empty", async () => {
		mkdirSync(DEVCONTAINER_DIR, { recursive: true });
		writeFileSync(
			COMPOSE_PATH,
			[
				"services:",
				"  codeforge:",
				"    volumes:",
				"      - persist-vol:/home/vscode/.persist",
				"",
			].join("\n"),
		);

		await runMountList();

		const allOutput = logSpy.mock.calls.map((c) => c[0]).join("\n");
		// Should NOT show "No mounts configured" since compose volumes exist
		expect(allOutput).not.toContain("No mounts configured.");
		expect(allOutput).toContain("/home/vscode/.persist");
		expect(allOutput).toContain("compose");
	});

	test("registers as a subcommand of mount", () => {
		const program = new Command();
		const mount = program.command("mount");
		registerMountListCommand(mount);

		const listCmd = mount.commands.find((c) => c.name() === "list");
		expect(listCmd).toBeDefined();
		expect(listCmd!.description()).toContain("volume");
	});
});
