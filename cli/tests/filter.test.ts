import { describe, expect, test } from "bun:test";
import type { SearchableMessage } from "../src/schemas/session-message.js";
import { createFilter } from "../src/search/filter.js";

function makeMessage(
	overrides: Partial<SearchableMessage> = {},
): SearchableMessage {
	return {
		type: "user",
		content: "test message",
		sessionId: "sess-001",
		timestamp: "2026-03-01T10:00:00Z",
		cwd: "/workspaces/projects/CodeForge",
		filePath: "/tmp/test.jsonl",
		uuid: "msg-001",
		...overrides,
	};
}

describe("createFilter", () => {
	describe("role filter", () => {
		test("matches message type exactly", () => {
			const filter = createFilter({ role: "user" });
			expect(filter(makeMessage({ type: "user" }))).toBe(true);
			expect(filter(makeMessage({ type: "assistant" }))).toBe(false);
		});

		test("is case-insensitive", () => {
			const filter = createFilter({ role: "User" });
			expect(filter(makeMessage({ type: "user" }))).toBe(true);

			const filter2 = createFilter({ role: "ASSISTANT" });
			expect(filter2(makeMessage({ type: "assistant" }))).toBe(true);
		});

		test("matches system role", () => {
			const filter = createFilter({ role: "system" });
			expect(filter(makeMessage({ type: "system" }))).toBe(true);
			expect(filter(makeMessage({ type: "user" }))).toBe(false);
		});
	});

	describe("project filter", () => {
		test("matches cwd prefix", () => {
			const filter = createFilter({
				project: "/workspaces/projects/CodeForge",
			});
			expect(
				filter(makeMessage({ cwd: "/workspaces/projects/CodeForge" })),
			).toBe(true);
			expect(
				filter(makeMessage({ cwd: "/workspaces/projects/CodeForge/cli" })),
			).toBe(true);
			expect(
				filter(makeMessage({ cwd: "/workspaces/projects/OtherProject" })),
			).toBe(false);
		});

		test("handles trailing slash in filter", () => {
			const filter = createFilter({
				project: "/workspaces/projects/CodeForge/",
			});
			expect(
				filter(makeMessage({ cwd: "/workspaces/projects/CodeForge" })),
			).toBe(true);
		});

		test("excludes messages without cwd", () => {
			const filter = createFilter({
				project: "/workspaces/projects/CodeForge",
			});
			expect(filter(makeMessage({ cwd: undefined }))).toBe(false);
		});
	});

	describe("time filter (after)", () => {
		test("includes messages at or after the date", () => {
			const filter = createFilter({ after: new Date("2026-03-01T10:00:00Z") });
			expect(filter(makeMessage({ timestamp: "2026-03-01T10:00:00Z" }))).toBe(
				true,
			);
			expect(filter(makeMessage({ timestamp: "2026-03-01T12:00:00Z" }))).toBe(
				true,
			);
		});

		test("excludes messages before the date", () => {
			const filter = createFilter({ after: new Date("2026-03-01T10:00:00Z") });
			expect(filter(makeMessage({ timestamp: "2026-03-01T09:59:59Z" }))).toBe(
				false,
			);
		});
	});

	describe("time filter (before)", () => {
		test("includes messages at or before the date", () => {
			const filter = createFilter({ before: new Date("2026-03-01T12:00:00Z") });
			expect(filter(makeMessage({ timestamp: "2026-03-01T12:00:00Z" }))).toBe(
				true,
			);
			expect(filter(makeMessage({ timestamp: "2026-03-01T10:00:00Z" }))).toBe(
				true,
			);
		});

		test("excludes messages after the date", () => {
			const filter = createFilter({ before: new Date("2026-03-01T12:00:00Z") });
			expect(filter(makeMessage({ timestamp: "2026-03-01T12:00:01Z" }))).toBe(
				false,
			);
		});
	});

	describe("time filter (range)", () => {
		test("after and before combined", () => {
			const filter = createFilter({
				after: new Date("2026-03-01T09:00:00Z"),
				before: new Date("2026-03-01T11:00:00Z"),
			});
			expect(filter(makeMessage({ timestamp: "2026-03-01T10:00:00Z" }))).toBe(
				true,
			);
			expect(filter(makeMessage({ timestamp: "2026-03-01T08:00:00Z" }))).toBe(
				false,
			);
			expect(filter(makeMessage({ timestamp: "2026-03-01T12:00:00Z" }))).toBe(
				false,
			);
		});
	});

	describe("session filter", () => {
		test("matches sessionId exactly", () => {
			const filter = createFilter({ sessionId: "sess-001" });
			expect(filter(makeMessage({ sessionId: "sess-001" }))).toBe(true);
			expect(filter(makeMessage({ sessionId: "sess-002" }))).toBe(false);
		});
	});

	describe("combined filters", () => {
		test("multiple filters compose with AND logic", () => {
			const filter = createFilter({
				role: "user",
				project: "/workspaces/projects/CodeForge",
				sessionId: "sess-001",
			});
			// All match
			expect(
				filter(
					makeMessage({
						type: "user",
						cwd: "/workspaces/projects/CodeForge",
						sessionId: "sess-001",
					}),
				),
			).toBe(true);
			// Role mismatch
			expect(
				filter(
					makeMessage({
						type: "assistant",
						cwd: "/workspaces/projects/CodeForge",
						sessionId: "sess-001",
					}),
				),
			).toBe(false);
			// Project mismatch
			expect(
				filter(
					makeMessage({
						type: "user",
						cwd: "/workspaces/projects/OtherProject",
						sessionId: "sess-001",
					}),
				),
			).toBe(false);
			// Session mismatch
			expect(
				filter(
					makeMessage({
						type: "user",
						cwd: "/workspaces/projects/CodeForge",
						sessionId: "sess-002",
					}),
				),
			).toBe(false);
		});
	});

	describe("no filters", () => {
		test("empty options matches everything", () => {
			const filter = createFilter({});
			expect(filter(makeMessage())).toBe(true);
			expect(filter(makeMessage({ type: "assistant" }))).toBe(true);
			expect(filter(makeMessage({ type: "system" }))).toBe(true);
			expect(filter(makeMessage({ cwd: "/any/path" }))).toBe(true);
		});
	});
});
