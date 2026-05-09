import { afterEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { Server } from "bun";
import type { DaemonConfig, GoalEvaluation, GoalPlan, GoalState } from "../../src/schemas/goal.js";
import { GoalEvaluationSchema, GoalPlanSchema } from "../../src/schemas/goal.js";
import { parseModelString, logModelCall, getTimeoutForRole, MissingApiKeyError } from "../../src/daemon/agents/model-router.js";
import { formatPlanMd } from "../../src/daemon/agents/planner.js";
import { openGoalDatabase, closeGoalDatabase } from "../../src/daemon/db.js";

// -----------------------------------------------------------------------
// Known-good fixture data
// -----------------------------------------------------------------------

const VALID_PLAN: GoalPlan = {
	objective: "Implement user authentication",
	successCriteria: [
		"Login endpoint returns JWT token",
		"Tests pass for auth flow",
	],
	milestones: [
		{
			id: "m1",
			title: "Add auth middleware",
			description: "Create JWT validation middleware",
			done: false,
			validation: "bun test tests/auth.test.ts",
		},
		{
			id: "m2",
			title: "Add login endpoint",
			description: "POST /auth/login returns JWT",
			done: false,
		},
		{
			id: "m3",
			title: "Add tests",
			description: "Integration tests for login flow",
			done: false,
			validation: "bun test",
		},
	],
	suggestedValidationCommands: ["bun test", "curl -X POST localhost:3000/auth/login"],
	risks: ["JWT secret management in dev vs prod"],
	nextCheckpoint: "Create auth middleware file",
};

const VALID_EVALUATION: GoalEvaluation = {
	decision: "block",
	status: "continue",
	reason: "Tests have not been run yet",
	nextInstruction: "Run `bun test` to verify the implementation",
	confidence: 0.4,
	missingEvidence: ["test results"],
	completedCriteria: ["Login endpoint created"],
	incompleteCriteria: ["Tests pass for auth flow"],
};

// -----------------------------------------------------------------------
// Model Router tests
// -----------------------------------------------------------------------

describe("model-router", () => {
	describe("parseModelString", () => {
		test("parses groq:model-name correctly", () => {
			const result = parseModelString("groq:meta-llama/llama-4-scout-17b-16e-instruct");
			expect(result.provider).toBe("groq");
			expect(result.modelId).toBe("meta-llama/llama-4-scout-17b-16e-instruct");
		});

		test("parses openrouter:model-name correctly", () => {
			const result = parseModelString("openrouter:meta-llama/llama-4-scout");
			expect(result.provider).toBe("openrouter");
			expect(result.modelId).toBe("meta-llama/llama-4-scout");
		});

		test("throws on invalid model string without colon", () => {
			expect(() => parseModelString("invalid-no-colon")).toThrow(
				/Invalid model string/,
			);
		});

		test("handles model IDs with multiple colons", () => {
			const result = parseModelString("openrouter:org/model:variant");
			expect(result.provider).toBe("openrouter");
			expect(result.modelId).toBe("org/model:variant");
		});
	});

	test("getTimeoutForRole returns 15s for evaluator", () => {
		expect(getTimeoutForRole("evaluator")).toBe(15_000);
	});

	test("getTimeoutForRole returns 30s for planner", () => {
		expect(getTimeoutForRole("planner")).toBe(30_000);
	});

	test("logs failure on model error", () => {
		const tmp = mkdtempSync(join(tmpdir(), "model-router-test-"));
		const dbPath = join(tmp, "test.db");
		const db = openGoalDatabase(dbPath);

		logModelCall(db, {
			task: "evaluator",
			provider: "groq",
			model: "test-model",
			status: "failure",
			durationMs: 150,
			errorClass: "MissingApiKeyError",
			errorMessage: "GROQ_API_KEY not set",
		});

		const rows = db
			.prepare("SELECT * FROM model_failures")
			.all() as Array<Record<string, unknown>>;

		expect(rows.length).toBe(1);
		expect(rows[0].task).toBe("evaluator");
		expect(rows[0].provider).toBe("groq");
		expect(rows[0].model).toBe("test-model");
		expect(rows[0].status).toBe("failure");
		expect(rows[0].error_class).toBe("MissingApiKeyError");
		closeGoalDatabase(db);
	});

	test("logs success on model call", () => {
		const tmp = mkdtempSync(join(tmpdir(), "model-router-test-"));
		const dbPath = join(tmp, "test.db");
		const db = openGoalDatabase(dbPath);

		logModelCall(db, {
			task: "planner",
			provider: "openrouter",
			model: "llama-4-scout",
			status: "success",
			durationMs: 2500,
		});

		const rows = db
			.prepare("SELECT * FROM model_failures WHERE status = 'success'")
			.all() as Array<Record<string, unknown>>;

		expect(rows.length).toBe(1);
		expect(rows[0].task).toBe("planner");
		expect(rows[0].status).toBe("success");
		closeGoalDatabase(db);
	});

	test("MissingApiKeyError has correct name", () => {
		const err = new MissingApiKeyError("test");
		expect(err.name).toBe("MissingApiKeyError");
		expect(err.message).toBe("test");
		expect(err).toBeInstanceOf(Error);
	});
});

// -----------------------------------------------------------------------
// Schema validation tests
// -----------------------------------------------------------------------

describe("GoalPlanSchema", () => {
	test("validates known-good plan output", () => {
		const result = GoalPlanSchema.safeParse(VALID_PLAN);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.objective).toBe(VALID_PLAN.objective);
			expect(result.data.milestones.length).toBe(3);
			expect(result.data.milestones[0].done).toBe(false);
		}
	});

	test("applies default for milestone done field", () => {
		const planWithoutDone = {
			...VALID_PLAN,
			milestones: [
				{
					id: "m1",
					title: "Test",
					description: "Test milestone",
				},
			],
		};
		const result = GoalPlanSchema.safeParse(planWithoutDone);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.milestones[0].done).toBe(false);
		}
	});

	test("rejects plan missing required fields", () => {
		const invalid = { objective: "Test" };
		const result = GoalPlanSchema.safeParse(invalid);
		expect(result.success).toBe(false);
	});
});

