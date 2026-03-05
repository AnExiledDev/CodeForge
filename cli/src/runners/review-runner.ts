import { getFullScopePrompt, getPassPrompts } from "../prompts/review.js";
import type {
	PassName,
	PassResult,
	ReviewFinding,
	ReviewFindingWithPass,
	ReviewResult,
	ReviewScope,
} from "../schemas/review.js";
import { findingsJsonSchema } from "../schemas/review.js";
import type { HeadlessResult } from "./headless.js";
import { runHeadless } from "./headless.js";

export interface ReviewOptions {
	scope: ReviewScope;
	base: string;
	include?: string;
	parallel: boolean;
	model: string;
	maxCost?: number;
	passes: 1 | 2 | 3;
	verbose: boolean;
}

const PASS_ORDER: PassName[] = ["correctness", "security", "quality"];
const BUDGET_WEIGHTS = [0.4, 0.35, 0.25];
const SEVERITY_SORT: Record<string, number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3,
	info: 4,
};
const SCORE_WEIGHTS: Record<string, number> = {
	critical: 3,
	high: 2,
	medium: 1,
	low: 0.5,
	info: 0,
};

export async function detectBaseBranch(): Promise<string> {
	for (const branch of ["staging", "main", "master"]) {
		const proc = Bun.spawn(
			["git", "rev-parse", "--verify", `refs/heads/${branch}`],
			{ stdout: "pipe", stderr: "pipe" },
		);
		await proc.exited;
		if (proc.exitCode === 0) return branch;
	}
	throw new Error(
		"Could not auto-detect base branch. Specify --base <branch>.",
	);
}

async function getDiff(
	scope: ReviewScope,
	base: string,
	include?: string,
): Promise<string> {
	if (scope === "full") return "";
	const args =
		scope === "staged"
			? ["git", "diff", "--cached"]
			: ["git", "diff", `${base}...HEAD`];
	if (include) args.push("--", include);
	const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
	const stdout = await new Response(proc.stdout).text();
	await proc.exited;
	return stdout;
}

async function getFilesChanged(
	scope: ReviewScope,
	base: string,
	include?: string,
): Promise<number> {
	if (scope === "full") return 0;
	const args =
		scope === "staged"
			? ["git", "diff", "--cached", "--numstat"]
			: ["git", "diff", "--numstat", `${base}...HEAD`];
	if (include) args.push("--", include);
	const proc = Bun.spawn(args, { stdout: "pipe" });
	const output = await new Response(proc.stdout).text();
	await proc.exited;
	return output.trim().split("\n").filter(Boolean).length;
}

function parseFindings(result: HeadlessResult): ReviewFinding[] {
	if (result.structuredOutput && typeof result.structuredOutput === "object") {
		const output = result.structuredOutput as { findings?: unknown };
		if (Array.isArray(output.findings)) {
			return output.findings as ReviewFinding[];
		}
	}
	try {
		const parsed = JSON.parse(result.result) as { findings?: unknown };
		if (Array.isArray(parsed.findings)) {
			return parsed.findings as ReviewFinding[];
		}
	} catch {
		// text result without structured output
	}
	return [];
}

function parseSummary(result: HeadlessResult): string {
	if (result.structuredOutput && typeof result.structuredOutput === "object") {
		const output = result.structuredOutput as { summary?: unknown };
		if (typeof output.summary === "string") return output.summary;
	}
	try {
		const parsed = JSON.parse(result.result) as { summary?: unknown };
		if (typeof parsed.summary === "string") return parsed.summary;
	} catch {
		// no structured summary
	}
	return "";
}

function mergeFindings(passResults: PassResult[]): ReviewFindingWithPass[] {
	const seen = new Set<string>();
	const merged: ReviewFindingWithPass[] = [];

	for (const [i, pass] of passResults.entries()) {
		for (const finding of pass.findings) {
			const key = `${finding.file}:${finding.line}:${finding.title}`;
			if (!seen.has(key)) {
				seen.add(key);
				merged.push({
					...finding,
					pass: i + 1,
					passName: pass.name,
				});
			}
		}
	}

	merged.sort(
		(a, b) =>
			(SEVERITY_SORT[a.severity] ?? 5) - (SEVERITY_SORT[b.severity] ?? 5),
	);
	return merged;
}

function calculateScore(findings: ReviewFindingWithPass[]): number {
	const totalPoints = findings.reduce(
		(sum, f) => sum + (SCORE_WEIGHTS[f.severity] ?? 0),
		0,
	);
	return Math.max(1, Math.min(10, Math.round(10 - totalPoints)));
}

function buildCommonOpts(scope: ReviewScope) {
	return {
		maxTurns: scope === "full" ? 25 : 10,
		permissionMode: "plan" as const,
		allowedTools: [
			"Read",
			"Glob",
			"Grep",
			"Bash(git diff *)",
			"Bash(git log *)",
			"Bash(git show *)",
		],
		disallowedTools: ["Write", "Edit", "NotebookEdit"],
		jsonSchema: findingsJsonSchema,
	};
}

