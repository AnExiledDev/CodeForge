import type { Database } from "bun:sqlite";
import type { LanguageModel } from "ai";
import { generateObject } from "ai";
import type { DaemonConfig, Evidence, GoalState } from "../../schemas/goal.js";
import { type GoalEvaluation, GoalEvaluationSchema } from "../../schemas/goal.js";
import { withFallback } from "./model-router.js";

const EVALUATOR_SYSTEM_PROMPT = `You are a skeptical evaluator for a software development goal managed by an AI coding agent (Claude Code). You decide whether the agent should stop or continue working.

Your job is to assess evidence and determine if the goal is complete or if work should continue.

Rules:
- Be skeptical: claims without validation evidence are insufficient
- If tests, build, or lint are required but have not been run, do NOT mark as done
- If plan checkboxes remain unchecked, do NOT mark as done unless explicitly justified
- If the next action requires human judgment or input, return decision "allow" with status "needs_user"
- If repeated failures occur (3+ failed validations or repeated instructions), return decision "allow" with status "blocked" or "needs_user"
- Never cause infinite loops — respect loop counters. If loop_count >= maxLoops, return decision "allow" with status "budget_limited"
- If the goal is paused, return decision "allow" with status "paused"
- Give specific, actionable nextInstruction when using decision "block"
- confidence should reflect how certain you are about completeness (0.0 = no idea, 1.0 = absolutely certain)
- completedCriteria and incompleteCriteria should reference specific success criteria from the plan
- missingEvidence should list what evidence would be needed to increase confidence`;

export interface EvaluatorInput {
	goal: GoalState;
	evidence: Evidence;
	planMd: string | null;
	progressMd: string | null;
	lastAssistantMessage?: string;
}

export interface EvaluatorResult {
	evaluation: GoalEvaluation;
	provider: string;
	modelId: string;
}

/**
 * Check if the evaluator should short-circuit without calling the model.
 * Returns an evaluation if short-circuit applies, null otherwise.
 */
function checkShortCircuit(input: EvaluatorInput): GoalEvaluation | null {
	if (input.goal.paused) {
		return {
			decision: "allow",
			status: "paused",
			reason: "Goal is paused — allowing stop without evaluation",
			confidence: 1.0,
			missingEvidence: [],
			completedCriteria: [],
			incompleteCriteria: [],
		};
	}

	if (input.goal.loopCount >= input.goal.maxLoops) {
		return {
			decision: "allow",
			status: "budget_limited",
			reason: `Loop count (${input.goal.loopCount}) has reached or exceeded maxLoops (${input.goal.maxLoops}) — allowing stop to prevent runaway`,
			confidence: 1.0,
			missingEvidence: [],
			completedCriteria: [],
			incompleteCriteria: [],
		};
	}

	return null;
}

function buildEvaluatorPrompt(input: EvaluatorInput): string {
	const parts: string[] = [];

	parts.push(`## Goal\nObjective: ${input.goal.objective}`);
	parts.push(`Status: ${input.goal.status}`);
	parts.push(`Loop count: ${input.goal.loopCount} / ${input.goal.maxLoops}`);
	parts.push(`Failed validations: ${input.goal.failedValidationCount}`);
	parts.push(`Repeated instructions: ${input.goal.repeatedInstructionCount}`);

	if (input.planMd) {
		parts.push(`\n## Plan\n${input.planMd}`);
	}

	if (input.progressMd) {
		parts.push(`\n## Progress\n${input.progressMd}`);
	}

	parts.push("\n## Evidence");

	if (input.evidence.gitStatus.length > 0) {
		parts.push(`### Git Status\n${input.evidence.gitStatus.join("\n")}`);
	}

	if (input.evidence.gitDiffStat.length > 0) {
		parts.push(`### Git Diff Stats\n${input.evidence.gitDiffStat.join("\n")}`);
	}

	if (input.evidence.checkedPlanItems.length > 0) {
		parts.push(`### Completed Plan Items\n${input.evidence.checkedPlanItems.map((i) => `- [x] ${i}`).join("\n")}`);
	}

	if (input.evidence.uncheckedPlanItems.length > 0) {
		parts.push(`### Incomplete Plan Items\n${input.evidence.uncheckedPlanItems.map((i) => `- [ ] ${i}`).join("\n")}`);
	}

	if (input.evidence.recentValidationCommands.length > 0) {
		parts.push(`### Recent Validation Commands\n${input.evidence.recentValidationCommands.join("\n")}`);
	}

	if (input.lastAssistantMessage) {
		const excerpt = input.lastAssistantMessage.slice(0, 2000);
		parts.push(`\n## Last Assistant Message (excerpt)\n${excerpt}`);
	}

	return parts.join("\n");
}

export async function evaluateGoal(
	config: DaemonConfig,
	db: Database,
	input: EvaluatorInput,
): Promise<EvaluatorResult> {
	// Short-circuit checks that don't need a model call
	const shortCircuit = checkShortCircuit(input);
	if (shortCircuit) {
		return {
			evaluation: shortCircuit,
			provider: "local",
			modelId: "short-circuit",
		};
	}

	const userPrompt = buildEvaluatorPrompt(input);

	const outcome = await withFallback(
		config,
		"evaluator",
		db,
		async (model: LanguageModel, timeoutMs: number) => {
			const { object } = await generateObject({
				model,
				schema: GoalEvaluationSchema,
				system: EVALUATOR_SYSTEM_PROMPT,
				prompt: userPrompt,
				abortSignal: AbortSignal.timeout(timeoutMs),
			});
			return object;
		},
	);

	// All models failed — default to allow-stop to avoid blocking Claude
	if (!outcome) {
		return {
			evaluation: {
				decision: "allow",
				status: "continue",
				reason: "All evaluator models failed — defaulting to allow stop",
				confidence: 0,
				missingEvidence: ["Model evaluation unavailable"],
				completedCriteria: [],
				incompleteCriteria: [],
			},
			provider: "fallback",
			modelId: "none",
		};
	}

	return {
		evaluation: outcome.result,
		provider: outcome.provider,
		modelId: outcome.modelId,
	};
}
