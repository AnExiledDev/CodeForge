import type { Database } from "bun:sqlite";
import type { LanguageModel } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { DaemonConfig } from "../../schemas/goal.js";

export type ModelRole = "planner" | "evaluator";

interface ParsedModel {
	provider: string;
	modelId: string;
}

interface ModelCallRecord {
	task: string;
	provider: string;
	model: string;
	status: "success" | "failure";
	durationMs: number;
	errorClass?: string;
	errorMessage?: string;
	fallbackUsed?: string;
}

const ROLE_TIMEOUTS: Record<ModelRole, number> = {
	evaluator: 15_000,
	planner: 30_000,
};

export function parseModelString(modelString: string): ParsedModel {
	const colonIdx = modelString.indexOf(":");
	if (colonIdx === -1) {
		throw new Error(`Invalid model string "${modelString}" — expected "provider:model-id"`);
	}
	return {
		provider: modelString.slice(0, colonIdx),
		modelId: modelString.slice(colonIdx + 1),
	};
}

function createLanguageModel(parsed: ParsedModel): LanguageModel {
	switch (parsed.provider) {
		case "groq": {
			const apiKey = process.env.GROQ_API_KEY;
			if (!apiKey) {
				throw new MissingApiKeyError("GROQ_API_KEY environment variable is not set");
			}
			const groq = createGroq({ apiKey });
			return groq(parsed.modelId);
		}
		case "openrouter": {
			const apiKey = process.env.OPENROUTER_API_KEY;
			if (!apiKey) {
				throw new MissingApiKeyError("OPENROUTER_API_KEY environment variable is not set");
			}
			const or = createOpenRouter({ apiKey });
			return or(parsed.modelId);
		}
		default:
			throw new Error(`Unknown provider "${parsed.provider}"`);
	}
}

export function logModelCall(db: Database, record: ModelCallRecord): void {
	db.prepare(
		`INSERT INTO model_failures (created_at, task, provider, model, status, duration_ms, error_class, error_message, fallback_used, payload_json)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		new Date().toISOString(),
		record.task,
		record.provider,
		record.model,
		record.status,
		record.durationMs,
		record.errorClass ?? null,
		record.errorMessage ?? null,
		record.fallbackUsed ?? null,
		null,
	);
}

export function getTimeoutForRole(role: ModelRole): number {
	return ROLE_TIMEOUTS[role];
}

function isRetryableError(err: unknown): boolean {
	if (err instanceof MissingApiKeyError) return false;
	if (err instanceof Error) {
		const msg = err.message.toLowerCase();
		if (msg.includes("429") || msg.includes("rate limit")) return true;
		if (msg.includes("timeout") || msg.includes("timed out")) return true;
		if (msg.includes("503") || msg.includes("502")) return true;
	}
	return true;
}

export interface ModelWithMeta {
	model: LanguageModel;
	provider: string;
	modelId: string;
	timeoutMs: number;
}

/**
 * Resolve a model for a given role, trying each configured model in order.
 * Returns the first model that can be constructed (has valid API key, etc.).
 * Logs failures for models that cannot be constructed.
 */
export function resolveModel(
	config: DaemonConfig,
	role: ModelRole,
	db: Database,
): ModelWithMeta | null {
	const modelList = config.models[role] ?? [];
	const timeoutMs = getTimeoutForRole(role);

	for (let i = 0; i < modelList.length; i++) {
		const modelStr = modelList[i];
		const parsed = parseModelString(modelStr);
		const start = Date.now();

		try {
			const model = createLanguageModel(parsed);
			logModelCall(db, {
				task: role,
				provider: parsed.provider,
				model: parsed.modelId,
				status: "success",
				durationMs: Date.now() - start,
			});
			return { model, provider: parsed.provider, modelId: parsed.modelId, timeoutMs };
		} catch (err) {
			const elapsed = Date.now() - start;
			logModelCall(db, {
				task: role,
				provider: parsed.provider,
				model: parsed.modelId,
				status: "failure",
				durationMs: elapsed,
				errorClass: err instanceof Error ? err.constructor.name : "Unknown",
				errorMessage: err instanceof Error ? err.message : String(err),
				fallbackUsed: i < modelList.length - 1 ? modelList[i + 1] : undefined,
			});

			if (!isRetryableError(err) && i < modelList.length - 1) {
				continue;
			}
		}
	}

	return null;
}

/**
 * Execute an async operation with fallback through the model chain.
 * On each model failure, logs the failure and tries the next model.
 * Returns null if all models fail.
 */
export async function withFallback<T>(
	config: DaemonConfig,
	role: ModelRole,
	db: Database,
	operation: (model: LanguageModel, timeoutMs: number) => Promise<T>,
): Promise<{ result: T; provider: string; modelId: string } | null> {
	const modelList = config.models[role] ?? [];
	const timeoutMs = getTimeoutForRole(role);

	for (let i = 0; i < modelList.length; i++) {
		const modelStr = modelList[i];
		const parsed = parseModelString(modelStr);
		const start = Date.now();

		try {
			const model = createLanguageModel(parsed);
			const result = await operation(model, timeoutMs);
			logModelCall(db, {
				task: role,
				provider: parsed.provider,
				model: parsed.modelId,
				status: "success",
				durationMs: Date.now() - start,
			});
			return { result, provider: parsed.provider, modelId: parsed.modelId };
		} catch (err) {
			const elapsed = Date.now() - start;
			logModelCall(db, {
				task: role,
				provider: parsed.provider,
				model: parsed.modelId,
				status: "failure",
				durationMs: elapsed,
				errorClass: err instanceof Error ? err.constructor.name : "Unknown",
				errorMessage: err instanceof Error ? err.message : String(err),
				fallbackUsed: i < modelList.length - 1 ? modelList[i + 1] : undefined,
			});
		}
	}

	return null;
}

export class MissingApiKeyError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MissingApiKeyError";
	}
}
