import { describe, expect, test } from "bun:test";
import { formatReviewJson, formatReviewText } from "../src/output/review.js";
import type {
	PassResult,
	ReviewFindingWithPass,
	ReviewResult,
} from "../src/schemas/review.js";

const makePassResult = (overrides?: Partial<PassResult>): PassResult => ({
	name: "correctness",
	findings: [],
	costUsd: 0.42,
	durationMs: 12000,
	sessionId: "sess-001",
	...overrides,
});

const makeFinding = (
	overrides?: Partial<ReviewFindingWithPass>,
): ReviewFindingWithPass => ({
	file: "src/auth.ts",
	line: 48,
	severity: "high",
	category: "correctness",
	title: "Unchecked null access",
	description: "user.email accessed without null check",
	suggestion: "Add optional chaining: user?.email",
	pass: 1,
	passName: "correctness",
	...overrides,
});

const makeResult = (overrides?: Partial<ReviewResult>): ReviewResult => ({
	base: "staging",
	head: "HEAD",
	filesChanged: 5,
	scope: "diff",
	score: 7,
	findings: [makeFinding()],
	summary: "Review completed with 1 finding across 1 pass.",
	passes: [makePassResult()],
	totalCostUsd: 0.42,
	...overrides,
});

describe("formatReviewText", () => {
	test("includes header with base and head", () => {
		const output = formatReviewText(makeResult(), { noColor: true });
		expect(output).toContain("staging..HEAD");
	});

	test("includes files changed count", () => {
		const output = formatReviewText(makeResult(), { noColor: true });
		expect(output).toContain("5 files changed");
	});

	test("shows full codebase header for full scope", () => {
		const output = formatReviewText(makeResult({ scope: "full" }), {
			noColor: true,
		});
		expect(output).toContain("Full codebase review");
	});

	test("includes pass summary lines", () => {
		const output = formatReviewText(makeResult(), { noColor: true });
		expect(output).toContain("Pass 1: Correctness");
		expect(output).toContain("$0.42");
		expect(output).toContain("12s");
	});

	test("shows pass error when present", () => {
		const output = formatReviewText(
			makeResult({
				passes: [makePassResult({ error: "budget exceeded" })],
			}),
			{ noColor: true },
		);
		expect(output).toContain("budget exceeded");
	});

	test("includes finding severity tag", () => {
		const output = formatReviewText(makeResult(), { noColor: true });
		expect(output).toContain("[HIGH]");
	});

	test("includes finding file and line", () => {
		const output = formatReviewText(makeResult(), { noColor: true });
		expect(output).toContain("src/auth.ts:48");
	});

	test("includes finding title and description", () => {
		const output = formatReviewText(makeResult(), { noColor: true });
		expect(output).toContain("Unchecked null access");
		expect(output).toContain("user.email accessed without null check");
	});

	test("includes finding suggestion", () => {
		const output = formatReviewText(makeResult(), { noColor: true });
		expect(output).toContain("Add optional chaining: user?.email");
	});

	test("includes pass name attribution", () => {
		const output = formatReviewText(makeResult(), { noColor: true });
		expect(output).toContain("(correctness)");
	});

	test("shows no issues message when findings empty", () => {
		const output = formatReviewText(makeResult({ findings: [] }), {
			noColor: true,
		});
		expect(output).toContain("No issues found.");
	});

	test("includes score in footer", () => {
		const output = formatReviewText(makeResult(), { noColor: true });
		expect(output).toContain("Score: 7/10");
	});

	test("includes total cost in footer", () => {
		const output = formatReviewText(makeResult(), { noColor: true });
		expect(output).toContain("Total: $0.42");
	});

	test("includes severity counts in footer", () => {
		const output = formatReviewText(makeResult(), { noColor: true });
		expect(output).toContain("1 high");
	});

	test("handles finding without line number", () => {
		const output = formatReviewText(
			makeResult({
				findings: [makeFinding({ line: null })],
			}),
			{ noColor: true },
		);
		expect(output).toContain("src/auth.ts");
		expect(output).not.toContain("src/auth.ts:");
	});

	test("handles finding without suggestion", () => {
		const output = formatReviewText(
			makeResult({
				findings: [makeFinding({ suggestion: null })],
			}),
			{ noColor: true },
		);
		expect(output).toContain("Unchecked null access");
		expect(output).not.toContain("\u2192");
	});

	test("renders multiple findings with pass attribution", () => {
		const output = formatReviewText(
			makeResult({
				findings: [
					makeFinding({ passName: "correctness" }),
					makeFinding({
						file: "src/api.ts",
						line: 12,
						severity: "critical",
						title: "SQL injection",
						pass: 2,
						passName: "security",
					}),
				],
			}),
			{ noColor: true },
		);
		expect(output).toContain("(correctness)");
		expect(output).toContain("(security)");
	});

	test("includes separators", () => {
		const output = formatReviewText(makeResult(), { noColor: true });
		expect(output).toContain("\u2501".repeat(60));
	});

	test("renders multiple passes in summary", () => {
		const output = formatReviewText(
			makeResult({
				passes: [
					makePassResult({ name: "correctness" }),
					makePassResult({
						name: "security",
						costUsd: 0.31,
						durationMs: 9000,
					}),
					makePassResult({
						name: "quality",
						costUsd: 0.28,
						durationMs: 8000,
					}),
				],
			}),
			{ noColor: true },
		);
		expect(output).toContain("Pass 1: Correctness");
		expect(output).toContain("Pass 2: Security");
		expect(output).toContain("Pass 3: Quality");
	});
});