describe("GoalEvaluationSchema", () => {
	test("validates known-good evaluation output", () => {
		const result = GoalEvaluationSchema.safeParse(VALID_EVALUATION);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.decision).toBe("block");
			expect(result.data.status).toBe("continue");
			expect(result.data.confidence).toBe(0.4);
		}
	});

	test("applies defaults for array fields", () => {
		const minimal = {
			decision: "allow" as const,
			status: "done" as const,
			reason: "All criteria met",
			confidence: 0.95,
		};
		const result = GoalEvaluationSchema.safeParse(minimal);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.missingEvidence).toEqual([]);
			expect(result.data.completedCriteria).toEqual([]);
			expect(result.data.incompleteCriteria).toEqual([]);
		}
	});

	test("rejects confidence outside 0-1 range", () => {
		const invalid = {
			...VALID_EVALUATION,
			confidence: 1.5,
		};
		const result = GoalEvaluationSchema.safeParse(invalid);
		expect(result.success).toBe(false);
	});

	test("rejects invalid decision enum value", () => {
		const invalid = {
			...VALID_EVALUATION,
			decision: "maybe",
		};
		const result = GoalEvaluationSchema.safeParse(invalid);
		expect(result.success).toBe(false);
	});
});

// -----------------------------------------------------------------------
// Planner - formatPlanMd tests
// -----------------------------------------------------------------------

describe("formatPlanMd", () => {
	test("writes plan.md in correct checkbox format", () => {
		const md = formatPlanMd(VALID_PLAN);

		expect(md).toContain("# Goal Plan");
		expect(md).toContain("## Objective");
		expect(md).toContain(VALID_PLAN.objective);

		// Success criteria as checkboxes
		expect(md).toContain("- [ ] Login endpoint returns JWT token");
		expect(md).toContain("- [ ] Tests pass for auth flow");

		// Milestones as checkboxes
		expect(md).toContain("- [ ] Add auth middleware: Create JWT validation middleware");
		expect(md).toContain("- [ ] Add login endpoint: POST /auth/login returns JWT");

		// Validation commands in code block
		expect(md).toContain("```bash");
		expect(md).toContain("bun test");

		// Risks
		expect(md).toContain("## Risks");
		expect(md).toContain("JWT secret management");
	});

	test("marks done milestones with [x]", () => {
		const planWithDone: GoalPlan = {
			...VALID_PLAN,
			milestones: [
				{ id: "m1", title: "Done task", description: "Completed", done: true },
				{ id: "m2", title: "Open task", description: "Pending", done: false },
			],
		};
		const md = formatPlanMd(planWithDone);
		expect(md).toContain("- [x] Done task: Completed");
		expect(md).toContain("- [ ] Open task: Pending");
	});
});

// -----------------------------------------------------------------------
// Evaluator short-circuit tests
// -----------------------------------------------------------------------

