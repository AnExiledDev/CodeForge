import type { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { DaemonConfig, GoalEvaluation, GoalState } from "../schemas/goal.js";
import { evaluateGoal } from "./agents/evaluator.js";
import { gatherEvidence } from "./evidence.js";
import {
	getActiveGoal,
	incrementFailedValidationCount,
	incrementLoopCount,
	incrementRepeatedInstructionCount,
	isRepeatedInstruction,
	resetRepeatedInstructionCount,
} from "./goal-manager.js";

export interface EvaluateStopResult {
	decision: "allow" | "block";
	status: string;
	reason: string;
	nextInstruction?: string;
	confidence: number;
	loopCount: number;
	maxLoops: number;
}

/**
 * Pre-AI escape hatches — checked before any model call.
 * Returns a result if the stop should be decided without AI, null otherwise.
 */
function checkEscapeHatches(
	goalState: GoalState,
	config: DaemonConfig,
): EvaluateStopResult | null {
	// Goal is paused — user explicitly paused, allow stop
	if (goalState.paused) {
		return {
			decision: "allow",
			status: "paused",
			reason: "Goal is paused — allowing stop",
			confidence: 1.0,
			loopCount: goalState.loopCount,
			maxLoops: goalState.maxLoops,
		};
	}

	// Goal is not active (cleared/done) — allow stop
	if (goalState.status !== "active") {
		return {
			decision: "allow",
			status: goalState.status,
			reason: `Goal status is '${goalState.status}' — allowing stop`,
			confidence: 1.0,
			loopCount: goalState.loopCount,
			maxLoops: goalState.maxLoops,
		};
	}

	// Loop budget exhausted
	if (goalState.loopCount >= config.limits.maxGoalLoops) {
		return {
			decision: "allow",
			status: "budget_limited",
			reason: `Loop count (${goalState.loopCount}) reached limit (${config.limits.maxGoalLoops}) — allowing stop to prevent runaway`,
			confidence: 1.0,
			loopCount: goalState.loopCount,
			maxLoops: goalState.maxLoops,
		};
	}

	// Repeated instruction detection
	if (goalState.repeatedInstructionCount >= config.limits.maxRepeatedInstructions) {
		return {
			decision: "allow",
			status: "blocked",
			reason: `Same instruction repeated ${goalState.repeatedInstructionCount} times — likely infinite loop, allowing stop`,
			confidence: 1.0,
			loopCount: goalState.loopCount,
			maxLoops: goalState.maxLoops,
		};
	}

	// Failed validation limit
	if (goalState.failedValidationCount >= config.limits.maxFailedValidations) {
		return {
			decision: "allow",
			status: "needs_user",
			reason: `Failed validation count (${goalState.failedValidationCount}) reached limit (${config.limits.maxFailedValidations}) — needs human intervention`,
			confidence: 1.0,
			loopCount: goalState.loopCount,
			maxLoops: goalState.maxLoops,
		};
	}

	return null;
}

/**
 * Orchestrates the full Stop evaluation pipeline:
 * 1. Load active goal
 * 2. Check pre-AI escape hatches
 * 3. Gather evidence
 * 4. Call AI evaluator
 * 5. Update counters (loop count, repeated instructions, failed validations)
 * 6. Store evaluation
 * 7. Return decision
 */
export async function evaluateStop(
	db: Database,
	cwd: string,
	sessionId: string,
	hookPayload: Record<string, unknown>,
	config: DaemonConfig,
): Promise<EvaluateStopResult> {
	// 1. Load active goal
	const active = getActiveGoal(db, cwd);
	if (!active) {
		return {
			decision: "allow",
			status: "done",
			reason: "No active goal — nothing to evaluate",
			confidence: 1.0,
			loopCount: 0,
			maxLoops: 0,
		};
	}

	const goalState: GoalState = JSON.parse(active.state_json);

	// 2. Pre-AI escape hatches
	const escaped = checkEscapeHatches(goalState, config);
	if (escaped) {
		// Still increment loop count for tracking
		incrementLoopCount(db, active.id);
		storeEvaluation(db, active.id, escaped, null);
		return escaped;
	}

	// 3. Gather evidence
	const evidence = await gatherEvidence(cwd, active.id, db);

	// Read plan.md and progress.md if they exist
	const planPath = join(cwd, ".claude", "goal", "plan.md");
	const progressPath = join(cwd, ".claude", "goal", "progress.md");
	const planMd = existsSync(planPath) ? readFileSync(planPath, "utf-8") : null;
	const progressMd = existsSync(progressPath) ? readFileSync(progressPath, "utf-8") : null;

	const lastAssistantMessage = hookPayload.lastAssistantMessage as string | undefined;

	// 4. Call AI evaluator
	const { evaluation, provider, modelId } = await evaluateGoal(config, db, {
		goal: goalState,
		evidence,
		planMd,
		progressMd,
		lastAssistantMessage,
	});

	// 5. Store evaluation
	storeEvaluation(db, active.id, {
		decision: evaluation.decision,
		status: evaluation.status,
		reason: evaluation.reason,
		nextInstruction: evaluation.nextInstruction,
		confidence: evaluation.confidence,
		loopCount: goalState.loopCount,
		maxLoops: goalState.maxLoops,
	}, { provider, modelId, evidence });

	// 6. Increment loop count
	incrementLoopCount(db, active.id);

	// 7. Update repeated instruction tracking
	if (evaluation.decision === "block" && evaluation.nextInstruction) {
		if (isRepeatedInstruction(db, active.id, evaluation.nextInstruction)) {
			incrementRepeatedInstructionCount(db, active.id);
		} else {
			resetRepeatedInstructionCount(db, active.id);
		}
	}

	// 8. Track failed validations — if blocking and no validation evidence found
	if (
		evaluation.decision === "block" &&
		evidence.recentValidationCommands.length === 0 &&
		evaluation.missingEvidence.length > 0
	) {
		incrementFailedValidationCount(db, active.id);
	}

	// Re-read to get updated counts
	const updated = getActiveGoal(db, cwd);
	const updatedState: GoalState = updated
		? JSON.parse(updated.state_json)
		: goalState;

	return {
		decision: evaluation.decision,
		status: evaluation.status,
		reason: evaluation.reason,
		nextInstruction: evaluation.nextInstruction,
		confidence: evaluation.confidence,
		loopCount: updatedState.loopCount,
		maxLoops: updatedState.maxLoops,
	};
}

function storeEvaluation(
	db: Database,
	goalId: string,
	result: EvaluateStopResult,
	meta: { provider: string; modelId: string; evidence: unknown } | null,
): void {
	db.prepare(
		`INSERT INTO goal_evaluations (goal_id, created_at, decision, status, reason, next_instruction, confidence, evidence_json, model_info_json)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		goalId,
		new Date().toISOString(),
		result.decision,
		result.status,
		result.reason,
		result.nextInstruction ?? null,
		result.confidence,
		meta?.evidence ? JSON.stringify(meta.evidence) : "{}",
		meta ? JSON.stringify({ provider: meta.provider, modelId: meta.modelId }) : '{"provider":"local","modelId":"escape-hatch"}',
	);
}
