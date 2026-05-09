import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { Server } from "bun";
import type { DaemonConfig, HealthResponse, StatusResponse } from "../../src/schemas/goal.js";
import { startServer } from "../../src/daemon/server.js";
import { closeGoalDatabase } from "../../src/daemon/db.js";

function testConfig(tmp: string): DaemonConfig {
	return {
		host: "127.0.0.1",
		port: 0, // random available port
		dbPath: join(tmp, "daemon.db"),
		logPath: join(tmp, "logs", "daemon.log"),
		pidPath: join(tmp, "daemon.pid"),
		models: { planner: [], evaluator: [] },
		limits: {
			maxGoalLoops: 30,
			maxRepeatedInstructions: 3,
			maxFailedValidations: 5,
			maxJobRuntimeSeconds: 300,
			maxHookOutputChars: 8000,
		},
	};
}

let activeServer: Server | null = null;

afterEach(() => {
	if (activeServer) {
		activeServer.stop(true);
		activeServer = null;
	}
});

describe("startServer", () => {
	test("/health returns 200 with correct JSON shape", async () => {
		const tmp = mkdtempSync(join(tmpdir(), "srv-test-"));
		const config = testConfig(tmp);
		activeServer = await startServer(config);
		const port = activeServer.port;

		const res = await fetch(`http://127.0.0.1:${port}/health`);
		expect(res.status).toBe(200);

		const body = (await res.json()) as HealthResponse;
		expect(body.status).toBe("ok");
		expect(body.version).toBe("1.0.0");
		expect(typeof body.uptime).toBe("number");
		expect(body.db).toBe("connected");
		expect(typeof body.pid).toBe("number");
	});

	test("/status returns 200 with daemon info", async () => {
		const tmp = mkdtempSync(join(tmpdir(), "srv-test-"));
		const config = testConfig(tmp);
		activeServer = await startServer(config);
		const port = activeServer.port;

		const res = await fetch(`http://127.0.0.1:${port}/status`);
		expect(res.status).toBe(200);

		const body = (await res.json()) as StatusResponse;
		expect(body.daemon).toBe("running");
		expect(typeof body.port).toBe("number");
		expect(body.db.path).toBe(config.dbPath);
		expect(typeof body.db.size).toBe("number");
		expect(body.activeGoal).toBeNull();
		expect(typeof body.uptime).toBe("number");
	});

	test("unknown route returns 404", async () => {
		const tmp = mkdtempSync(join(tmpdir(), "srv-test-"));
		const config = testConfig(tmp);
		activeServer = await startServer(config);
		const port = activeServer.port;

		const res = await fetch(`http://127.0.0.1:${port}/nonexistent`);
		expect(res.status).toBe(404);

		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("Not found");
	});

	test("refuses to bind non-loopback address", async () => {
		const tmp = mkdtempSync(join(tmpdir(), "srv-test-"));
		const config = testConfig(tmp);
		config.host = "0.0.0.0";

		expect(startServer(config)).rejects.toThrow("non-loopback");
	});

	test("creates DB file on startup", async () => {
		const tmp = mkdtempSync(join(tmpdir(), "srv-test-"));
		const config = testConfig(tmp);
		activeServer = await startServer(config);

		expect(existsSync(config.dbPath)).toBe(true);
	});
});