describe("evaluator short-circuits", () => {
	// We test short-circuit logic by importing evaluateGoal and providing
	// a config with empty model lists — the short-circuit checks run before
	// any model call is attempted.

	function makeGoalState(overrides: Partial<GoalState> = {}): GoalState {
		return {
			id: "goal_test",
			active: true,
			paused: false,
			status: "active",
			objective: "Test objective",
			currentCheckpoint: "Begin work",
			loopCount: 0,
			maxLoops: 30,
			failedValidationCount: 0,
			repeatedInstructionCount: 0,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			...overrides,
		};
	}

	function emptyEvidence() {
		return {
			gitStatus: [],
			gitDiffStat: [],
			gitDiffNames: [],
			uncheckedPlanItems: [],
			checkedPlanItems: [],
			recentValidationCommands: [],
			changedFilesSinceGoalStart: [],
		};
	}

	function emptyConfig(tmp: string): DaemonConfig {
		return {
			host: "127.0.0.1",
			port: 0,
			dbPath: join(tmp, "test.db"),
			logPath: join(tmp, "logs", "daemon.log"),
			pidPath: join(tmp, "daemon.pid"),
			models: { planner: [], evaluator: [] },
			limits: {
				maxGoalLoops: 30,
				maxRepeatedInstructions: 3,
				maxFailedValidations: 5,
				maxJobRuntimeSeconds: 300,
				maxHookOutputChars: 8000,
			},
		};
	}

	test("returns allow when loop_count >= maxLoops", async () => {
		const { evaluateGoal } = await import("../../src/daemon/agents/evaluator.js");
		const tmp = mkdtempSync(join(tmpdir(), "eval-test-"));
		const db = openGoalDatabase(join(tmp, "test.db"));
		const config = emptyConfig(tmp);

		const result = await evaluateGoal(config, db, {
			goal: makeGoalState({ loopCount: 30, maxLoops: 30 }),
			evidence: emptyEvidence(),
			planMd: null,
			progressMd: null,
		});

		expect(result.evaluation.decision).toBe("allow");
		expect(result.evaluation.status).toBe("budget_limited");
		expect(result.provider).toBe("local");
		closeGoalDatabase(db);
	});

	test("returns allow when paused", async () => {
		const { evaluateGoal } = await import("../../src/daemon/agents/evaluator.js");
		const tmp = mkdtempSync(join(tmpdir(), "eval-test-"));
		const db = openGoalDatabase(join(tmp, "test.db"));
		const config = emptyConfig(tmp);

		const result = await evaluateGoal(config, db, {
			goal: makeGoalState({ paused: true }),
			evidence: emptyEvidence(),
			planMd: null,
			progressMd: null,
		});

		expect(result.evaluation.decision).toBe("allow");
		expect(result.evaluation.status).toBe("paused");
		expect(result.provider).toBe("local");
		closeGoalDatabase(db);
	});

	test("returns allow with fallback when all models fail", async () => {
		const { evaluateGoal } = await import("../../src/daemon/agents/evaluator.js");
		const tmp = mkdtempSync(join(tmpdir(), "eval-test-"));
		const db = openGoalDatabase(join(tmp, "test.db"));
		const config = emptyConfig(tmp);

		const result = await evaluateGoal(config, db, {
			goal: makeGoalState(),
			evidence: emptyEvidence(),
			planMd: null,
			progressMd: null,
		});

		// With empty model list, should return fallback allow
		expect(result.evaluation.decision).toBe("allow");
		expect(result.provider).toBe("fallback");
		closeGoalDatabase(db);
	});
});

// -----------------------------------------------------------------------
// Route integration tests (using mock.module to mock generateObject)
// -----------------------------------------------------------------------

// Mock the ai module before importing routes
mock.module("ai", () => ({
	generateObject: mock(),
}));

