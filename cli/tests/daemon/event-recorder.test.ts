import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { closeGoalDatabase, openGoalDatabase } from "../../src/daemon/db.js";
import { recordEvent } from "../../src/daemon/event-recorder.js";
import type { GoalEventRow } from "../../src/schemas/goal.js";

function setup() {
	const tmp = mkdtempSync(join(tmpdir(), "evt-rec-test-"));
	const dbPath = join(tmp, "test.db");
	const db = openGoalDatabase(dbPath);
	return { tmp, db };
}

describe("recordEvent", () => {
	test("inserts event into goal_events table", () => {
		const { tmp, db } = setup();

		recordEvent(db, {
			goalId: "goal_abc",
			sessionId: "sess-1",
			cwd: tmp,
			kind: "goal_created",
			payload: { objective: "test" },
		});

		const rows = db
			.prepare("SELECT * FROM goal_events WHERE goal_id = ?")
			.all("goal_abc") as GoalEventRow[];

		expect(rows.length).toBe(1);
		expect(rows[0].kind).toBe("goal_created");
		expect(rows[0].cwd).toBe(tmp);
		expect(rows[0].session_id).toBe("sess-1");

		const payload = JSON.parse(rows[0].payload_json);
		expect(payload.objective).toBe("test");
		closeGoalDatabase(db);
	});

	test("appends to JSONL file", () => {
		const { tmp, db } = setup();

		recordEvent(db, {
			goalId: "goal_1",
			sessionId: null,
			cwd: tmp,
			kind: "hook_event",
			payload: { hook: "Stop" },
		});

		recordEvent(db, {
			goalId: "goal_1",
			sessionId: null,
			cwd: tmp,
			kind: "tool_event",
			payload: { tool: "Bash" },
		});

		const jsonlPath = join(tmp, ".codeforge", "goal", "events.jsonl");
		expect(existsSync(jsonlPath)).toBe(true);

		const content = readFileSync(jsonlPath, "utf-8").trim();
		const lines = content.split("\n");
		expect(lines.length).toBe(2);

		const event1 = JSON.parse(lines[0]);
		expect(event1.kind).toBe("hook_event");
		expect(event1.goalId).toBe("goal_1");

		const event2 = JSON.parse(lines[1]);
		expect(event2.kind).toBe("tool_event");
		expect(event2.payload.tool).toBe("Bash");
		closeGoalDatabase(db);
	});

	test("handles null goalId and sessionId", () => {
		const { tmp, db } = setup();

		recordEvent(db, {
			goalId: null,
			sessionId: null,
			cwd: tmp,
			kind: "error",
			payload: { message: "something broke" },
		});

		const rows = db
			.prepare("SELECT * FROM goal_events WHERE goal_id IS NULL")
			.all() as GoalEventRow[];

		expect(rows.length).toBe(1);
		expect(rows[0].kind).toBe("error");
		closeGoalDatabase(db);
	});
});