describe("formatReviewJson", () => {
	test("returns valid JSON", () => {
		const output = formatReviewJson(makeResult());
		expect(() => JSON.parse(output)).not.toThrow();
	});

	test("includes base and head", () => {
		const parsed = JSON.parse(formatReviewJson(makeResult()));
		expect(parsed.base).toBe("staging");
		expect(parsed.head).toBe("HEAD");
	});

	test("includes scope", () => {
		const parsed = JSON.parse(formatReviewJson(makeResult()));
		expect(parsed.scope).toBe("diff");
	});

	test("includes score", () => {
		const parsed = JSON.parse(formatReviewJson(makeResult()));
		expect(parsed.score).toBe(7);
	});

	test("includes filesChanged", () => {
		const parsed = JSON.parse(formatReviewJson(makeResult()));
		expect(parsed.filesChanged).toBe(5);
	});

	test("includes findings with pass info", () => {
		const parsed = JSON.parse(formatReviewJson(makeResult()));
		expect(parsed.findings).toHaveLength(1);
		expect(parsed.findings[0].file).toBe("src/auth.ts");
		expect(parsed.findings[0].line).toBe(48);
		expect(parsed.findings[0].severity).toBe("high");
		expect(parsed.findings[0].pass).toBe(1);
		expect(parsed.findings[0].passName).toBe("correctness");
	});

	test("includes cost breakdown", () => {
		const parsed = JSON.parse(formatReviewJson(makeResult()));
		expect(parsed.cost.total_usd).toBe(0.42);
		expect(parsed.cost.passes).toHaveLength(1);
		expect(parsed.cost.passes[0].name).toBe("correctness");
		expect(parsed.cost.passes[0].cost_usd).toBe(0.42);
		expect(parsed.cost.passes[0].duration_ms).toBe(12000);
	});

	test("includes summary", () => {
		const parsed = JSON.parse(formatReviewJson(makeResult()));
		expect(parsed.summary).toContain("1 finding");
	});

	test("includes pass error in cost breakdown", () => {
		const result = makeResult({
			passes: [makePassResult({ error: "budget exceeded" })],
		});
		const parsed = JSON.parse(formatReviewJson(result));
		expect(parsed.cost.passes[0].error).toBe("budget exceeded");
	});

	test("omits error field when no error", () => {
		const parsed = JSON.parse(formatReviewJson(makeResult()));
		expect(parsed.cost.passes[0]).not.toHaveProperty("error");
	});
});
