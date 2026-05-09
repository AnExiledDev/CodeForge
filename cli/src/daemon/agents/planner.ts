import type { Database } from "bun:sqlite";
import type { LanguageModel } from "ai";
import { generateObject } from "ai";
import type { DaemonConfig } from "../../schemas/goal.js";
import { type GoalPlan, GoalPlanSchema } from "../../schemas/goal.js";
import { withFallback } from "./model-router.js";

const PLANNER_SYSTEM_PROMPT = `You are a goal planner for a software development project. Given an objective and optional project context, produce a structured plan.

Rules:
- Keep plans small: 3-7 milestones maximum
- Each milestone must be concrete and verifiable
- Success criteria must be testable — prefer validation commands over vague descriptions
- Suggested validation commands should be actual shell commands that can verify progress
- Do not invent repository details not present in the provided context
- Risks should be specific to this objective, not generic software risks
- The nextCheckpoint should describe the immediate first action to take`;

export interface PlannerInput {
	objective: string;
	cwd: string;
	context?: {
		packageName?: string;
		packageScripts?: Record<string, string>;
		readmeExcerpt?: string;
		claudeMdExcerpt?: string;
	};
}

export interface PlannerResult {
	plan: GoalPlan;
	provider: string;
	modelId: string;
}

function buildUserPrompt(input: PlannerInput): string {
	const parts: string[] = [`## Objective\n${input.objective}`];

	if (input.context) {
		const ctx = input.context;
		if (ctx.packageName) {
			parts.push(`## Project\n${ctx.packageName}`);
		}
		if (ctx.packageScripts && Object.keys(ctx.packageScripts).length > 0) {
			const scripts = Object.entries(ctx.packageScripts)
				.map(([k, v]) => `  ${k}: ${v}`)
				.join("\n");
			parts.push(`## Available Scripts\n${scripts}`);
		}
		if (ctx.readmeExcerpt) {
			parts.push(`## README Excerpt\n${ctx.readmeExcerpt}`);
		}
		if (ctx.claudeMdExcerpt) {
			parts.push(`## CLAUDE.md Excerpt\n${ctx.claudeMdExcerpt}`);
		}
	}

	parts.push(`## Working Directory\n${input.cwd}`);
	return parts.join("\n\n");
}

export async function generatePlan(
	config: DaemonConfig,
	db: Database,
	input: PlannerInput,
): Promise<PlannerResult | null> {
	const userPrompt = buildUserPrompt(input);

	const outcome = await withFallback(
		config,
		"planner",
		db,
		async (model: LanguageModel, timeoutMs: number) => {
			const { object } = await generateObject({
				model,
				schema: GoalPlanSchema,
				system: PLANNER_SYSTEM_PROMPT,
				prompt: userPrompt,
				abortSignal: AbortSignal.timeout(timeoutMs),
			});
			return object;
		},
	);

	if (!outcome) {
		return null;
	}

	return {
		plan: outcome.result,
		provider: outcome.provider,
		modelId: outcome.modelId,
	};
}

export function formatPlanMd(plan: GoalPlan): string {
	const lines: string[] = ["# Goal Plan", ""];

	lines.push("## Objective", plan.objective, "");

	lines.push("## Success Criteria");
	for (const criterion of plan.successCriteria) {
		lines.push(`- [ ] ${criterion}`);
	}
	lines.push("");

	lines.push("## Milestones");
	for (const ms of plan.milestones) {
		const check = ms.done ? "[x]" : "[ ]";
		lines.push(`- ${check} ${ms.title}: ${ms.description}`);
	}
	lines.push("");

	if (plan.suggestedValidationCommands.length > 0) {
		lines.push("## Suggested Validation Commands", "```bash");
		for (const cmd of plan.suggestedValidationCommands) {
			lines.push(cmd);
		}
		lines.push("```", "");
	}

	if (plan.risks.length > 0) {
		lines.push("## Risks");
		for (const risk of plan.risks) {
			lines.push(`- ${risk}`);
		}
		lines.push("");
	}

	return lines.join("\n");
}
