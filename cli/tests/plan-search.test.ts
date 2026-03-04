import { describe, expect, test } from "bun:test";
import {
	formatPlanJson,
	formatPlanText,
	type PlanSearchResult,
} from "../src/output/plan-text.js";
import type { PlanMeta } from "../src/schemas/plan.js";
import { evaluate, parse } from "../src/search/query-parser.js";

const plans: PlanMeta[] = [
	{
		slug: "auth-plan",
		filePath: "/plans/auth-plan.md",
		title: "Authentication Feature Plan",
		content:
			"# Authentication Feature Plan\n\n## Context\nImplement user authentication for the app.\n\n## Steps\n1. Create login form\n2. Add session management\n3. Implement logout",
	},
	{
		slug: "db-migration",
		filePath: "/plans/db-migration.md",
		title: "Database Migration Plan",
		content:
			"# Database Migration Plan\n\n## Context\nMigrate from SQLite to PostgreSQL.\n\n## Steps\n1. Set up PostgreSQL\n2. Write migration scripts\n3. Test data integrity",
	},
];

describe("plan search — query filtering", () => {
	test("query filters plans by content", () => {
		const queryNode = parse("authentication");
		const filtered = plans.filter((p) => evaluate(queryNode, p.content));
		expect(filtered).toHaveLength(1);
		expect(filtered[0].slug).toBe("auth-plan");
	});

	test("AND query narrows results", () => {
		const queryNode = parse("migration AND PostgreSQL");
		const filtered = plans.filter((p) => evaluate(queryNode, p.content));
		expect(filtered).toHaveLength(1);
		expect(filtered[0].slug).toBe("db-migration");
	});

	test("OR query widens results", () => {
		const queryNode = parse("authentication OR PostgreSQL");
		const filtered = plans.filter((p) => evaluate(queryNode, p.content));
		expect(filtered).toHaveLength(2);
	});

	test("NOT query excludes results", () => {
		const queryNode = parse("NOT PostgreSQL");
		const filtered = plans.filter((p) => evaluate(queryNode, p.content));
		expect(filtered).toHaveLength(1);
		expect(filtered[0].slug).toBe("auth-plan");
	});

	test("empty query matches all plans", () => {
		const queryNode = parse("");
		const filtered = plans.filter((p) => evaluate(queryNode, p.content));
		expect(filtered).toHaveLength(2);
	});

	test("no match returns empty", () => {
		const queryNode = parse("xyznonexistent");
		const filtered = plans.filter((p) => evaluate(queryNode, p.content));
		expect(filtered).toHaveLength(0);
	});

	test("case-insensitive matching", () => {
		const queryNode = parse("AUTHENTICATION");
		const filtered = plans.filter((p) => evaluate(queryNode, p.content));
		expect(filtered).toHaveLength(1);
		expect(filtered[0].slug).toBe("auth-plan");
	});
});

describe("plan text formatter", () => {
	test("text format includes slug and title", () => {
		const results: PlanSearchResult[] = [
			{
				plan: plans[0],
				matchingLines: ["Implement user authentication"],
			},
		];
		const output = formatPlanText(results, { noColor: true });
		expect(output).toContain("auth-plan");
		expect(output).toContain("Authentication Feature Plan");
	});

	test("text format shows matching context lines", () => {
		const results: PlanSearchResult[] = [
			{
				plan: plans[0],
				matchingLines: [
					"Implement user authentication for the app.",
					"1. Create login form",
				],
			},
		];
		const output = formatPlanText(results, { noColor: true });
		expect(output).toContain("Implement user authentication");
		expect(output).toContain("Create login form");
	});

	test("text format limits to 3 context lines by default", () => {
		const results: PlanSearchResult[] = [
			{
				plan: plans[0],
				matchingLines: ["Line 1", "Line 2", "Line 3", "Line 4", "Line 5"],
			},
		];
		const output = formatPlanText(results, { noColor: true });
		expect(output).toContain("Line 1");
		expect(output).toContain("Line 2");
		expect(output).toContain("Line 3");
		expect(output).not.toContain("Line 4");
		expect(output).not.toContain("Line 5");
	});

	test("text format includes summary count", () => {
		const results: PlanSearchResult[] = plans.map((p) => ({ plan: p }));
		const output = formatPlanText(results, { noColor: true });
		expect(output).toContain("Found 2 plans");
	});

	test("text format truncates long context lines at 120 chars", () => {
		const longLine = "B".repeat(200);
		const results: PlanSearchResult[] = [
			{ plan: plans[0], matchingLines: [longLine] },
		];
		const output = formatPlanText(results, { noColor: true });
		expect(output).toContain("...");
		expect(output).toContain("B".repeat(120));
	});

	test("text format shows full context with fullText", () => {
		const longLine = "B".repeat(200);
		const results: PlanSearchResult[] = [
			{ plan: plans[0], matchingLines: [longLine] },
		];
		const output = formatPlanText(results, {
			noColor: true,
			fullText: true,
		});
		expect(output).toContain(longLine);
		expect(output).not.toContain(longLine + "...");
	});

	test("text format shows all context lines with fullText", () => {
		const results: PlanSearchResult[] = [
			{
				plan: plans[0],
				matchingLines: ["Line 1", "Line 2", "Line 3", "Line 4", "Line 5"],
			},
		];
		const output = formatPlanText(results, {
			noColor: true,
			fullText: true,
		});
		expect(output).toContain("Line 4");
		expect(output).toContain("Line 5");
	});

	test("text format handles no matching lines", () => {
		const results: PlanSearchResult[] = [{ plan: plans[0] }];
		const output = formatPlanText(results, { noColor: true });
		expect(output).toContain("auth-plan");
		expect(output).toContain("Found 1 plans");
	});

	test("text format with empty results", () => {
		const output = formatPlanText([], { noColor: true });
		expect(output).toContain("Found 0 plans");
	});

	test("text format includes separator between plans", () => {
		const results: PlanSearchResult[] = plans.map((p) => ({ plan: p }));
		const output = formatPlanText(results, { noColor: true });
		expect(output).toContain("---");
	});
});

describe("plan JSON formatter", () => {
	test("JSON format returns valid JSON array", () => {
		const results: PlanSearchResult[] = [
			{ plan: plans[0], matchingLines: ["line1"] },
		];
		const output = formatPlanJson(results);
		const parsed = JSON.parse(output);
		expect(Array.isArray(parsed)).toBe(true);
		expect(parsed[0].slug).toBe("auth-plan");
		expect(parsed[0].title).toBe("Authentication Feature Plan");
		expect(parsed[0].filePath).toBe("/plans/auth-plan.md");
		expect(parsed[0].matchingLines).toHaveLength(1);
	});

	test("JSON format defaults matchingLines to empty array", () => {
		const results: PlanSearchResult[] = [{ plan: plans[0] }];
		const output = formatPlanJson(results);
		const parsed = JSON.parse(output);
		expect(parsed[0].matchingLines).toEqual([]);
	});

	test("JSON format with multiple plans", () => {
		const results: PlanSearchResult[] = plans.map((p) => ({
			plan: p,
			matchingLines: ["match"],
		}));
		const output = formatPlanJson(results);
		const parsed = JSON.parse(output);
		expect(parsed).toHaveLength(2);
		expect(parsed[0].slug).toBe("auth-plan");
		expect(parsed[1].slug).toBe("db-migration");
	});

	test("JSON format with empty results", () => {
		const output = formatPlanJson([]);
		const parsed = JSON.parse(output);
		expect(parsed).toEqual([]);
	});
});
