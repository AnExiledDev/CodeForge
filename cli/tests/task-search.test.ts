import { describe, expect, test } from "bun:test";
import type { TaskWithTeam } from "../src/loaders/task-loader.js";
import { formatTaskJson, formatTaskText } from "../src/output/task-text.js";
import { evaluate, parse } from "../src/search/query-parser.js";

const tasks: TaskWithTeam[] = [
	{
		id: "1",
		subject: "Implement login",
		description: "Add login form with validation",
		status: "completed",
		blocks: [],
		blockedBy: [],
		team: "test-team",
	},
	{
		id: "2",
		subject: "Add logout button",
		description: "Implement logout functionality",
		status: "pending",
		blocks: [],
		blockedBy: ["1"],
		team: "test-team",
	},
	{
		id: "3",
		subject: "Fix database query",
		description: "Optimize slow queries",
		status: "in_progress",
		blocks: [],
		blockedBy: [],
		team: "other-team",
	},
];

describe("task search — query filtering", () => {
	test("query filters tasks by subject + description", () => {
		const queryNode = parse("login");
		const filtered = tasks.filter((t) =>
			evaluate(queryNode, t.subject + " " + t.description),
		);
		expect(filtered).toHaveLength(1);
		expect(filtered[0].id).toBe("1");
	});

	test("query matches across subject and description", () => {
		const queryNode = parse("logout");
		const filtered = tasks.filter((t) =>
			evaluate(queryNode, t.subject + " " + t.description),
		);
		// Task 2 has "logout" in both subject and description
		expect(filtered).toHaveLength(1);
		expect(filtered[0].id).toBe("2");
	});

	test("AND query narrows results", () => {
		const queryNode = parse("login AND validation");
		const filtered = tasks.filter((t) =>
			evaluate(queryNode, t.subject + " " + t.description),
		);
		expect(filtered).toHaveLength(1);
		expect(filtered[0].id).toBe("1");
	});

	test("OR query widens results", () => {
		const queryNode = parse("login OR database");
		const filtered = tasks.filter((t) =>
			evaluate(queryNode, t.subject + " " + t.description),
		);
		expect(filtered).toHaveLength(2);
	});

	test("NOT query excludes results", () => {
		const queryNode = parse("NOT database");
		const filtered = tasks.filter((t) =>
			evaluate(queryNode, t.subject + " " + t.description),
		);
		expect(filtered).toHaveLength(2);
		expect(filtered.find((t) => t.id === "3")).toBeUndefined();
	});

	test("empty query matches all", () => {
		const queryNode = parse("");
		const filtered = tasks.filter((t) =>
			evaluate(queryNode, t.subject + " " + t.description),
		);
		expect(filtered).toHaveLength(3);
	});

	test("case-insensitive matching", () => {
		const queryNode = parse("LOGIN");
		const filtered = tasks.filter((t) =>
			evaluate(queryNode, t.subject + " " + t.description),
		);
		expect(filtered).toHaveLength(1);
		expect(filtered[0].id).toBe("1");
	});

	test("no match returns empty", () => {
		const queryNode = parse("nonexistent");
		const filtered = tasks.filter((t) =>
			evaluate(queryNode, t.subject + " " + t.description),
		);
		expect(filtered).toHaveLength(0);
	});
});

describe("task text formatter", () => {
	test("text format includes team name", () => {
		const output = formatTaskText(tasks, { noColor: true });
		expect(output).toContain("[test-team]");
		expect(output).toContain("[other-team]");
	});

	test("text format includes task IDs", () => {
		const output = formatTaskText(tasks, { noColor: true });
		expect(output).toContain("#1");
		expect(output).toContain("#2");
		expect(output).toContain("#3");
	});

	test("text format includes statuses", () => {
		const output = formatTaskText(tasks, { noColor: true });
		expect(output).toContain("completed");
		expect(output).toContain("pending");
		expect(output).toContain("in_progress");
	});

	test("text format includes subjects", () => {
		const output = formatTaskText(tasks, { noColor: true });
		expect(output).toContain("Implement login");
		expect(output).toContain("Add logout button");
		expect(output).toContain("Fix database query");
	});

	test("text format includes descriptions", () => {
		const output = formatTaskText(tasks, { noColor: true });
		expect(output).toContain("Add login form with validation");
	});

	test("text format truncates long descriptions at 100 chars", () => {
		const longTask: TaskWithTeam[] = [
			{
				id: "99",
				subject: "Long task",
				description: "A".repeat(150),
				status: "pending",
				blocks: [],
				blockedBy: [],
				team: "t",
			},
		];
		const output = formatTaskText(longTask, { noColor: true });
		expect(output).toContain("...");
		expect(output).toContain("A".repeat(100));
	});

	test("text format shows full description with fullText option", () => {
		const longDesc = "A".repeat(150);
		const longTask: TaskWithTeam[] = [
			{
				id: "99",
				subject: "Long task",
				description: longDesc,
				status: "pending",
				blocks: [],
				blockedBy: [],
				team: "t",
			},
		];
		const output = formatTaskText(longTask, {
			noColor: true,
			fullText: true,
		});
		expect(output).toContain(longDesc);
	});

	test("text format includes summary count", () => {
		const output = formatTaskText(tasks, { noColor: true });
		expect(output).toContain("Found 3 tasks");
	});

	test("text format with empty list", () => {
		const output = formatTaskText([], { noColor: true });
		expect(output).toContain("Found 0 tasks");
	});
});

describe("task JSON formatter", () => {
	test("JSON format returns valid JSON array", () => {
		const output = formatTaskJson(tasks);
		const parsed = JSON.parse(output);
		expect(Array.isArray(parsed)).toBe(true);
		expect(parsed).toHaveLength(3);
	});

	test("JSON format includes all task fields", () => {
		const output = formatTaskJson(tasks);
		const parsed = JSON.parse(output);
		expect(parsed[0].id).toBe("1");
		expect(parsed[0].team).toBe("test-team");
		expect(parsed[0].status).toBe("completed");
		expect(parsed[0].subject).toBe("Implement login");
		expect(parsed[0].description).toBe("Add login form with validation");
		expect(parsed[0].blocks).toEqual([]);
		expect(parsed[0].blockedBy).toEqual([]);
	});

	test("JSON format preserves blockedBy relationships", () => {
		const output = formatTaskJson(tasks);
		const parsed = JSON.parse(output);
		expect(parsed[1].blockedBy).toEqual(["1"]);
	});

	test("JSON format with empty list", () => {
		const output = formatTaskJson([]);
		const parsed = JSON.parse(output);
		expect(parsed).toEqual([]);
	});
});
