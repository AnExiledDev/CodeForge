import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
	closeGoalDatabase,
	openGoalDatabase,
} from "../../src/daemon/db.js";

describe("openGoalDatabase", () => {
	test("creates all tables and enables WAL mode", () => {
		const tmp = mkdtempSync(join(tmpdir(), "db-test-"));
		const dbPath = join(tmp, "test.db");
		const db = openGoalDatabase(dbPath);

		// Verify WAL mode
		const journalMode = db
			.prepare("PRAGMA journal_mode")
			.get() as { journal_mode: string };
		expect(journalMode.journal_mode).toBe("wal");

		// Verify foreign keys
		const fk = db
			.prepare("PRAGMA foreign_keys")
			.get() as { foreign_keys: number };
		expect(fk.foreign_keys).toBe(1);

		// Verify all expected tables exist
		const tables = db
			.prepare(
				"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
			)
			.all() as Array<{ name: string }>;

		const tableNames = tables.map((t) => t.name);
		expect(tableNames).toContain("goals");
		expect(tableNames).toContain("goal_events");
		expect(tableNames).toContain("goal_evaluations");
		expect(tableNames).toContain("turns");
		expect(tableNames).toContain("tool_events");
		expect(tableNames).toContain("compactions");
		expect(tableNames).toContain("context_grades");
		expect(tableNames).toContain("jobs");
		expect(tableNames).toContain("model_failures");

		closeGoalDatabase(db);
	});

	test("is idempotent — opening twice does not error", () => {
		const tmp = mkdtempSync(join(tmpdir(), "db-test-"));
		const dbPath = join(tmp, "test.db");

		const db1 = openGoalDatabase(dbPath);
		closeGoalDatabase(db1);

		const db2 = openGoalDatabase(dbPath);
		// Verify tables still exist after second open
		const tables = db2
			.prepare(
				"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
			)
			.all() as Array<{ name: string }>;

		expect(tables.map((t) => t.name)).toContain("goals");
		closeGoalDatabase(db2);
	});

	test("creates parent directories if they do not exist", () => {
		const tmp = mkdtempSync(join(tmpdir(), "db-test-"));
		const dbPath = join(tmp, "nested", "deep", "test.db");

		const db = openGoalDatabase(dbPath);
		expect(db).toBeDefined();
		closeGoalDatabase(db);
	});
});