async function runSequential(
	passOrder: PassName[],
	diff: string,
	options: ReviewOptions,
): Promise<PassResult[]> {
	const commonOpts = buildCommonOpts(options.scope);
	const passResults: PassResult[] = [];
	let sessionId: string | undefined;

	for (const [i, passName] of passOrder.entries()) {
		if (options.verbose) {
			process.stderr.write(`Pass ${i + 1}: ${passName}...\n`);
		}

		const prompts = await getPassPrompts(passName, "sequential", {
			DIFF: diff,
		});

		const spent = passResults.reduce((s, p) => s + p.costUsd, 0);
		const effectiveBudget = options.maxCost
			? Math.max(0.01, options.maxCost - spent)
			: undefined;

		let userPrompt = prompts.userPrompt;
		if (options.scope === "full") {
			userPrompt = getFullScopePrompt(passName, options.include);
		}

		try {
			const result = await runHeadless({
				...commonOpts,
				prompt: userPrompt,
				systemPromptFile: prompts.systemPromptFile,
				model: options.model,
				resume: sessionId,
				maxBudgetUsd: effectiveBudget,
			});

			sessionId = result.sessionId;

			passResults.push({
				name: passName,
				findings: parseFindings(result),
				costUsd: result.totalCostUsd,
				durationMs: result.durationMs,
				sessionId: result.sessionId,
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			passResults.push({
				name: passName,
				findings: [],
				costUsd: 0,
				durationMs: 0,
				sessionId: sessionId ?? "",
				error: message,
			});
			// Clear session if resume failed so next pass starts fresh
			if (message.includes("resume")) sessionId = undefined;
		}
	}

	return passResults;
}

async function runParallel(
	passOrder: PassName[],
	diff: string,
	options: ReviewOptions,
): Promise<PassResult[]> {
	const commonOpts = buildCommonOpts(options.scope);

	const promises = passOrder.map(async (passName, i) => {
		if (options.verbose) {
			process.stderr.write(`Pass ${i + 1}: ${passName} (parallel)...\n`);
		}

		const prompts = await getPassPrompts(passName, "parallel", {
			DIFF: diff,
		});

		const budgetForPass = options.maxCost
			? options.maxCost * BUDGET_WEIGHTS[i]
			: undefined;

		let userPrompt = prompts.userPrompt;
		if (options.scope === "full") {
			userPrompt = getFullScopePrompt(passName, options.include);
		}

		try {
			const result = await runHeadless({
				...commonOpts,
				prompt: userPrompt,
				systemPromptFile: prompts.systemPromptFile,
				model: options.model,
				maxBudgetUsd: budgetForPass,
			});

			return {
				name: passName,
				findings: parseFindings(result),
				costUsd: result.totalCostUsd,
				durationMs: result.durationMs,
				sessionId: result.sessionId,
			} as PassResult;
		} catch (err) {
			return {
				name: passName,
				findings: [],
				costUsd: 0,
				durationMs: 0,
				sessionId: "",
				error: err instanceof Error ? err.message : String(err),
			} as PassResult;
		}
	});

	return Promise.all(promises);
}

export async function runReview(options: ReviewOptions): Promise<ReviewResult> {
	const [diff, filesChanged] = await Promise.all([
		getDiff(options.scope, options.base, options.include),
		getFilesChanged(options.scope, options.base, options.include),
	]);

	if (!diff && options.scope !== "full") {
		return {
			base: options.base,
			head: "HEAD",
			filesChanged: 0,
			scope: options.scope,
			score: 10,
			findings: [],
			summary: "No changes to review.",
			passes: [],
			totalCostUsd: 0,
		};
	}

	const passOrder = PASS_ORDER.slice(0, options.passes);

	const passResults = options.parallel
		? await runParallel(passOrder, diff, options)
		: await runSequential(passOrder, diff, options);

	const findings = mergeFindings(passResults);
	const score = calculateScore(findings);
	const totalCostUsd = passResults.reduce((s, p) => s + p.costUsd, 0);

	const summaries = passResults
		.map((p) => {
			const passSummary = p.sessionId
				? parseSummary({
						result: "",
						sessionId: p.sessionId,
						isError: false,
						subtype: "",
						totalCostUsd: 0,
						numTurns: 0,
						durationMs: 0,
					})
				: "";
			return passSummary;
		})
		.filter(Boolean);

	const summary =
		summaries.join("\n\n") ||
		`Review completed with ${findings.length} finding${findings.length === 1 ? "" : "s"} across ${passResults.length} pass${passResults.length === 1 ? "" : "es"}.`;

	return {
		base: options.base,
		head: "HEAD",
		filesChanged,
		scope: options.scope,
		score,
		findings,
		summary,
		passes: passResults,
		totalCostUsd,
	};
}
