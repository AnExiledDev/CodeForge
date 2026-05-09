import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { DaemonConfig, GoalState } from "../../src/schemas/goal.js";
import { openGoalDatabase, closeGoalDatabase } from "../../src/daemon/db.js";
import { createGoal, incrementLoopCount, incrementRepeatedInstructionCount, incrementFailedValidationCount, isRepeatedInstruction, resetRepeatedInstructionCount } from "../../src/daemon/goal-manager.js";

// Mock the AI module so no real API calls are made
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

function setupTestEnv() {
	const tmp = mkdtempSync(join(tmpdir(), "evaluator-test-"));
	const config = testConfig(tmp);
	const db = openGoalDatabase(config.dbPath);
	// Create .claude/goal directory for file operations
	mkdirSync(join(tmp, ".claude", "goal"), { recursive: true });
	return { tmp, config, db };
}

describe("evaluateStop", () => {
	test("returns allow when no active goal", async () => {
		const { evaluateStop } = await import("../../src/daemon/evaluator.js");
		const { tmp, config, db } = setupTestEnv();

		const result = await evaluateStop(db, tmp, "sess-1", {}, config);

		expect(result.decision).toBe("allow");
		expect(result.status).toBe("done");
		expect(result.reason).toContain("No active goal");
		expect(result.loopCount).toBe(0);
		closeGoalDatabase(db);
	});

	test("returns allow when goal is paused", async () => {
		const { evaluateStop } = await import("../../src/daemon/evaluator.js");
		const { tmp, config, db } = setupTestEnv();

		createGoal(db, { cwd: tmp, objective: "Test paused" });
		// Pause the goal by updating the DB directly
		const goal = db.prepare("SELECT id FROM goals WHERE cwd = ? AND status = 'active'").get(tmp) as { id: string };
		const state: GoalState = {
			id: goal.id, active: true, paused: true, status: "active",
			objective: "Test paused", currentCheckpoint: "Begin work",
			loopCount: 0, maxLoops: 30, failedValidationCount: 0,
			repeatedInstructionCount: 0,
			createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
		};
		db.prepare("UPDATE goals SET paused = 1, state_json = ? WHERE id = ?")
			.run(JSON.stringify(state), goal.id);

		const result = await evaluateStop(db, tmp, "sess-1", {}, config);

		expect(result.decision).toBe("allow");
		expect(result.status).toBe("paused");
		closeGoalDatabase(db);
	});

	test("returns allow when loop_count >= maxGoalLoops", async () => {
		const { evaluateStop } = await import("../../src/daemon/evaluator.js");
		const { tmp, config, db } = setupTestEnv();

		// Use a small loop limit for testing
		config.limits.maxGoalLoops = 3;

		createGoal(db, { cwd: tmp, objective: "Test loop limit" });

		// Increment loop count to the limit
		const goal = db.prepare("SELECT id FROM goals WHERE cwd = ? AND status = 'active'").get(tmp) as { id: string };
		for (let i = 0; i < 3; i++) {
			incrementLoopCount(db, goal.id);
		}

		const result = await evaluateStop(db, tmp, "sess-1", {}, config);

		expect(result.decision).toBe("allow");
		expect(result.status).toBe("budget_limited");
		expect(result.reason).toContain("Loop count");
		closeGoalDatabase(db);
	});

	test("returns allow when repeated_instruction_count >= max", async () => {
		const { evaluateStop } = await import("../../src/daemon/evaluator.js");
		const { tmp, config, db } = setupTestEnv();

		config.limits.maxRepeatedInstructions = 2;

		createGoal(db, { cwd: tmp, objective: "Test repeated" });
		const goal = db.prepare("SELECT id FROM goals WHERE cwd = ? AND status = 'active'").get(tmp) as { id: string };

		// Increment repeated instruction count to the limit
		incrementRepeatedInstructionCount(db, goal.id);
		incrementRepeatedInstructionCount(db, goal.id);

		const result = await evaluateStop(db, tmp, "sess-1", {}, config);

		expect(result.decision).toBe("allow");
		expect(result.status).toBe("blocked");
		expect(result.reason).toContain("repeated");
		closeGoalDatabase(db);
	});

	test("returns allow when failed_validation_count >= max", async () => {
		const { evaluateStop } = await import("../../src/daemon/evaluator.js");
		const { tmp, config, db } = setupTestEnv();

		config.limits.maxFailedValidations = 2;

		createGoal(db, { cwd: tmp, objective: "Test failed validations" });
		const goal = db.prepare("SELECT id FROM goals WHERE cwd = ? AND status = 'active'").get(tmp) as { id: string };

		incrementFailedValidationCount(db, goal.id);
		incrementFailedValidationCount(db, goal.id);

		const result = await evaluateStop(db, tmp, "sess-1", {}, config);

		expect(result.decision).toBe("allow");
		expect(result.status).toBe("needs_user");
		expect(result.reason).toContain("Failed validation");
		closeGoalDatabase(db);
	});

	test("calls AI evaluator when all pre-checks pass (falls back to allow with no models)", async () => {
		const { evaluateStop } = await import("../../src/daemon/evaluator.js");
		const { tmp, config, db } = setupTestEnv();

		createGoal(db, { cwd: tmp, objective: "Test AI evaluator" });

		// No models configured — AI evaluator will fall back to allow
		const result = await evaluateStop(db, tmp, "sess-1", {}, config);

		expect(result.decision).toBe("allow");
		// Loop count should have been incremented
		const goal = db.prepare("SELECT loop_count FROM goals WHERE cwd = ? AND status = 'active'").get(tmp) as { loop_count: number };
		expect(goal.loop_count).toBe(1);
		closeGoalDatabase(db);
	});

	test("increments loop_count on every evaluation", async () => {
		const { evaluateStop } = await import("../../src/daemon/evaluator.js");
		const { tmp, config, db } = setupTestEnv();

		createGoal(db, { cwd: tmp, objective: "Test loop count" });

		await evaluateStop(db, tmp, "sess-1", {}, config);
		await evaluateStop(db, tmp, "sess-1", {}, config);

		const goal = db.prepare("SELECT loop_count FROM goals WHERE cwd = ? AND status = 'active'").get(tmp) as { loop_count: number };
		expect(goal.loop_count).toBe(2);
		closeGoalDatabase(db);
	});

	test("stores evaluation in goal_evaluations table", async () => {
		const { evaluateStop } = await import("../../src/daemon/evaluator.js");
		const { tmp, config, db } = setupTestEnv();

		createGoal(db, { cwd: tmp, objective: "Test eval storage" });

		await evaluateStop(db, tmp, "sess-1", {}, config);

		const rows = db.prepare("SELECT * FROM goal_evaluations").all() as Array<Record<string, unknown>>;
		expect(rows.length).toBeGreaterThanOrEqual(1);
		expect(rows[0].decision).toBeDefined();
		expect(rows[0].reason).toBeDefined();
		closeGoalDatabase(db);
	});

	test("escape hatch evaluations are also stored", async () => {
		const { evaluateStop } = await import("../../src/daemon/evaluator.js");
		const { tmp, config, db } = setupTestEnv();

		config.limits.maxGoalLoops = 1;

		createGoal(db, { cwd: tmp, objective: "Test escape storage" });
		const goal = db.prepare("SELECT id FROM goals WHERE cwd = ? AND status = 'active'").get(tmp) as { id: string };
		incrementLoopCount(db, goal.id);

		await evaluateStop(db, tmp, "sess-1", {}, config);

		const rows = db.prepare("SELECT * FROM goal_evaluations WHERE goal_id = ?").all(goal.id) as Array<Record<string, unknown>>;
		expect(rows.length).toBe(1);
		expect(rows[0].decision).toBe("allow");
		expect(rows[0].status).toBe("budget_limited");
		closeGoalDatabase(db);
	});
});

