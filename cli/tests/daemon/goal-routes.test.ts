import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { Server } from "bun";
import type { DaemonConfig, GoalState } from "../../src/schemas/goal.js";
import { startServer } from "../../src/daemon/server.js";

function testConfig(tmp: string): DaemonConfig {
	return {
		host: "127.0.0.1",
		port: 0,
		dbPath: join(tmp, "daemon.db"),
		logPath: join(tmp, "logs", "daemon.log"),
		pidPath: join(tmp, "daemon.pid"),
		models: {},
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

async function startTestServer() {
	const tmp = mkdtempSync(join(tmpdir(), "goal-routes-test-"));
	const config = testConfig(tmp);
	activeServer = await startServer(config);
	const base = `http://127.0.0.1:${activeServer.port}`;
	return { tmp, base };
}

function postJson(url: string, body: Record<string, unknown>) {
	return fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("POST /goal/set", () => {
	test("returns 201 and creates a goal", async () => {
		const { tmp, base } = await startTestServer();

		const res = await postJson(`${base}/goal/set`, {
			cwd: tmp,
			objective: "Build feature",
			sessionId: "sess-1",
		});

		expect(res.status).toBe(201);

		const data = (await res.json()) as { goal: GoalState };
		expect(data.goal.id).toMatch(/^goal_/);
		expect(data.goal.status).toBe("active");
		expect(data.goal.objective).toBe("Build feature");
	});

	test("returns 409 on duplicate active goal", async () => {
		const { tmp, base } = await startTestServer();

		await postJson(`${base}/goal/set`, {
			cwd: tmp,
			objective: "First",
		});

		const res = await postJson(`${base}/goal/set`, {
			cwd: tmp,
			objective: "Second",
		});

		expect(res.status).toBe(409);

		const data = (await res.json()) as { error: string };
		expect(data.error).toContain("Active goal already exists");
	});

	test("returns 400 when missing fields", async () => {
		const { base } = await startTestServer();

		const res = await postJson(`${base}/goal/set`, { cwd: "/tmp" });
		expect(res.status).toBe(400);
	});
});

describe("GET /goal/current", () => {
	test("returns 404 when no active goal", async () => {
		const { tmp, base } = await startTestServer();

		const res = await fetch(
			`${base}/goal/current?cwd=${encodeURIComponent(tmp)}`,
		);

		expect(res.status).toBe(404);
	});

	test("returns 200 with active goal", async () => {
		const { tmp, base } = await startTestServer();

		await postJson(`${base}/goal/set`, {
			cwd: tmp,
			objective: "Active goal",
		});

		const res = await fetch(
			`${base}/goal/current?cwd=${encodeURIComponent(tmp)}`,
		);

		expect(res.status).toBe(200);

		const data = (await res.json()) as { goal: GoalState };
		expect(data.goal.objective).toBe("Active goal");
		expect(data.goal.active).toBe(true);
	});

	test("returns 400 when cwd missing", async () => {
		const { base } = await startTestServer();

		const res = await fetch(`${base}/goal/current`);
		expect(res.status).toBe(400);
	});
});

describe("POST /goal/pause", () => {
	test("returns 200 and pauses goal", async () => {
		const { tmp, base } = await startTestServer();

		await postJson(`${base}/goal/set`, {
			cwd: tmp,
			objective: "Pause me",
		});

		const res = await postJson(`${base}/goal/pause`, { cwd: tmp });
		expect(res.status).toBe(200);

		const data = (await res.json()) as { goal: GoalState };
		expect(data.goal.paused).toBe(true);
	});

	test("returns 404 when no active goal", async () => {
		const { tmp, base } = await startTestServer();

		const res = await postJson(`${base}/goal/pause`, { cwd: tmp });
		expect(res.status).toBe(404);
	});
});

describe("POST /goal/resume", () => {
	test("returns 200 and resumes paused goal", async () => {
		const { tmp, base } = await startTestServer();

		await postJson(`${base}/goal/set`, {
			cwd: tmp,
			objective: "Resume me",
		});
		await postJson(`${base}/goal/pause`, { cwd: tmp });

		const res = await postJson(`${base}/goal/resume`, { cwd: tmp });
		expect(res.status).toBe(200);

		const data = (await res.json()) as { goal: GoalState };
		expect(data.goal.paused).toBe(false);
	});

	test("returns 409 when goal is not paused", async () => {
		const { tmp, base } = await startTestServer();

		await postJson(`${base}/goal/set`, {
			cwd: tmp,
			objective: "Not paused",
		});

		const res = await postJson(`${base}/goal/resume`, { cwd: tmp });
		expect(res.status).toBe(409);
	});
});

describe("POST /goal/clear", () => {
	test("returns 200 and clears goal", async () => {
		const { tmp, base } = await startTestServer();

		await postJson(`${base}/goal/set`, {
			cwd: tmp,
			objective: "Clear me",
		});

		const res = await postJson(`${base}/goal/clear`, { cwd: tmp });
		expect(res.status).toBe(200);

		const data = (await res.json()) as { goal: GoalState };
		expect(data.goal.status).toBe("cleared");
		expect(data.goal.active).toBe(false);
	});

	test("goal no longer returned by /goal/current after clear", async () => {
		const { tmp, base } = await startTestServer();

		await postJson(`${base}/goal/set`, {
			cwd: tmp,
			objective: "Gone soon",
		});
		await postJson(`${base}/goal/clear`, { cwd: tmp });

		const res = await fetch(
			`${base}/goal/current?cwd=${encodeURIComponent(tmp)}`,
		);
		expect(res.status).toBe(404);
	});
});

describe("POST /events/hook", () => {
	test("returns 201 and records event", async () => {
		const { tmp, base } = await startTestServer();

		const res = await postJson(`${base}/events/hook`, {
			goalId: "goal_abc",
			sessionId: "sess-1",
			cwd: tmp,
			kind: "hook_event",
			payload: { hook: "Stop" },
		});

		expect(res.status).toBe(201);
		const data = (await res.json()) as { ok: boolean };
		expect(data.ok).toBe(true);
	});

	test("returns 400 when missing required fields", async () => {
		const { base } = await startTestServer();

		const res = await postJson(`${base}/events/hook`, { cwd: "/tmp" });
		expect(res.status).toBe(400);
	});
});

describe("POST /events/tool", () => {
	test("returns 201 and records tool event", async () => {
		const { tmp, base } = await startTestServer();

		const res = await postJson(`${base}/events/tool`, {
			goalId: "goal_abc",
			sessionId: "sess-1",
			cwd: tmp,
			toolName: "Bash",
			status: "ok",
			input: { command: "bun test" },
		});

		expect(res.status).toBe(201);
		const data = (await res.json()) as { ok: boolean };
		expect(data.ok).toBe(true);
	});
});
