export interface ModelConfig {
	planner: string[];
	evaluator: string[];
	[role: string]: string[];
}

export interface LimitsConfig {
	maxGoalLoops: number;
	maxRepeatedInstructions: number;
	maxFailedValidations: number;
	maxJobRuntimeSeconds: number;
	maxHookOutputChars: number;
}

export interface DaemonConfig {
	host: string;
	port: number;
	dbPath: string;
	logPath: string;
	pidPath: string;
	models: ModelConfig;
	limits: LimitsConfig;
}

export interface HealthResponse {
	status: string;
	version: string;
	uptime: number;
	db: string;
	pid: number;
}

export interface StatusResponse {
	daemon: string;
	port: number;
	db: { path: string; size: number };
	activeGoal: null;
	uptime: number;
}

export interface GoalRow {
	id: string;
	cwd: string;
	session_id: string | null;
	objective: string;
	status: string;
	created_at: string;
	updated_at: string;
	paused: number;
	loop_count: number;
	max_loops: number;
	failed_validation_count: number;
	repeated_instruction_count: number;
	state_json: string;
}

export interface GoalEventRow {
	id: number;
	goal_id: string | null;
	session_id: string | null;
	cwd: string;
	kind: string;
	created_at: string;
	payload_json: string;
}

// --- Session 2: Goal State Layer types ---

export type GoalStatus = "active" | "paused" | "cleared" | "done";

export type GoalEventKind =
	| "goal_created"
	| "goal_planned"
	| "goal_paused"
	| "goal_resumed"
	| "goal_cleared"
	| "goal_completed"
	| "hook_event"
	| "tool_event"
	| "evaluation"
	| "error";

export interface GoalState {
	id: string;
	active: boolean;
	paused: boolean;
	status: GoalStatus;
	objective: string;
	currentCheckpoint: string;
	loopCount: number;
	maxLoops: number;
	failedValidationCount: number;
	repeatedInstructionCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface GoalEvent {
	goalId: string | null;
	sessionId: string | null;
	cwd: string;
	kind: GoalEventKind;
	payload: Record<string, unknown>;
}

export interface Evidence {
	gitStatus: string[];
	gitDiffStat: string[];
	gitDiffNames: string[];
	uncheckedPlanItems: string[];
	checkedPlanItems: string[];
	recentValidationCommands: string[];
	changedFilesSinceGoalStart: string[];
}

export interface CreateGoalInput {
	cwd: string;
	objective: string;
	sessionId?: string;
}

// --- Session 4: Zod schemas for AI agents ---

import { z } from "zod";

export const GoalPlanSchema = z.object({
	objective: z.string(),
	successCriteria: z.array(z.string()),
	milestones: z.array(
		z.object({
			id: z.string(),
			title: z.string(),
			description: z.string(),
			done: z.boolean().default(false),
			validation: z.string().optional(),
		}),
	),
	suggestedValidationCommands: z.array(z.string()),
	risks: z.array(z.string()),
	nextCheckpoint: z.string(),
});

export type GoalPlan = z.infer<typeof GoalPlanSchema>;

export const GoalEvaluationSchema = z.object({
	decision: z.enum(["allow", "block"]),
	status: z.enum([
		"done",
		"continue",
		"blocked",
		"needs_user",
		"paused",
		"budget_limited",
	]),
	reason: z.string(),
	nextInstruction: z.string().optional(),
	confidence: z.number().min(0).max(1),
	missingEvidence: z.array(z.string()).default([]),
	completedCriteria: z.array(z.string()).default([]),
	incompleteCriteria: z.array(z.string()).default([]),
});

export type GoalEvaluation = z.infer<typeof GoalEvaluationSchema>;
