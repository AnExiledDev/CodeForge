import { describe, expect, test } from "bun:test";
import type { SessionMeta } from "../src/loaders/session-meta.js";
import type { TaskWithTeam } from "../src/loaders/task-loader.js";
import {
	formatSessionShowJson,
	formatSessionShowText,
	type SessionShowData,
} from "../src/output/session-show.js";
import type { PlanMeta } from "../src/schemas/plan.js";

const makeMeta = (overrides?: Partial<SessionMeta>): SessionMeta => ({
	sessionId: "meta-sess-001",
	slug: "wondrous-rainbow",
	teamName: "test-team",
	cwd: "/workspaces/projects/TestProject",
	gitBranch: "feat/auth",
	filesRead: ["/src/auth.ts", "/src/login.ts"],
	filesWritten: ["/src/login.ts"],
	filesEdited: ["/src/auth.ts"],
	messageCount: 5,
	timeRange: {
		start: "2026-03-01T10:00:00Z",
		end: "2026-03-01T10:01:05Z",
	},
	...overrides,
});

const makePlan = (overrides?: Partial<PlanMeta>): PlanMeta => ({
	slug: "wondrous-rainbow",
	filePath: "/home/user/.claude/plans/wondrous-rainbow.md",
	title: "Authentication Feature Plan",
	content:
		"# Authentication Feature Plan\n\n## Context\nImplement auth.\n\n## Steps\n1. Create login",
	...overrides,
});

const makeTasks = (): TaskWithTeam[] => [
	{
		id: "1",
		subject: "Implement login",
		description: "Add login form",
		status: "completed",
		blocks: [],
		blockedBy: [],
		team: "test-team",
	},
	{
		id: "2",
		subject: "Add logout",
		description: "Logout button",
		status: "pending",
		blocks: [],
		blockedBy: ["1"],
		team: "test-team",
	},
];

const makeData = (overrides?: Partial<SessionShowData>): SessionShowData => ({
	meta: makeMeta(),
	plan: makePlan(),
	tasks: makeTasks(),
	...overrides,
});

