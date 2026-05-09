import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { closeGoalDatabase, openGoalDatabase } from "../../src/daemon/db.js";

function setup() {
	const tmp = mkdtempSync(join(tmpdir(), "validation-detect-test-"));
	const dbPath = join(tmp, "test.db");
	const db = openGoalDatabase(dbPath);
	return { tmp, db };
}

const VALIDATION_PATTERNS = [
	"%test%",
	"%build%",
	"%lint%",
	"%check%",
	"%typecheck%",
	"%tsc%",
	"%jest%",
	"%vitest%",
	"%bun test%",
];

function queryValidationCommands(db: ReturnType<typeof openGoalDatabase>, goalId: string): string[] {
	const placeholders = VALIDATION_PATTERNS.map(() => "input_json LIKE ?").join(" OR ");
	const query = `SELECT input_json FROM tool_events WHERE goal_id = ? AND (${placeholders}) ORDER BY created_at DESC LIMIT 20`;

	const rows = db
		.prepare(query)
		.all(goalId, ...VALIDATION_PATTERNS) as Array<{ input_json: string }>;

	return rows
		.map((row) => {
			try {
				const parsed = JSON.parse(row.input_json);
				return parsed.command ?? parsed.input ?? row.input_json;
			} catch {
				return row.input_json;
			}
		})
		.filter((cmd): cmd is string => typeof cmd === "string");
}

function insertToolEvent(db: ReturnType<typeof openGoalDatabase>, goalId: string, cwd: string, command: string): void {
	const now = new Date().toISOString();
	db.prepare(
		`INSERT INTO tool_events (goal_id, session_id, cwd, created_at, tool_name, status, input_json, output_excerpt, payload_json)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(goalId, null, cwd, now, "Bash", "ok", JSON.stringify({ command }), null, "{}");
}

describe("validation command detection", () => {
	test("bun test detected as validation command", () => {
		const { tmp, db } = setup();
		const goalId = "goal_val1";

		insertToolEvent(db, goalId, tmp, "bun test");

		const results = queryValidationCommands(db, goalId);
		expect(results).toContain("bun test");
		expect(results.length).toBe(1);
		closeGoalDatabase(db);
	});

	test("npm run build detected as validation command", () => {
		const { tmp, db } = setup();
		const goalId = "goal_val2";

		insertToolEvent(db, goalId, tmp, "npm run build");

		const results = queryValidationCommands(db, goalId);
		expect(results).toContain("npm run build");
		expect(results.length).toBe(1);
		closeGoalDatabase(db);
	});

	test("echo hello not detected as validation command", () => {
		const { tmp, db } = setup();
		const goalId = "goal_val3";

		insertToolEvent(db, goalId, tmp, "echo hello");

		const results = queryValidationCommands(db, goalId);
		expect(results).toEqual([]);
		closeGoalDatabase(db);
	});
});