describe("isRepeatedInstruction", () => {
	test("detects repeated nextInstruction", () => {
		const { tmp, config, db } = setupTestEnv();
		createGoal(db, { cwd: tmp, objective: "Repeat detection" });
		const goal = db.prepare("SELECT id FROM goals WHERE cwd = ? AND status = 'active'").get(tmp) as { id: string };

		const now = new Date().toISOString();
		const sameInstruction = "Run bun test to verify changes";
		for (let i = 0; i < 3; i++) {
			db.prepare(
				`INSERT INTO goal_evaluations (goal_id, created_at, decision, status, reason, next_instruction, evidence_json)
				 VALUES (?, ?, 'continue', 'active', 'keep going', ?, '{}')`,
			).run(goal.id, now, sameInstruction);
		}

		expect(isRepeatedInstruction(db, goal.id, sameInstruction)).toBe(true);
		closeGoalDatabase(db);
	});
});

describe("resetRepeatedInstructionCount", () => {
	test("resets repeated count on new instruction", () => {
		const { tmp, config, db } = setupTestEnv();
		createGoal(db, { cwd: tmp, objective: "Reset count" });
		const goal = db.prepare("SELECT id FROM goals WHERE cwd = ? AND status = 'active'").get(tmp) as { id: string };

		// Increment count to 2
		incrementRepeatedInstructionCount(db, goal.id);
		incrementRepeatedInstructionCount(db, goal.id);

		const before = db.prepare("SELECT repeated_instruction_count FROM goals WHERE id = ?").get(goal.id) as { repeated_instruction_count: number };
		expect(before.repeated_instruction_count).toBe(2);

		resetRepeatedInstructionCount(db, goal.id);

		const after = db.prepare("SELECT repeated_instruction_count FROM goals WHERE id = ?").get(goal.id) as { repeated_instruction_count: number };
		expect(after.repeated_instruction_count).toBe(0);
		closeGoalDatabase(db);
	});
});
