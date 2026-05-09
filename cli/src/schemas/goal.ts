export interface ModelConfig {
	[role: string]: string;
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
