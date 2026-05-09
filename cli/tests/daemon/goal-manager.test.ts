import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { closeGoalDatabase, openGoalDatabase } from "../../src/daemon/db.js";
import {
	GoalConflictError,
	GoalNotFoundError,
	InvalidTransitionError,
	clearGoal,
	completeGoal,
	createGoal,
	getActiveGoal,
	getGoal,
	incrementLoopCount,
	listRecentGoals,
	pauseGoal,
	resumeGoal,
} from "../../src/daemon/goal-manager.js";
import type { GoalState } from "../../src/schemas/goal.js";

function setup() {
	const tmp = mkdtempSync(join(tmpdir(), "goal-mgr-test-"));
	const dbPath = join(tmp, "test.db");
	const db = openGoalDatabase(dbPath);
	return { tmp, db };
}

describe("createGoal", () => {
	test("inserts row and returns goal", () => {
		const { tmp, db } = setup();
		const goal = createGoal(db, {
			cwd: tmp,
			objective: "Build feature X",
			sessionId: "sess-1",
		});

		expect(goal.id).toMatch(/^goal_/);
		expect(goal.cwd).toBe(tmp);
		expect(goal.objective).toBe("Build feature X");
		expect(goal.status).toBe("active");
		expect(goal.paused).toBe(0);
		expect(goal.loop_count).toBe(0);
		expect(goal.session_id).toBe("sess-1");
		closeGoalDatabase(db);
	});

	test("writes state.json to disk", () => {
		const { tmp, db } = setup();
		createGoal(db, { cwd: tmp, objective: "Test artifacts" });

		const statePath = join(tmp, ".claude", "goal", "state.json");
		expect(existsSync(statePath)).toBe(true);

		const state = JSON.parse(readFileSync(statePath, "utf-8")) as GoalState;
		expect(state.active).toBe(true);
		expect(state.status).toBe("active");
		expect(state.objective).toBe("Test artifacts");
		closeGoalDatabase(db);
	});

	test("writes progress.md to disk", () => {
		const { tmp, db } = setup();
		createGoal(db, { cwd: tmp, objective: "Test progress" });

		const progressPath = join(tmp, ".claude", "goal", "progress.md");
		expect(existsSync(progressPath)).toBe(true);

		const content = readFileSync(progressPath, "utf-8");
		expect(content).toContain("Goal Progress");
		expect(content).toContain("Test progress");
		closeGoalDatabase(db);
	});

	test("inserts initial goal_created event into DB", () => {
		const { tmp, db } = setup();
		const goal = createGoal(db, { cwd: tmp, objective: "Event test" });

		const events = db
			.prepare("SELECT * FROM goal_events WHERE goal_id = ?")
			.all(goal.id) as Array<{ kind: string }>;

		expect(events.length).toBe(1);
		expect(events[0].kind).toBe("goal_created");
		closeGoalDatabase(db);
	});

	test("rejects when active goal already exists", () => {
		const { tmp, db } = setup();
		createGoal(db, { cwd: tmp, objective: "First goal" });

		expect(() => {
			createGoal(db, { cwd: tmp, objective: "Second goal" });
		}).toThrow(GoalConflictError);
		closeGoalDatabase(db);
	});

	test("allows new goal in different cwd", () => {
		const { tmp, db } = setup();
		const cwd2 = mkdtempSync(join(tmpdir(), "goal-mgr-test-"));

		createGoal(db, { cwd: tmp, objective: "Goal A" });
		const goalB = createGoal(db, { cwd: cwd2, objective: "Goal B" });

		expect(goalB.cwd).toBe(cwd2);
		closeGoalDatabase(db);
	});
});

