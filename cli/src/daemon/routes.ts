import type { Database } from "bun:sqlite";
import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";
import type { DaemonConfig, GoalState, HealthResponse, StatusResponse } from "../schemas/goal.js";
import { evaluateGoal } from "./agents/evaluator.js";
import { formatPlanMd, generatePlan } from "./agents/planner.js";
import { recordEvent } from "./event-recorder.js";
import { gatherEvidence } from "./evidence.js";
import {
	GoalConflictError,
	GoalNotFoundError,
	InvalidTransitionError,
	clearGoal,
	createGoal,
	getActiveGoal,
	incrementLoopCount,
	pauseGoal,
	resumeGoal,
	updateGoalWithPlan,
	writePlanMd,
} from "./goal-manager.js";

let serverStartTime = Date.now();

export function setStartTime(time: number): void {
	serverStartTime = time;
}

function uptimeSeconds(): number {
	return Math.floor((Date.now() - serverStartTime) / 1000);
}

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function handleHealth(): Response {
	const body: HealthResponse = {
		status: "ok",
		version: "1.0.0",
		uptime: uptimeSeconds(),
		db: "connected",
		pid: process.pid,
	};
	return json(body);
}

function handleStatus(db: Database, config: DaemonConfig): Response {
	let dbSize = 0;
	try {
		dbSize = statSync(config.dbPath).size;
	} catch {
		// DB file may not be accessible yet
	}

	const body: StatusResponse = {
		daemon: "running",
		port: config.port,
		db: { path: config.dbPath, size: dbSize },
		activeGoal: null,
		uptime: uptimeSeconds(),
	};
	return json(body);
}

async function parseJsonBody(req: Request): Promise<Record<string, unknown> | null> {
	try {
		return (await req.json()) as Record<string, unknown>;
	} catch {
		return null;
	}
}

async function handleGoalSet(
	db: Database,
	body: Record<string, unknown>,
	config: DaemonConfig,
): Promise<Response> {
	const cwd = body.cwd as string | undefined;
	const objective = body.objective as string | undefined;
	const sessionId = body.sessionId as string | undefined;

	if (!cwd || !objective) {
		return json({ error: "Missing required fields: cwd, objective" }, 400);
	}

	let goal;
	try {
		goal = createGoal(db, { cwd, objective, sessionId });
	} catch (err) {
		if (err instanceof GoalConflictError) {
			return json({ error: err.message }, 409);
		}
		throw err;
	}

	// Attempt to generate a plan — failure is non-fatal
	let plan = null;
	try {
		const result = await generatePlan(config, db, { objective, cwd });
		if (result) {
			plan = result.plan;
			const planMd = formatPlanMd(plan);
			writePlanMd(cwd, planMd);
			goal = updateGoalWithPlan(db, goal.id, plan);
		}
	} catch {
		// Planner failure is non-fatal — goal was already created
	}

	const state: GoalState = JSON.parse(goal.state_json);
	return json({ goal: state, plan }, 201);
}

function handleGoalCurrent(db: Database, url: URL): Response {
	const cwd = url.searchParams.get("cwd");
	if (!cwd) {
		return json({ error: "Missing required query parameter: cwd" }, 400);
	}

	const goal = getActiveGoal(db, cwd);
	if (!goal) {
		return json({ error: "No active goal" }, 404);
	}

	const state: GoalState = JSON.parse(goal.state_json);
	return json({ goal: state });
}

function handleGoalPause(db: Database, body: Record<string, unknown>): Response {
	const cwd = body.cwd as string | undefined;
	if (!cwd) {
		return json({ error: "Missing required field: cwd" }, 400);
	}

	const active = getActiveGoal(db, cwd);
	if (!active) {
		return json({ error: "No active goal" }, 404);
	}

	try {
		const updated = pauseGoal(db, active.id);
		const state: GoalState = JSON.parse(updated.state_json);
		return json({ goal: state });
	} catch (err) {
		if (err instanceof InvalidTransitionError) {
			return json({ error: err.message }, 409);
		}
		throw err;
	}
}

function handleGoalResume(db: Database, body: Record<string, unknown>): Response {
	const cwd = body.cwd as string | undefined;
	if (!cwd) {
		return json({ error: "Missing required field: cwd" }, 400);
	}

	const active = getActiveGoal(db, cwd);
	if (!active) {
		return json({ error: "No active goal" }, 404);
	}

	try {
		const updated = resumeGoal(db, active.id);
		const state: GoalState = JSON.parse(updated.state_json);
		return json({ goal: state });
	} catch (err) {
		if (err instanceof InvalidTransitionError) {
			return json({ error: err.message }, 409);
		}
		throw err;
	}
}

function handleGoalClear(db: Database, body: Record<string, unknown>): Response {
	const cwd = body.cwd as string | undefined;
	if (!cwd) {
		return json({ error: "Missing required field: cwd" }, 400);
	}

	const active = getActiveGoal(db, cwd);
	if (!active) {
		return json({ error: "No active goal" }, 404);
	}

	try {
		const updated = clearGoal(db, active.id);
		const state: GoalState = JSON.parse(updated.state_json);
		return json({ goal: state });
	} catch (err) {
		if (err instanceof InvalidTransitionError) {
			return json({ error: err.message }, 409);
		}
		throw err;
	}
}