describe("session show formatter", () => {
	test("text format includes session ID", () => {
		const output = formatSessionShowText(makeData(), { noColor: true });
		expect(output).toContain("meta-sess-001");
	});

	test("text format includes slug", () => {
		const output = formatSessionShowText(makeData(), { noColor: true });
		expect(output).toContain("wondrous-rainbow");
	});

	test("text format includes project path", () => {
		const output = formatSessionShowText(makeData(), { noColor: true });
		expect(output).toContain("/workspaces/projects/TestProject");
	});

	test("text format includes team name", () => {
		const output = formatSessionShowText(makeData(), { noColor: true });
		expect(output).toContain("test-team");
	});

	test("text format includes message count", () => {
		const output = formatSessionShowText(makeData(), { noColor: true });
		expect(output).toContain("5");
	});

	test("text format includes plan section", () => {
		const output = formatSessionShowText(makeData(), { noColor: true });
		expect(output).toContain("Plan");
		expect(output).toContain("wondrous-rainbow.md");
	});

	test("text format includes tasks", () => {
		const output = formatSessionShowText(makeData(), { noColor: true });
		expect(output).toContain("Tasks");
		expect(output).toContain("Implement login");
		expect(output).toContain("Add logout");
	});

	test("text format includes task statuses", () => {
		const output = formatSessionShowText(makeData(), { noColor: true });
		expect(output).toContain("completed");
		expect(output).toContain("pending");
	});

	test("text format includes file sections", () => {
		const output = formatSessionShowText(makeData(), { noColor: true });
		expect(output).toContain("Files Read");
		expect(output).toContain("/src/auth.ts");
		expect(output).toContain("Files Written");
		expect(output).toContain("/src/login.ts");
		expect(output).toContain("Files Edited");
	});

	test("text format hides plan when showPlan is false", () => {
		const output = formatSessionShowText(makeData(), {
			noColor: true,
			showPlan: false,
		});
		expect(output).not.toContain("wondrous-rainbow.md");
	});

	test("text format hides tasks when showTasks is false", () => {
		const output = formatSessionShowText(makeData(), {
			noColor: true,
			showTasks: false,
		});
		expect(output).not.toContain("Implement login");
	});

	test("text format hides files when showFiles is false", () => {
		const output = formatSessionShowText(makeData(), {
			noColor: true,
			showFiles: false,
		});
		expect(output).not.toContain("Files Read");
		expect(output).not.toContain("Files Written");
		expect(output).not.toContain("Files Edited");
	});

	test("text format omits plan section when no plan", () => {
		const data = makeData({ plan: undefined });
		const output = formatSessionShowText(data, { noColor: true });
		expect(output).not.toContain("Plan");
	});

	test("text format omits tasks section when empty", () => {
		const data = makeData({ tasks: [] });
		const output = formatSessionShowText(data, { noColor: true });
		expect(output).not.toContain("Tasks");
	});

	test("text format shows dash for missing slug", () => {
		const data = makeData({ meta: makeMeta({ slug: undefined }) });
		const output = formatSessionShowText(data, { noColor: true });
		expect(output).toContain("\u2014");
	});

	test("text format shows dash for missing team", () => {
		const data = makeData({ meta: makeMeta({ teamName: undefined }) });
		const output = formatSessionShowText(data, { noColor: true });
		// Team line should have em-dash
		expect(output).toContain("Team:");
	});

	test("JSON format returns valid JSON with expected structure", () => {
		const output = formatSessionShowJson(makeData());
		const parsed = JSON.parse(output);
		expect(parsed.sessionId).toBe("meta-sess-001");
		expect(parsed.slug).toBe("wondrous-rainbow");
		expect(parsed.project).toBe("/workspaces/projects/TestProject");
		expect(parsed.team).toBe("test-team");
		expect(parsed.gitBranch).toBe("feat/auth");
		expect(parsed.messageCount).toBe(5);
	});

	test("JSON format includes plan data", () => {
		const output = formatSessionShowJson(makeData());
		const parsed = JSON.parse(output);
		expect(parsed.plan).not.toBeNull();
		expect(parsed.plan.slug).toBe("wondrous-rainbow");
		expect(parsed.plan.title).toBe("Authentication Feature Plan");
	});

	test("JSON format includes tasks array", () => {
		const output = formatSessionShowJson(makeData());
		const parsed = JSON.parse(output);
		expect(parsed.tasks).toHaveLength(2);
		expect(parsed.tasks[0].id).toBe("1");
		expect(parsed.tasks[0].status).toBe("completed");
		expect(parsed.tasks[1].id).toBe("2");
		expect(parsed.tasks[1].status).toBe("pending");
	});

	test("JSON format includes file arrays", () => {
		const output = formatSessionShowJson(makeData());
		const parsed = JSON.parse(output);
		expect(parsed.files.read).toHaveLength(2);
		expect(parsed.files.written).toHaveLength(1);
		expect(parsed.files.edited).toHaveLength(1);
	});

	test("JSON format has null plan when no plan", () => {
		const data = makeData({ plan: undefined });
		const output = formatSessionShowJson(data);
		const parsed = JSON.parse(output);
		expect(parsed.plan).toBeNull();
	});

	test("JSON format has null slug when missing", () => {
		const data = makeData({ meta: makeMeta({ slug: undefined }) });
		const output = formatSessionShowJson(data);
		const parsed = JSON.parse(output);
		expect(parsed.slug).toBeNull();
	});

	test("JSON format includes time range", () => {
		const output = formatSessionShowJson(makeData());
		const parsed = JSON.parse(output);
		expect(parsed.timeRange).not.toBeNull();
		expect(parsed.timeRange.start).toBe("2026-03-01T10:00:00Z");
		expect(parsed.timeRange.end).toBe("2026-03-01T10:01:05Z");
	});
});
