import type { Database } from "bun:sqlite";
import { mkdirSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import type {
	CreateGoalInput,
	GoalPlan,
	GoalRow,
	GoalState,
	GoalStatus,
} from "../schemas/goal.js";
import { recordEvent } from "./event-recorder.js";

function generateGoalId(): string {
	return `goal_${crypto.randomUUID()}`;
}

function nowISO(): string {
	return new Date().toISOString();
}

function buildGoalState(row: GoalRow): GoalState {
	return {
		id: row.id,
		active: row.status === "active",
		paused: row.paused === 1,
		status: row.status as GoalStatus,
		objective: row.objective,
		currentCheckpoint: "Begin work",
		loopCount: row.loop_count,
		maxLoops: row.max_loops,
		failedValidationCount: row.failed_validation_count,
		repeatedInstructionCount: row.repeated_instruction_count,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function writeStateJson(cwd: string, state: GoalState): void {
	const goalDir = join(cwd, ".claude", "goal");
	mkdirSync(goalDir, { recursive: true });

	const statePath = join(goalDir, "state.json");
	const tmpPath = `${statePath}.tmp.${process.pid}`;
	writeFileSync(tmpPath, JSON.stringify(state, null, 2));
	renameSync(tmpPath, statePath);
}

function writeInitialProgress(cwd: string, objective: string): void {
	const goalDir = join(cwd, ".claude", "goal");
	mkdirSync(goalDir, { recursive: true });

	const progressPath = join(goalDir, "progress.md");
	const now = nowISO();
	const content = `# Goal Progress\n\n## ${now}\n\nGoal created: ${objective}\n`;
	writeFileSync(progressPath, content);
}

export function createGoal(
	db: Database,
	input: CreateGoalInput,
): GoalRow {
	const existing = getActiveGoal(db, input.cwd);
	if (existing) {
		throw new GoalConflictError(
			`Active goal already exists for ${input.cwd}: ${existing.id}`,
		);
	}

	const id = generateGoalId();
	const now = nowISO();

	const state: GoalState = {
		id,
		active: true,
		paused: false,
		status: "active",
		objective: input.objective,
		currentCheckpoint: "Begin work",
		loopCount: 0,
		maxLoops: 30,
		failedValidationCount: 0,
		repeatedInstructionCount: 0,
		createdAt: now,
		updatedAt: now,
	};

	const stateJson = JSON.stringify(state);

	db.prepare(
		`INSERT INTO goals (id, cwd, session_id, objective, status, created_at, updated_at, paused, loop_count, max_loops, failed_validation_count, repeated_instruction_count, state_json)
		 VALUES (?, ?, ?, ?, 'active', ?, ?, 0, 0, 30, 0, 0, ?)`,
	).run(
		id,
		input.cwd,
		input.sessionId ?? null,
		input.objective,
		now,
		now,
		stateJson,
	);

	writeStateJson(input.cwd, state);
	writeInitialProgress(input.cwd, input.objective);

	recordEvent(db, {
		goalId: id,
		sessionId: input.sessionId ?? null,
		cwd: input.cwd,
		kind: "goal_created",
		payload: { objective: input.objective },
	});

	return getGoal(db, id)!;
}

export function getActiveGoal(
	db: Database,
	cwd: string,
): GoalRow | null {
	return (
		(db
			.prepare(
				"SELECT * FROM goals WHERE cwd = ? AND status = 'active' LIMIT 1",
			)
			.get(cwd) as GoalRow | null) ?? null
	);
}

export function getGoal(
	db: Database,
	goalId: string,
): GoalRow | null {
	return (
		(db
			.prepare("SELECT * FROM goals WHERE id = ?")
			.get(goalId) as GoalRow | null) ?? null
	);
}

export function pauseGoal(db: Database, goalId: string): GoalRow {
	const goal = getGoal(db, goalId);
	if (!goal) {
		throw new GoalNotFoundError(`Goal not found: ${goalId}`);
	}
	if (goal.status !== "active") {
		throw new InvalidTransitionError(
			`Cannot pause goal with status '${goal.status}' — must be 'active'`,
		);
	}
	if (goal.paused === 1) {
		throw new InvalidTransitionError("Goal is already paused");
	}

	const now = nowISO();
	const state = buildGoalState(goal);
	state.paused = true;
	state.updatedAt = now;

	db.prepare(
		"UPDATE goals SET paused = 1, updated_at = ?, state_json = ? WHERE id = ?",
	).run(now, JSON.stringify(state), goalId);

	writeStateJson(goal.cwd, state);

	recordEvent(db, {
		goalId,
		sessionId: goal.session_id,
		cwd: goal.cwd,
		kind: "goal_paused",
		payload: {},
	});

	return getGoal(db, goalId)!;
}

export function resumeGoal(db: Database, goalId: string): GoalRow {
	const goal = getGoal(db, goalId);
	if (!goal) {
		throw new GoalNotFoundError(`Goal not found: ${goalId}`);
	}
	if (goal.status !== "active" || goal.paused !== 1) {
		throw new InvalidTransitionError(
			`Cannot resume goal — must be active and paused (status='${goal.status}', paused=${goal.paused})`,
		);
	}

	const now = nowISO();
	const state = buildGoalState(goal);
	state.paused = false;
	state.updatedAt = now;

	db.prepare(
		"UPDATE goals SET paused = 0, updated_at = ?, state_json = ? WHERE id = ?",
	).run(now, JSON.stringify(state), goalId);

	writeStateJson(goal.cwd, state);

	recordEvent(db, {
		goalId,
		sessionId: goal.session_id,
		cwd: goal.cwd,
		kind: "goal_resumed",
		payload: {},
	});

	return getGoal(db, goalId)!;
}

export function clearGoal(db: Database, goalId: string): GoalRow {
	const goal = getGoal(db, goalId);
	if (!goal) {
		throw new GoalNotFoundError(`Goal not found: ${goalId}`);
	}
	if (goal.status !== "active") {
		throw new InvalidTransitionError(
			`Cannot clear goal with status '${goal.status}' — must be 'active'`,
		);
	}

	const now = nowISO();
	const state = buildGoalState(goal);
	state.active = false;
	state.status = "cleared";
	state.paused = false;
	state.updatedAt = now;

	db.prepare(
		"UPDATE goals SET status = 'cleared', paused = 0, updated_at = ?, state_json = ? WHERE id = ?",
	).run(now, JSON.stringify(state), goalId);

	writeStateJson(goal.cwd, state);

	recordEvent(db, {
		goalId,
		sessionId: goal.session_id,
		cwd: goal.cwd,
		kind: "goal_cleared",
		payload: {},
	});

	return getGoal(db, goalId)!;
}

export function completeGoal(db: Database, goalId: string): GoalRow {
	const goal = getGoal(db, goalId);
	if (!goal) {
		throw new GoalNotFoundError(`Goal not found: ${goalId}`);
	}
	if (goal.status !== "active") {
		throw new InvalidTransitionError(
			`Cannot complete goal with status '${goal.status}' — must be 'active'`,
		);
	}

	const now = nowISO();
	const state = buildGoalState(goal);
	state.active = false;
	state.status = "done";
	state.paused = false;
	state.updatedAt = now;

	db.prepare(
		"UPDATE goals SET status = 'done', paused = 0, updated_at = ?, state_json = ? WHERE id = ?",
	).run(now, JSON.stringify(state), goalId);

	writeStateJson(goal.cwd, state);

	recordEvent(db, {
		goalId,
		sessionId: goal.session_id,
		cwd: goal.cwd,
		kind: "goal_completed",
		payload: {},
	});

	return getGoal(db, goalId)!;
}

export function incrementLoopCount(
	db: Database,
	goalId: string,
): GoalRow {
	const goal = getGoal(db, goalId);
	if (!goal) {
		throw new GoalNotFoundError(`Goal not found: ${goalId}`);
	}

	const now = nowISO();
	const newCount = goal.loop_count + 1;
	const state = buildGoalState(goal);
	state.loopCount = newCount;
	state.updatedAt = now;

	db.prepare(
		"UPDATE goals SET loop_count = ?, updated_at = ?, state_json = ? WHERE id = ?",
	).run(newCount, now, JSON.stringify(state), goalId);

	writeStateJson(goal.cwd, state);

	return getGoal(db, goalId)!;
}

export function listRecentGoals(
	db: Database,
	cwd: string,
	limit = 10,
): GoalRow[] {
	return db
		.prepare(
			"SELECT * FROM goals WHERE cwd = ? ORDER BY created_at DESC LIMIT ?",
		)
		.all(cwd, limit) as GoalRow[];
}

export function writePlanMd(cwd: string, planMd: string): void {
	const goalDir = join(cwd, ".claude", "goal");
	mkdirSync(goalDir, { recursive: true });

	const planPath = join(goalDir, "plan.md");
	const tmpPath = `${planPath}.tmp.${process.pid}`;
	writeFileSync(tmpPath, planMd);
	renameSync(tmpPath, planPath);
}

export function updateGoalWithPlan(
	db: Database,
	goalId: string,
	plan: GoalPlan,
): GoalRow {
	const goal = getGoal(db, goalId);
	if (!goal) {
		throw new GoalNotFoundError(`Goal not found: ${goalId}`);
	}

	const now = nowISO();
	const state = buildGoalState(goal);
	state.currentCheckpoint = plan.nextCheckpoint;
	state.updatedAt = now;

	const stateObj = { ...state, plan };
	const stateJson = JSON.stringify(stateObj);

	db.prepare(
		"UPDATE goals SET updated_at = ?, state_json = ? WHERE id = ?",
	).run(now, stateJson, goalId);

	writeStateJson(goal.cwd, state);

	recordEvent(db, {
		goalId,
		sessionId: goal.session_id,
		cwd: goal.cwd,
		kind: "goal_planned",
		payload: { plan },
	});

	return getGoal(db, goalId)!;
}

// Custom error classes for typed error handling in routes

export function incrementFailedValidationCount(
	db: Database,
	goalId: string,
): GoalRow {
	const goal = getGoal(db, goalId);
	if (!goal) {
		throw new GoalNotFoundError(`Goal not found: ${goalId}`);
	}

	const now = nowISO();
	const newCount = goal.failed_validation_count + 1;
	const state = buildGoalState(goal);
	state.failedValidationCount = newCount;
	state.updatedAt = now;

	db.prepare(
		"UPDATE goals SET failed_validation_count = ?, updated_at = ?, state_json = ? WHERE id = ?",
	).run(newCount, now, JSON.stringify(state), goalId);

	writeStateJson(goal.cwd, state);

	return getGoal(db, goalId)!;
}

export function incrementRepeatedInstructionCount(
	db: Database,
	goalId: string,
): GoalRow {
	const goal = getGoal(db, goalId);
	if (!goal) {
		throw new GoalNotFoundError(`Goal not found: ${goalId}`);
	}

	const now = nowISO();
	const newCount = goal.repeated_instruction_count + 1;
	const state = buildGoalState(goal);
	state.repeatedInstructionCount = newCount;
	state.updatedAt = now;

	db.prepare(
		"UPDATE goals SET repeated_instruction_count = ?, updated_at = ?, state_json = ? WHERE id = ?",
	).run(newCount, now, JSON.stringify(state), goalId);

	writeStateJson(goal.cwd, state);

	return getGoal(db, goalId)!;
}

export function resetRepeatedInstructionCount(
	db: Database,
	goalId: string,
): GoalRow {
	const goal = getGoal(db, goalId);
	if (!goal) {
		throw new GoalNotFoundError(`Goal not found: ${goalId}`);
	}

	if (goal.repeated_instruction_count === 0) {
		return goal;
	}

	const now = nowISO();
	const state = buildGoalState(goal);
	state.repeatedInstructionCount = 0;
	state.updatedAt = now;

	db.prepare(
		"UPDATE goals SET repeated_instruction_count = 0, updated_at = ?, state_json = ? WHERE id = ?",
	).run(now, JSON.stringify(state), goalId);

	writeStateJson(goal.cwd, state);

	return getGoal(db, goalId)!;
}

function normalizeInstruction(instruction: string): string {
	return instruction.toLowerCase().trim().replace(/\s+/g, " ");
}

export function getRecentEvaluationInstructions(
	db: Database,
	goalId: string,
	limit = 5,
): string[] {
	const rows = db
		.prepare(
			`SELECT next_instruction FROM goal_evaluations
			 WHERE goal_id = ? AND next_instruction IS NOT NULL
			 ORDER BY created_at DESC LIMIT ?`,
		)
		.all(goalId, limit) as Array<{ next_instruction: string }>;

	return rows.map((r) => r.next_instruction);
}

export function isRepeatedInstruction(
	db: Database,
	goalId: string,
	currentInstruction: string,
	threshold = 3,
): boolean {
	const recent = getRecentEvaluationInstructions(db, goalId, threshold);
	if (recent.length < threshold) {
		return false;
	}

	const normalized = normalizeInstruction(currentInstruction);
	return recent
		.slice(0, threshold)
		.every((inst) => normalizeInstruction(inst) === normalized);
}

export class GoalConflictError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GoalConflictError";
	}
}

export class GoalNotFoundError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GoalNotFoundError";
	}
}

export class InvalidTransitionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "InvalidTransitionError";
	}
}
