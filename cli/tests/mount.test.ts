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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_ROOT = "/tmp/mount-test-workspace";
const CODEFORGE_DIR = join(TEST_ROOT, ".codeforge");
const MOUNTS_PATH = join(CODEFORGE_DIR, "mounts.json");

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