describe("route integration", () => {
	let activeServer: Server | null = null;

	function testConfig(tmp: string): DaemonConfig {
		return {
			host: "127.0.0.1",
			port: 0,
			dbPath: join(tmp, "daemon.db"),
			logPath: join(tmp, "logs", "daemon.log"),
			pidPath: join(tmp, "daemon.pid"),
			models: {
				planner: ["openrouter:test-planner-model"],
				evaluator: ["groq:test-evaluator-model"],
			},
			limits: {
				maxGoalLoops: 30,
				maxRepeatedInstructions: 3,
				maxFailedValidations: 5,
				maxJobRuntimeSeconds: 300,
				maxHookOutputChars: 8000,
			},
		};
	}

	afterEach(() => {
		if (activeServer) {
			activeServer.stop(true);
			activeServer = null;
		}
	});

	async function startTestServer() {
		const { startServer } = await import("../../src/daemon/server.js");
		const tmp = mkdtempSync(join(tmpdir(), "agents-route-test-"));
		const config = testConfig(tmp);
		activeServer = await startServer(config);
		const base = `http://127.0.0.1:${activeServer.port}`;
		return { tmp, base };
	}

	function postJson(url: string, body: Record<string, unknown>) {
		return fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
	}

	describe("POST /goal/set with planner", () => {
		test("creates goal + plan when generateObject succeeds", async () => {
			// Set up mock env vars and generateObject
			const origGroq = process.env.OPENROUTER_API_KEY;
			process.env.OPENROUTER_API_KEY = "test-key";

			const { generateObject } = await import("ai");
			const mockGenerate = generateObject as ReturnType<typeof mock>;
			mockGenerate.mockImplementation(async () => ({
				object: VALID_PLAN,
			}));

			try {
				const { tmp, base } = await startTestServer();

				const res = await postJson(`${base}/goal/set`, {
					cwd: tmp,
					objective: "Build auth",
				});

				expect(res.status).toBe(201);
				const data = (await res.json()) as { goal: GoalState; plan: GoalPlan | null };
				expect(data.goal.id).toMatch(/^goal_/);
				expect(data.goal.status).toBe("active");
				expect(data.plan).not.toBeNull();
				expect(data.plan!.objective).toBe(VALID_PLAN.objective);

				// plan.md should be written
				const planPath = join(tmp, ".claude", "goal", "plan.md");
				expect(existsSync(planPath)).toBe(true);
				const planContent = readFileSync(planPath, "utf-8");
				expect(planContent).toContain("# Goal Plan");
				expect(planContent).toContain(VALID_PLAN.objective);
			} finally {
				if (origGroq !== undefined) {
					process.env.OPENROUTER_API_KEY = origGroq;
				} else {
					delete process.env.OPENROUTER_API_KEY;
				}
			}
		});

		test("succeeds without plan on model failure", async () => {
			const { generateObject } = await import("ai");
			const mockGenerate = generateObject as ReturnType<typeof mock>;
			mockGenerate.mockImplementation(async () => {
				throw new Error("Model unavailable");
			});

			// No API keys set — model router will fail, but goal should still be created
			const origGroq = process.env.OPENROUTER_API_KEY;
			delete process.env.OPENROUTER_API_KEY;

			try {
				const { tmp, base } = await startTestServer();

				const res = await postJson(`${base}/goal/set`, {
					cwd: tmp,
					objective: "Build without plan",
				});

				expect(res.status).toBe(201);
				const data = (await res.json()) as { goal: GoalState; plan: GoalPlan | null };
				expect(data.goal.id).toMatch(/^goal_/);
				expect(data.goal.status).toBe("active");
				expect(data.plan).toBeNull();
			} finally {
				if (origGroq !== undefined) {
					process.env.OPENROUTER_API_KEY = origGroq;
				}
			}
		});
	});

	describe("POST /goal/evaluate-stop", () => {
		test("returns evaluation JSON for active goal", async () => {
			const origGroq = process.env.GROQ_API_KEY;
			process.env.GROQ_API_KEY = "test-key";

			// Mock planner to fail (so goal creation is fast)
			const { generateObject } = await import("ai");
			const mockGenerate = generateObject as ReturnType<typeof mock>;

			// First call is planner (during goal set) — make it fail
			// Second call is evaluator — return valid evaluation
			let callCount = 0;
			mockGenerate.mockImplementation(async () => {
				callCount++;
				if (callCount === 1) {
					throw new Error("planner skip");
				}
				return { object: VALID_EVALUATION };
			});

			// Also need openrouter key for planner attempt
			const origOR = process.env.OPENROUTER_API_KEY;
			process.env.OPENROUTER_API_KEY = "test-key";

			try {
				const { tmp, base } = await startTestServer();

				// Create a goal first
				await postJson(`${base}/goal/set`, {
					cwd: tmp,
					objective: "Evaluate me",
				});

				const res = await postJson(`${base}/goal/evaluate-stop`, {
					cwd: tmp,
				});

				expect(res.status).toBe(200);
				const data = (await res.json()) as { decision: string; reason: string };
				expect(data.decision).toBeDefined();
				expect(data.reason).toBeDefined();
			} finally {
				if (origGroq !== undefined) {
					process.env.GROQ_API_KEY = origGroq;
				} else {
					delete process.env.GROQ_API_KEY;
				}
				if (origOR !== undefined) {
					process.env.OPENROUTER_API_KEY = origOR;
				} else {
					delete process.env.OPENROUTER_API_KEY;
				}
			}
		});

		test("returns allow when no active goal", async () => {
			const { tmp, base } = await startTestServer();

			const res = await postJson(`${base}/goal/evaluate-stop`, {
				cwd: tmp,
			});

			expect(res.status).toBe(200);
			const data = (await res.json()) as { decision: string; status: string; reason: string };
			expect(data.decision).toBe("allow");
			expect(data.status).toBe("done");
			expect(data.reason).toContain("No active goal");
		});

		test("returns 400 when cwd missing", async () => {
			const { base } = await startTestServer();

			const res = await postJson(`${base}/goal/evaluate-stop`, {});
			expect(res.status).toBe(400);
		});
	});
});