describe("getActiveGoal", () => {
	test("returns null when no active goal", () => {
		const { db } = setup();
		const result = getActiveGoal(db, "/nonexistent");
		expect(result).toBeNull();
		closeGoalDatabase(db);
	});

	test("returns goal when active", () => {
		const { tmp, db } = setup();
		const created = createGoal(db, { cwd: tmp, objective: "Active test" });

		const active = getActiveGoal(db, tmp);
		expect(active).not.toBeNull();
		expect(active!.id).toBe(created.id);
		closeGoalDatabase(db);
	});

	test("returns null after goal is cleared", () => {
		const { tmp, db } = setup();
		const created = createGoal(db, { cwd: tmp, objective: "Clear test" });
		clearGoal(db, created.id);

		const active = getActiveGoal(db, tmp);
		expect(active).toBeNull();
		closeGoalDatabase(db);
	});
});

describe("pauseGoal", () => {
	test("sets paused flag", () => {
		const { tmp, db } = setup();
		const goal = createGoal(db, { cwd: tmp, objective: "Pause test" });
		const paused = pauseGoal(db, goal.id);

		expect(paused.paused).toBe(1);

		const state = JSON.parse(
			readFileSync(join(tmp, ".claude", "goal", "state.json"), "utf-8"),
		) as GoalState;
		expect(state.paused).toBe(true);
		closeGoalDatabase(db);
	});

	test("inserts goal_paused event", () => {
		const { tmp, db } = setup();
		const goal = createGoal(db, { cwd: tmp, objective: "Pause event" });
		pauseGoal(db, goal.id);

		const events = db
			.prepare(
				"SELECT kind FROM goal_events WHERE goal_id = ? ORDER BY id",
			)
			.all(goal.id) as Array<{ kind: string }>;

		expect(events.map((e) => e.kind)).toContain("goal_paused");
		closeGoalDatabase(db);
	});

	test("rejects pausing already-paused goal", () => {
		const { tmp, db } = setup();
		const goal = createGoal(db, { cwd: tmp, objective: "Double pause" });
		pauseGoal(db, goal.id);

		expect(() => pauseGoal(db, goal.id)).toThrow(InvalidTransitionError);
		closeGoalDatabase(db);
	});

	test("rejects pausing cleared goal", () => {
		const { tmp, db } = setup();
		const goal = createGoal(db, { cwd: tmp, objective: "Cleared pause" });
		clearGoal(db, goal.id);

		expect(() => pauseGoal(db, goal.id)).toThrow(InvalidTransitionError);
		closeGoalDatabase(db);
	});
});

describe("resumeGoal", () => {
	test("unsets paused flag", () => {
		const { tmp, db } = setup();
		const goal = createGoal(db, { cwd: tmp, objective: "Resume test" });
		pauseGoal(db, goal.id);
		const resumed = resumeGoal(db, goal.id);

		expect(resumed.paused).toBe(0);

		const state = JSON.parse(
			readFileSync(join(tmp, ".claude", "goal", "state.json"), "utf-8"),
		) as GoalState;
		expect(state.paused).toBe(false);
		closeGoalDatabase(db);
	});

	test("rejects resuming non-paused goal", () => {
		const { tmp, db } = setup();
		const goal = createGoal(db, { cwd: tmp, objective: "No resume" });

		expect(() => resumeGoal(db, goal.id)).toThrow(InvalidTransitionError);
		closeGoalDatabase(db);
	});
});

describe("clearGoal", () => {
	test("sets status to cleared", () => {
		const { tmp, db } = setup();
		const goal = createGoal(db, { cwd: tmp, objective: "Clear test" });
		const cleared = clearGoal(db, goal.id);

		expect(cleared.status).toBe("cleared");
		expect(cleared.paused).toBe(0);

		const state = JSON.parse(
			readFileSync(join(tmp, ".claude", "goal", "state.json"), "utf-8"),
		) as GoalState;
		expect(state.status).toBe("cleared");
		expect(state.active).toBe(false);
		closeGoalDatabase(db);
	});

	test("clears a paused goal", () => {
		const { tmp, db } = setup();
		const goal = createGoal(db, { cwd: tmp, objective: "Paused clear" });
		pauseGoal(db, goal.id);
		const cleared = clearGoal(db, goal.id);

		expect(cleared.status).toBe("cleared");
		expect(cleared.paused).toBe(0);
		closeGoalDatabase(db);
	});

	test("rejects clearing already-cleared goal", () => {
		const { tmp, db } = setup();
		const goal = createGoal(db, { cwd: tmp, objective: "Double clear" });
		clearGoal(db, goal.id);

		expect(() => clearGoal(db, goal.id)).toThrow(InvalidTransitionError);
		closeGoalDatabase(db);
	});
});

