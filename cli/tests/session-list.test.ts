import { describe, expect, test } from "bun:test";
import type { SessionSummary } from "../src/loaders/history-loader.js";
import type { SessionMeta } from "../src/loaders/session-meta.js";
import {
	formatSessionListJson,
	formatSessionListText,
	type SessionListEntry,
} from "../src/output/session-list.js";

const makeSummary = (overrides?: Partial<SessionSummary>): SessionSummary => ({
	sessionId: "aaaa1111-1111-1111-1111-111111111111",
	project: "/workspaces/projects/TestProject",
	firstPrompt: "What is the project structure?",
	promptCount: 2,
	timestamps: {
		first: "2026-03-01T10:00:00.000Z",
		last: "2026-03-01T10:05:00.000Z",
	},
	...overrides,
});

const makeMeta = (overrides?: Partial<SessionMeta>): SessionMeta => ({
	sessionId: "aaaa1111-1111-1111-1111-111111111111",
	slug: "wondrous-rainbow",
	filesRead: [],
	filesWritten: [],
	filesEdited: [],
	messageCount: 10,
	timeRange: {
		start: "2026-03-01T10:00:00Z",
		end: "2026-03-01T10:05:00Z",
	},
	...overrides,
});

describe("session list formatter", () => {
	test("text format includes session ID prefix", () => {
		const entries: SessionListEntry[] = [{ summary: makeSummary() }];
		const output = formatSessionListText(entries, { noColor: true });
		expect(output).toContain("aaaa1111");
	});

	test("text format includes first prompt", () => {
		const entries: SessionListEntry[] = [{ summary: makeSummary() }];
		const output = formatSessionListText(entries, { noColor: true });
		expect(output).toContain("What is the project structure?");
	});

	test("text format includes session count", () => {
		const entries: SessionListEntry[] = [
			{ summary: makeSummary() },
			{
				summary: makeSummary({
					sessionId: "bbbb2222-2222-2222-2222-222222222222",
				}),
			},
		];
		const output = formatSessionListText(entries, { noColor: true });
		expect(output).toContain("2 sessions listed");
	});

	test("text format shows slug from meta", () => {
		const entries: SessionListEntry[] = [
			{
				summary: makeSummary(),
				meta: makeMeta(),
			},
		];
		const output = formatSessionListText(entries, { noColor: true });
		expect(output).toContain("wondrous-rainbow");
	});

	test("text format shows message count from meta", () => {
		const entries: SessionListEntry[] = [
			{
				summary: makeSummary(),
				meta: makeMeta(),
			},
		];
		const output = formatSessionListText(entries, { noColor: true });
		expect(output).toContain("10 messages");
	});

	test("text format shows dash when no slug", () => {
		const entries: SessionListEntry[] = [{ summary: makeSummary() }];
		const output = formatSessionListText(entries, { noColor: true });
		// Without meta, slug should show as em-dash
		expect(output).toContain("\u2014");
	});

	test("text format truncates long prompts at 80 chars", () => {
		const longPrompt = "A".repeat(100);
		const entries: SessionListEntry[] = [
			{ summary: makeSummary({ firstPrompt: longPrompt }) },
		];
		const output = formatSessionListText(entries, { noColor: true });
		expect(output).toContain("...");
		// Should contain first 80 chars
		expect(output).toContain("A".repeat(80));
	});

	test("text format does not truncate short prompts", () => {
		const shortPrompt = "Short prompt";
		const entries: SessionListEntry[] = [
			{ summary: makeSummary({ firstPrompt: shortPrompt }) },
		];
		const output = formatSessionListText(entries, { noColor: true });
		expect(output).toContain("Short prompt");
		expect(output).not.toContain("Short prompt...");
	});

	test("text format includes project path", () => {
		const entries: SessionListEntry[] = [{ summary: makeSummary() }];
		const output = formatSessionListText(entries, { noColor: true });
		expect(output).toContain("/workspaces/projects/TestProject");
	});

	test("JSON format returns valid JSON with expected fields", () => {
		const entries: SessionListEntry[] = [{ summary: makeSummary() }];
		const output = formatSessionListJson(entries);
		const parsed = JSON.parse(output);
		expect(Array.isArray(parsed)).toBe(true);
		expect(parsed[0].sessionId).toBe("aaaa1111-1111-1111-1111-111111111111");
		expect(parsed[0].project).toBe("/workspaces/projects/TestProject");
		expect(parsed[0].timeRange).toBeDefined();
		expect(parsed[0].timeRange.start).toBe("2026-03-01T10:00:00.000Z");
		expect(parsed[0].timeRange.end).toBe("2026-03-01T10:05:00.000Z");
	});

	test("JSON format includes slug from meta", () => {
		const entries: SessionListEntry[] = [
			{
				summary: makeSummary(),
				meta: makeMeta(),
			},
		];
		const output = formatSessionListJson(entries);
		const parsed = JSON.parse(output);
		expect(parsed[0].slug).toBe("wondrous-rainbow");
	});

	test("JSON format has null slug without meta", () => {
		const entries: SessionListEntry[] = [{ summary: makeSummary() }];
		const output = formatSessionListJson(entries);
		const parsed = JSON.parse(output);
		expect(parsed[0].slug).toBeNull();
	});

	test("JSON format uses meta messageCount when available", () => {
		const entries: SessionListEntry[] = [
			{
				summary: makeSummary({ promptCount: 2 }),
				meta: makeMeta({ messageCount: 10 }),
			},
		];
		const output = formatSessionListJson(entries);
		const parsed = JSON.parse(output);
		expect(parsed[0].messageCount).toBe(10);
	});

	test("JSON format falls back to promptCount without meta", () => {
		const entries: SessionListEntry[] = [
			{ summary: makeSummary({ promptCount: 5 }) },
		];
		const output = formatSessionListJson(entries);
		const parsed = JSON.parse(output);
		expect(parsed[0].messageCount).toBe(5);
	});

	test("empty entries list", () => {
		const output = formatSessionListText([], { noColor: true });
		expect(output).toContain("0 sessions listed");
	});
});
