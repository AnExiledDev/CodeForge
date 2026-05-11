import type { GoalState } from "../schemas/goal.js";

export interface EscapeLimits {
	maxGoalLoops: number;
	maxRepeatedInstructions: number;
	maxFailedValidations: number;
}

/**
 * Shared escape-hatch conditions checked before any AI model call.
 * Returns a reason string and status if the goal should short-circuit, null otherwise.
 *
 * WHY this exists as a separate module: both the orchestrator (evaluator.ts) and the
 * AI agent layer (agents/evaluator.ts) need these checks. The orchestrator uses them
 * as the primary gate; the agent layer uses them as defense-in-depth to avoid wasted
 * API calls if evaluateGoal is ever called directly.
 */
export function detectEscapeCondition(
	goalState: GoalState,
	limits: EscapeLimits,
): { status: string; reason: string } | null {
	if (goalState.paused) {
		return { status: "paused", reason: "Goal is paused — allowing stop" };
	}

	if (goalState.status !== "active") {
		return {
			status: goalState.status,
			reason: `Goal status is '${goalState.status}' — allowing stop`,
		};
	}

	if (goalState.loopCount >= limits.maxGoalLoops) {
		return {
			status: "budget_limited",
			reason: `Loop count (${goalState.loopCount}) reached limit (${limits.maxGoalLoops}) — allowing stop to prevent runaway`,
		};
	}

	if (goalState.repeatedInstructionCount >= limits.maxRepeatedInstructions) {
		return {
			status: "blocked",
			reason: `Same instruction repeated ${goalState.repeatedInstructionCount} times — likely infinite loop, allowing stop`,
		};
	}

	if (goalState.failedValidationCount >= limits.maxFailedValidations) {
		return {
			status: "needs_user",
			reason: `Failed validation count (${goalState.failedValidationCount}) reached limit (${limits.maxFailedValidations}) — needs human intervention`,
		};
	}

	return null;
}
