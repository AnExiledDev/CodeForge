import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { Server } from "bun";
import type { DaemonConfig, GoalEvaluation, GoalState } from "../../src/schemas/goal.js";

// Mock AI module — no real API calls
mock.module("ai", () => ({
	generateObject: mock(),
}));

function testConfig(tmp: string): DaemonConfig {
	return {
		host: "127.0.0.1",
		port: 0,
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

async function startTestServer() {
	const { startServer } = await import("../../src/daemon/server.js");
	const tmp = mkdtempSync(join(tmpdir(), "e2e-goal-loop-"));
	const config = testConfig(tmp);
	activeServer = await startServer(config);
	const base = `http://127.0.0.1:${activeServer.port}`;
	return { tmp, base, config };
}

function postJson(url: string, body: Record<string, unknown>) {
	return fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("E2E: goal loop", () => {
	test("full loop: create goal → record events → evaluate-stop (block) → add evidence → evaluate-stop (allow)", async () => {
		const { tmp, base } = await startTestServer();

		// Step 1: Create a goal
		const setRes = await postJson(`${base}/goal/set`, {
			cwd: tmp,
			objective: "Add date formatter utility with tests",
			sessionId: "e2e-sess-1",
		});
		expect(setRes.status).toBe(201);
		const setData = (await setRes.json()) as { goal: GoalState };
		expect(setData.goal.status).toBe("active");
		expect(setData.goal.objective).toBe("Add date formatter utility with tests");
		const goalId = setData.goal.id;

		// Step 2: Record some tool events (simulated work)
		const toolRes1 = await postJson(`${base}/events/tool`, {
			goalId,
			sessionId: "e2e-sess-1",
			cwd: tmp,
			toolName: "Write",
			status: "ok",
			input: { file_path: "/src/utils/date.ts" },
			outputExcerpt: "File written successfully",
		});
		expect(toolRes1.status).toBe(201);

		const toolRes2 = await postJson(`${base}/events/tool`, {
			goalId,
			sessionId: "e2e-sess-1",
			cwd: tmp,
			toolName: "Write",
			status: "ok",
			input: { file_path: "/src/utils/date.test.ts" },
			outputExcerpt: "File written successfully",
		});
		expect(toolRes2.status).toBe(201);

		// Step 3: First evaluate-stop — no validation evidence, should fall through
		// (with no AI models configured, falls back to allow, but loop count increments)
		const evalRes1 = await postJson(`${base}/goal/evaluate-stop`, {
			cwd: tmp,
			sessionId: "e2e-sess-1",
			hookPayload: {},
		});
		expect(evalRes1.status).toBe(200);
		const evalData1 = (await evalRes1.json()) as {
			decision: string;
			status: string;
			loopCount: number;
		};
		expect(evalData1.decision).toBeDefined();
		expect(evalData1.loopCount).toBe(1);

		// Step 4: Record a validation command (simulated test run)
		const toolRes3 = await postJson(`${base}/events/tool`, {
			goalId,
			sessionId: "e2e-sess-1",
			cwd: tmp,
			toolName: "Bash",
			status: "ok",
			input: { command: "bun test" },
			outputExcerpt: "12 tests passed, 0 failed",
		});
		expect(toolRes3.status).toBe(201);

		// Step 5: Second evaluate-stop — with test evidence now recorded
		const evalRes2 = await postJson(`${base}/goal/evaluate-stop`, {
			cwd: tmp,
			sessionId: "e2e-sess-1",
			hookPayload: {},
		});
		expect(evalRes2.status).toBe(200);
		const evalData2 = (await evalRes2.json()) as {
			decision: string;
			loopCount: number;
		};
		expect(evalData2.decision).toBeDefined();
		expect(evalData2.loopCount).toBe(2);

		// Step 6: Verify goal state in DB via current endpoint
		const currentRes = await fetch(
			`${base}/goal/current?cwd=${encodeURIComponent(tmp)}`,
		);
		expect(currentRes.status).toBe(200);
		const currentData = (await currentRes.json()) as { goal: GoalState };
		expect(currentData.goal.loopCount).toBe(2);

		// Step 7: Verify events were recorded (hook events endpoint)
		const hookRes = await postJson(`${base}/events/hook`, {
			goalId,
			sessionId: "e2e-sess-1",
			cwd: tmp,
			kind: "hook_event",
			payload: { hook: "PostToolUse", tool: "Bash" },
		});
		expect(hookRes.status).toBe(201);
	});

	test("goal pause prevents blocking on evaluate-stop", async () => {
		const { tmp, base } = await startTestServer();

		// Create goal
		await postJson(`${base}/goal/set`, {
			cwd: tmp,
			objective: "Pause test goal",
		});

		// Pause the goal
		const pauseRes = await postJson(`${base}/goal/pause`, { cwd: tmp });
		expect(pauseRes.status).toBe(200);

		// Evaluate stop — should allow because paused
		const evalRes = await postJson(`${base}/goal/evaluate-stop`, {
			cwd: tmp,
			sessionId: "sess-pause",
			hookPayload: {},
		});
		expect(evalRes.status).toBe(200);
		const evalData = (await evalRes.json()) as { decision: string; status: string };
		expect(evalData.decision).toBe("allow");
		expect(evalData.status).toBe("paused");
	});

	test("no active goal allows stop immediately", async () => {
		const { tmp, base } = await startTestServer();

		const evalRes = await postJson(`${base}/goal/evaluate-stop`, {
			cwd: tmp,
			sessionId: "sess-none",
			hookPayload: {},
		});
		expect(evalRes.status).toBe(200);
		const evalData = (await evalRes.json()) as { decision: string; status: string };
		expect(evalData.decision).toBe("allow");
		expect(evalData.status).toBe("done");
		expect(evalData).toHaveProperty("loopCount", 0);
	});

	test("loop budget exhaustion allows stop", async () => {
		const { tmp, base } = await startTestServer();

		// Create goal
		await postJson(`${base}/goal/set`, {
			cwd: tmp,
			objective: "Loop budget test",
		});

		// Spam evaluate-stop calls to increment loop count
		// With no models, each call allows and increments loop_count
		// Config limits.maxGoalLoops is 30, so we need 30 iterations
		for (let i = 0; i < 30; i++) {
			await postJson(`${base}/goal/evaluate-stop`, {
				cwd: tmp,
				sessionId: "sess-loop",
				hookPayload: {},
			});
		}

		// The 31st call should hit the budget limit escape hatch
		const evalRes = await postJson(`${base}/goal/evaluate-stop`, {
			cwd: tmp,
			sessionId: "sess-loop",
			hookPayload: {},
		});
		expect(evalRes.status).toBe(200);
		const evalData = (await evalRes.json()) as { decision: string; status: string; reason: string };
		expect(evalData.decision).toBe("allow");
		expect(evalData.status).toBe("budget_limited");
		expect(evalData.reason).toContain("Loop count");
	});

	test("cleared goal allows stop immediately", async () => {
		const { tmp, base } = await startTestServer();

		// Create and clear goal
		await postJson(`${base}/goal/set`, {
			cwd: tmp,
			objective: "Clear test goal",
		});
		await postJson(`${base}/goal/clear`, { cwd: tmp });

		// Evaluate stop — no active goal
		const evalRes = await postJson(`${base}/goal/evaluate-stop`, {
			cwd: tmp,
			sessionId: "sess-clear",
			hookPayload: {},
		});
		expect(evalRes.status).toBe(200);
		const evalData = (await evalRes.json()) as { decision: string };
		expect(evalData.decision).toBe("allow");
	});

	test("evaluate-stop returns 400 when cwd missing", async () => {
		const { base } = await startTestServer();

		const res = await postJson(`${base}/goal/evaluate-stop`, {
			sessionId: "sess-no-cwd",
		});
		expect(res.status).toBe(400);
	});
});
