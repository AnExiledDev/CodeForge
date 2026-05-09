import type { Database } from "bun:sqlite";
import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { GoalEvent } from "../schemas/goal.js";

function nowISO(): string {
	return new Date().toISOString();
}

export function recordEvent(db: Database, event: GoalEvent): void {
	const now = nowISO();

	// 1. Insert into DB
	db.prepare(
		`INSERT INTO goal_events (goal_id, session_id, cwd, kind, created_at, payload_json)
		 VALUES (?, ?, ?, ?, ?, ?)`,
	).run(
		event.goalId,
		event.sessionId,
		event.cwd,
		event.kind,
		now,
		JSON.stringify(event.payload),
	);

	// 2. Append to JSONL file
	const jsonlDir = join(event.cwd, ".codeforge", "goal");
	mkdirSync(jsonlDir, { recursive: true });
	const jsonlPath = join(jsonlDir, "events.jsonl");

	const line = JSON.stringify({
		timestamp: now,
		goalId: event.goalId,
		sessionId: event.sessionId,
		cwd: event.cwd,
		kind: event.kind,
		payload: event.payload,
	});

	appendFileSync(jsonlPath, `${line}\n`);
}