describe("completeGoal", () => {
	test("sets status to done", () => {
		const { tmp, db } = setup();
		const goal = createGoal(db, { cwd: tmp, objective: "Complete test" });
		const done = completeGoal(db, goal.id);

		expect(done.status).toBe("done");
		closeGoalDatabase(db);
	});

	test("rejects completing cleared goal", () => {
		const { tmp, db } = setup();
		const goal = createGoal(db, { cwd: tmp, objective: "Bad complete" });
		clearGoal(db, goal.id);

		expect(() => completeGoal(db, goal.id)).toThrow(InvalidTransitionError);
		closeGoalDatabase(db);
	});
});

describe("incrementLoopCount", () => {
	test("increments loop_count", () => {
		const { tmp, db } = setup();
		const goal = createGoal(db, { cwd: tmp, objective: "Loop test" });
		expect(goal.loop_count).toBe(0);

		const after1 = incrementLoopCount(db, goal.id);
		expect(after1.loop_count).toBe(1);

		const after2 = incrementLoopCount(db, goal.id);
		expect(after2.loop_count).toBe(2);
		closeGoalDatabase(db);
	});

	test("throws for nonexistent goal", () => {
		const { db } = setup();
		expect(() => incrementLoopCount(db, "goal_nonexistent")).toThrow(
			GoalNotFoundError,
		);
		closeGoalDatabase(db);
	});
});

describe("listRecentGoals", () => {
	test("returns goals ordered by created_at desc", () => {
		const { tmp, db } = setup();
		const g1 = createGoal(db, { cwd: tmp, objective: "First" });
		clearGoal(db, g1.id);
		const g2 = createGoal(db, { cwd: tmp, objective: "Second" });

		const recent = listRecentGoals(db, tmp);
		expect(recent.length).toBe(2);
		expect(recent[0].id).toBe(g2.id);
		expect(recent[1].id).toBe(g1.id);
		closeGoalDatabase(db);
	});

	test("respects limit parameter", () => {
		const { tmp, db } = setup();
		const g1 = createGoal(db, { cwd: tmp, objective: "A" });
		clearGoal(db, g1.id);
		createGoal(db, { cwd: tmp, objective: "B" });

		const recent = listRecentGoals(db, tmp, 1);
		expect(recent.length).toBe(1);
		closeGoalDatabase(db);
	});
});

describe("state transitions", () => {
	test("cannot pause a completed goal", () => {
		const { tmp, db } = setup();
		const goal = createGoal(db, { cwd: tmp, objective: "Done pause" });
		completeGoal(db, goal.id);

		expect(() => pauseGoal(db, goal.id)).toThrow(InvalidTransitionError);
		closeGoalDatabase(db);
	});

	test("cannot resume a completed goal", () => {
		const { tmp, db } = setup();
		const goal = createGoal(db, { cwd: tmp, objective: "Done resume" });
		completeGoal(db, goal.id);

		expect(() => resumeGoal(db, goal.id)).toThrow(InvalidTransitionError);
		closeGoalDatabase(db);
	});

	test("nonexistent goal throws GoalNotFoundError", () => {
		const { db } = setup();
		expect(() => pauseGoal(db, "goal_fake")).toThrow(GoalNotFoundError);
		expect(() => resumeGoal(db, "goal_fake")).toThrow(GoalNotFoundError);
		expect(() => clearGoal(db, "goal_fake")).toThrow(GoalNotFoundError);
		expect(() => completeGoal(db, "goal_fake")).toThrow(GoalNotFoundError);
		closeGoalDatabase(db);
	});
});