function handleEventsHook(db: Database, body: Record<string, unknown>): Response {
	const cwd = body.cwd as string | undefined;
	const kind = body.kind as string | undefined;

	if (!cwd || !kind) {
		return json({ error: "Missing required fields: cwd, kind" }, 400);
	}

	recordEvent(db, {
		goalId: (body.goalId as string) ?? null,
		sessionId: (body.sessionId as string) ?? null,
		cwd,
		kind: kind as "hook_event",
		payload: (body.payload as Record<string, unknown>) ?? {},
	});

	return json({ ok: true }, 201);
}

function handleEventsTool(db: Database, body: Record<string, unknown>): Response {
	const cwd = body.cwd as string | undefined;

	if (!cwd) {
		return json({ error: "Missing required field: cwd" }, 400);
	}

	const toolName = body.toolName as string | undefined;
	const status = body.status as string | undefined;
	const inputJson = body.input as Record<string, unknown> | undefined;
	const outputExcerpt = body.outputExcerpt as string | undefined;

	// Insert into tool_events table directly
	const now = new Date().toISOString();
	db.prepare(
		`INSERT INTO tool_events (goal_id, session_id, cwd, created_at, tool_name, status, input_json, output_excerpt, payload_json)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		(body.goalId as string) ?? null,
		(body.sessionId as string) ?? null,
		cwd,
		now,
		toolName ?? null,
		status ?? null,
		inputJson ? JSON.stringify(inputJson) : null,
		outputExcerpt ?? null,
		JSON.stringify(body),
	);

	// Also record as a generic event
	recordEvent(db, {
		goalId: (body.goalId as string) ?? null,
		sessionId: (body.sessionId as string) ?? null,
		cwd,
		kind: "tool_event",
		payload: body,
	});

	return json({ ok: true }, 201);
}

async function handleGoalEvaluateStop(
	db: Database,
	body: Record<string, unknown>,
	config: DaemonConfig,
): Promise<Response> {
	const cwd = body.cwd as string | undefined;
	if (!cwd) {
		return json({ error: "Missing required field: cwd" }, 400);
	}

	const active = getActiveGoal(db, cwd);
	if (!active) {
		// No active goal — allow stop
		return json({
			evaluation: {
				decision: "allow",
				status: "done",
				reason: "No active goal — nothing to evaluate",
				confidence: 1.0,
				missingEvidence: [],
				completedCriteria: [],
				incompleteCriteria: [],
			},
		});
	}

	const goalState: GoalState = JSON.parse(active.state_json);
	const evidence = await gatherEvidence(cwd, active.id, db);

	// Read plan.md and progress.md if they exist
	const planPath = join(cwd, ".claude", "goal", "plan.md");
	const progressPath = join(cwd, ".claude", "goal", "progress.md");
	const planMd = existsSync(planPath) ? readFileSync(planPath, "utf-8") : null;
	const progressMd = existsSync(progressPath) ? readFileSync(progressPath, "utf-8") : null;

	const lastAssistantMessage = body.lastAssistantMessage as string | undefined;

	const { evaluation, provider, modelId } = await evaluateGoal(config, db, {
		goal: goalState,
		evidence,
		planMd,
		progressMd,
		lastAssistantMessage,
	});

	// Store evaluation in goal_evaluations table
	db.prepare(
		`INSERT INTO goal_evaluations (goal_id, created_at, decision, status, reason, next_instruction, confidence, evidence_json, model_info_json)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		active.id,
		new Date().toISOString(),
		evaluation.decision,
		evaluation.status,
		evaluation.reason,
		evaluation.nextInstruction ?? null,
		evaluation.confidence,
		JSON.stringify(evidence),
		JSON.stringify({ provider, modelId }),
	);

	// Increment loop count
	incrementLoopCount(db, active.id);

	return json({ evaluation });
}

export function handleRequest(
	req: Request,
	ctx: { db: Database; config: DaemonConfig },
): Response | Promise<Response> {
	const url = new URL(req.url);
	const { pathname } = url;
	const method = req.method;

	if (method === "GET" && pathname === "/health") {
		return handleHealth();
	}

	if (method === "GET" && pathname === "/status") {
		return handleStatus(ctx.db, ctx.config);
	}

	if (method === "GET" && pathname === "/goal/current") {
		return handleGoalCurrent(ctx.db, url);
	}

	// POST routes require JSON body parsing
	if (method === "POST") {
		return (async () => {
			const body = await parseJsonBody(req);
			if (!body) {
				return json({ error: "Invalid JSON body" }, 400);
			}

			switch (pathname) {
				case "/goal/set":
					return handleGoalSet(ctx.db, body, ctx.config);
				case "/goal/pause":
					return handleGoalPause(ctx.db, body);
				case "/goal/resume":
					return handleGoalResume(ctx.db, body);
				case "/goal/clear":
					return handleGoalClear(ctx.db, body);
				case "/goal/evaluate-stop":
					return handleGoalEvaluateStop(ctx.db, body, ctx.config);
				case "/events/hook":
					return handleEventsHook(ctx.db, body);
				case "/events/tool":
					return handleEventsTool(ctx.db, body);
				default:
					return json({ error: "Not found" }, 404);
			}
		})();
	}

	return json({ error: "Not found" }, 404);
}
