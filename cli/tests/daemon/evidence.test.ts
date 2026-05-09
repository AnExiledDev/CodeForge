import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { closeGoalDatabase, openGoalDatabase } from "../../src/daemon/db.js";
import { gatherEvidence } from "../../src/daemon/evidence.js";

function setup() {
	const tmp = mkdtempSync(join(tmpdir(), "evidence-test-"));
	const dbPath = join(tmp, "test.db");
	const db = openGoalDatabase(dbPath);
	return { tmp, db };
}

describe("gatherEvidence", () => {
	test("parses plan.md checkboxes", async () => {
		const { tmp, db } = setup();
		const goalDir = join(tmp, ".claude", "goal");
		mkdirSync(goalDir, { recursive: true });

		writeFileSync(
			join(goalDir, "plan.md"),
			[
				"# Plan",
				"",
				"- [x] Set up database schema",
				"- [x] Create API routes",
				"- [ ] Write unit tests",
				"- [ ] Add integration tests",
				"- [X] Deploy to staging",
				"",
			].join("\n"),
		);

		const evidence = await gatherEvidence(tmp, null, db);

		expect(evidence.checkedPlanItems).toEqual([
			"Set up database schema",
			"Create API routes",
			"Deploy to staging",
		]);
		expect(evidence.uncheckedPlanItems).toEqual([
			"Write unit tests",
			"Add integration tests",
		]);
		closeGoalDatabase(db);
	});

	test("handles missing plan.md gracefully", async () => {
		const { tmp, db } = setup();

		const evidence = await gatherEvidence(tmp, null, db);

		expect(evidence.checkedPlanItems).toEqual([]);
		expect(evidence.uncheckedPlanItems).toEqual([]);
		closeGoalDatabase(db);
	});

	test("returns empty arrays for git commands outside a repo", async () => {
		const { tmp, db } = setup();

		const evidence = await gatherEvidence(tmp, null, db);

		// tmp is not a git repo, so git commands should return empty
		expect(evidence.gitStatus).toEqual([]);
		expect(evidence.gitDiffStat).toEqual([]);
		expect(evidence.gitDiffNames).toEqual([]);
		closeGoalDatabase(db);
	});

	test("returns empty validation commands when no goalId", async () => {
		const { tmp, db } = setup();

		const evidence = await gatherEvidence(tmp, null, db);

		expect(evidence.recentValidationCommands).toEqual([]);
		closeGoalDatabase(db);
	});

	test("queries tool_events for validation commands", async () => {
		const { tmp, db } = setup();
		const goalId = "goal_test123";

		// Insert some tool events with validation-like commands
		const now = new Date().toISOString();
		db.prepare(
			`INSERT INTO tool_events (goal_id, session_id, cwd, created_at, tool_name, status, input_json, output_excerpt, payload_json)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).run(goalId, null, tmp, now, "Bash", "ok", '{"command":"bun test"}', null, "{}");

		db.prepare(
			`INSERT INTO tool_events (goal_id, session_id, cwd, created_at, tool_name, status, input_json, output_excerpt, payload_json)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).run(goalId, null, tmp, now, "Bash", "ok", '{"command":"npm run build"}', null, "{}");

		// Non-validation command should not appear
		db.prepare(
			`INSERT INTO tool_events (goal_id, session_id, cwd, created_at, tool_name, status, input_json, output_excerpt, payload_json)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).run(goalId, null, tmp, now, "Bash", "ok", '{"command":"cat file.txt"}', null, "{}");

		const evidence = await gatherEvidence(tmp, goalId, db);

		expect(evidence.recentValidationCommands.length).toBe(2);
		expect(evidence.recentValidationCommands).toContain("bun test");
		expect(evidence.recentValidationCommands).toContain("npm run build");
		closeGoalDatabase(db);
	});
});
