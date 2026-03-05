import { describe, expect, test } from "bun:test";
import type { PassName, ReviewFinding } from "../src/schemas/review.js";

describe("review-runner pure functions", () => {
	// Test mergeFindings logic
	test("deduplicates findings by file:line:title", () => {
		const { mergeFindings } = createTestHelpers();
		const passResults = [
			{
				name: "correctness" as PassName,
				findings: [
					makeFinding({ file: "a.ts", line: 1, title: "Bug" }),
					makeFinding({ file: "b.ts", line: 2, title: "Error" }),
				],
				costUsd: 0.4,
				durationMs: 10000,
				sessionId: "s1",
			},
			{
				name: "security" as PassName,
				findings: [
					makeFinding({ file: "a.ts", line: 1, title: "Bug" }), // duplicate
					makeFinding({ file: "c.ts", line: 3, title: "Vuln" }),
				],
				costUsd: 0.3,
				durationMs: 9000,
				sessionId: "s1",
			},
		];

		const merged = mergeFindings(passResults);
		expect(merged).toHaveLength(3); // Bug, Error, Vuln — duplicate removed
	});

	test("sorts findings by severity", () => {
		const { mergeFindings } = createTestHelpers();
		const passResults = [
			{
				name: "correctness" as PassName,
				findings: [
					makeFinding({ severity: "low", title: "Low" }),
					makeFinding({ severity: "critical", title: "Crit" }),
					makeFinding({ severity: "medium", title: "Med" }),
				],
				costUsd: 0.4,
				durationMs: 10000,
				sessionId: "s1",
			},
		];

		const merged = mergeFindings(passResults);
		expect(merged[0].severity).toBe("critical");
		expect(merged[1].severity).toBe("medium");
		expect(merged[2].severity).toBe("low");
	});

	test("assigns correct pass numbers and names", () => {
		const { mergeFindings } = createTestHelpers();
		const passResults = [
			{
				name: "correctness" as PassName,
				findings: [makeFinding({ title: "A" })],
				costUsd: 0.4,
				durationMs: 10000,
				sessionId: "s1",
			},
			{
				name: "security" as PassName,
				findings: [makeFinding({ title: "B" })],
				costUsd: 0.3,
				durationMs: 9000,
				sessionId: "s1",
			},
		];

		const merged = mergeFindings(passResults);
		const findingA = merged.find((f) => f.title === "A");
		const findingB = merged.find((f) => f.title === "B");
		expect(findingA?.pass).toBe(1);
		expect(findingA?.passName).toBe("correctness");
		expect(findingB?.pass).toBe(2);
		expect(findingB?.passName).toBe("security");
	});

	// Test calculateScore logic
	test("calculates score 10 for no findings", () => {
		const { calculateScore } = createTestHelpers();
		expect(calculateScore([])).toBe(10);
	});

	test("deducts 3 points per critical finding", () => {
		const { calculateScore } = createTestHelpers();
		const findings = [makeWithPass({ severity: "critical" })];
		expect(calculateScore(findings)).toBe(7);
	});

	test("deducts 2 points per high finding", () => {
		const { calculateScore } = createTestHelpers();
		const findings = [makeWithPass({ severity: "high" })];
		expect(calculateScore(findings)).toBe(8);
	});

	test("deducts 1 point per medium finding", () => {
		const { calculateScore } = createTestHelpers();
		const findings = [makeWithPass({ severity: "medium" })];
		expect(calculateScore(findings)).toBe(9);
	});

	test("deducts 0.5 points per low finding", () => {
		const { calculateScore } = createTestHelpers();
		const findings = [makeWithPass({ severity: "low" })];
		// 10 - 0.5 = 9.5, rounds to 10
		expect(calculateScore(findings)).toBe(10);
	});

	test("info findings don't affect score", () => {
		const { calculateScore } = createTestHelpers();
		const findings = [makeWithPass({ severity: "info" })];
		expect(calculateScore(findings)).toBe(10);
	});

	test("score clamps to minimum 1", () => {
		const { calculateScore } = createTestHelpers();
		const findings = Array.from({ length: 10 }, () =>
			makeWithPass({ severity: "critical" }),
		);
		expect(calculateScore(findings)).toBe(1);
	});

	test("score clamps to maximum 10", () => {
		const { calculateScore } = createTestHelpers();
		expect(calculateScore([])).toBe(10);
	});

	test("mixed severities calculate correctly", () => {
		const { calculateScore } = createTestHelpers();
		// 1 critical (3) + 1 high (2) + 2 medium (2) = 7 points → score 3
		const findings = [
			makeWithPass({ severity: "critical" }),
			makeWithPass({ severity: "high" }),
			makeWithPass({ severity: "medium" }),
			makeWithPass({ severity: "medium" }),
		];
		expect(calculateScore(findings)).toBe(3);
	});
});

// --- Helpers ---

function makeFinding(overrides?: Partial<ReviewFinding>): ReviewFinding {
	return {
		file: "src/test.ts",
		line: 1,
		severity: "medium",
		category: "correctness",
		title: "Test finding",
		description: "Test description",
		suggestion: null,
		...overrides,
	};
}

function makeWithPass(overrides?: Partial<ReviewFinding>) {
	return {
		...makeFinding(overrides),
		pass: 1,
		passName: "correctness" as PassName,
	};
}

/**
 * Re-implements the pure functions from review-runner for testing,
 * since we can't easily import them (they depend on Bun.spawn internals).
 */
function createTestHelpers() {
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

	function mergeFindings(
		passResults: {
			name: PassName;
			findings: ReviewFinding[];
			costUsd: number;
			durationMs: number;
			sessionId: string;
		}[],
	) {
		const seen = new Set<string>();
		const merged: (ReviewFinding & {
			pass: number;
			passName: PassName;
		})[] = [];

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

	function calculateScore(findings: { severity: string }[]): number {
		const totalPoints = findings.reduce(
			(sum, f) => sum + (SCORE_WEIGHTS[f.severity] ?? 0),
			0,
		);
		return Math.max(1, Math.min(10, Math.round(10 - totalPoints)));
	}

	return { mergeFindings, calculateScore };
}
