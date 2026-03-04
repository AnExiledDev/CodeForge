import { describe, expect, test } from "bun:test";
import path from "path";
import { search } from "../src/search/engine.js";

const fixturePath = path.join(import.meta.dir, "fixtures", "*.jsonl");

describe("search engine", () => {
	test("basic search finds messages containing a term", async () => {
		const result = await search({
			pattern: fixturePath,
			query: "authentication",
		});
		expect(result.messages.length).toBeGreaterThan(0);
		for (const msg of result.messages) {
			expect(msg.content.toLowerCase()).toContain("authentication");
		}
	});

	test("no query returns all searchable messages up to limit", async () => {
		const result = await search({ pattern: fixturePath });
		// Fixture has 9 lines: 8 searchable (summary, system, 3 user, 3 assistant) + 1 progress (skipped)
		expect(result.messages.length).toBe(8);
	});

	test("role filter returns only matching role", async () => {
		const result = await search({ pattern: fixturePath, role: "user" });
		expect(result.messages.length).toBeGreaterThan(0);
		for (const msg of result.messages) {
			expect(msg.type).toBe("user");
		}
	});

	test("project filter returns only matching project", async () => {
		const result = await search({
			pattern: fixturePath,
			project: "/workspaces/projects/CodeForge",
		});
		expect(result.messages.length).toBeGreaterThan(0);
		for (const msg of result.messages) {
			expect(msg.cwd).toStartWith("/workspaces/projects/CodeForge");
		}
		// Should not include OtherProject messages
		const otherProjectMsgs = result.messages.filter(
			(m) => m.cwd === "/workspaces/projects/OtherProject",
		);
		expect(otherProjectMsgs.length).toBe(0);
	});

	test("time filter with after excludes older messages", async () => {
		const result = await search({
			pattern: fixturePath,
			after: "2026-03-02T00:00:00Z",
		});
		expect(result.messages.length).toBeGreaterThan(0);
		for (const msg of result.messages) {
			expect(new Date(msg.timestamp).getTime()).toBeGreaterThanOrEqual(
				new Date("2026-03-02T00:00:00Z").getTime(),
			);
		}
	});

	test("time filter with before excludes newer messages", async () => {
		const result = await search({
			pattern: fixturePath,
			before: "2026-03-01T10:00:30Z",
		});
		expect(result.messages.length).toBeGreaterThan(0);
		for (const msg of result.messages) {
			expect(new Date(msg.timestamp).getTime()).toBeLessThanOrEqual(
				new Date("2026-03-01T10:00:30Z").getTime(),
			);
		}
	});

	test("limit restricts the number of results", async () => {
		const result = await search({ pattern: fixturePath, limit: 3 });
		expect(result.messages.length).toBe(3);
	});

	test("boolean query AND matches correctly", async () => {
		const result = await search({
			pattern: fixturePath,
			query: "JWT AND authentication",
		});
		expect(result.messages.length).toBeGreaterThan(0);
		for (const msg of result.messages) {
			const lower = msg.content.toLowerCase();
			expect(lower).toContain("jwt");
			expect(lower).toContain("authentication");
		}
	});

	test("boolean query AND does not match when only one term present", async () => {
		const result = await search({
			pattern: fixturePath,
			query: "JWT AND database",
		});
		// No single message contains both JWT and database
		expect(result.messages.length).toBe(0);
	});

	test("stats object has correct structure", async () => {
		const result = await search({ pattern: fixturePath });
		expect(result.stats.totalMatches).toBe(8);
		expect(result.stats.totalFilesSearched).toBe(1);
		expect(result.stats.uniqueSessions).toBe(2);
		expect(result.stats.timeRange).not.toBeNull();
		expect(result.stats.timeRange!.earliest).toBe("2026-03-01T10:00:00Z");
		expect(result.stats.timeRange!.latest).toBe("2026-03-02T14:00:01Z");
		expect(result.stats.messagesByRole.user).toBe(3);
		expect(result.stats.messagesByRole.assistant).toBe(3);
		expect(result.stats.messagesByRole.summary).toBe(1);
		expect(result.stats.messagesByRole.system).toBe(1);
	});

	test("empty results for query with no matches", async () => {
		const result = await search({
			pattern: fixturePath,
			query: "xyznonexistent",
		});
		expect(result.messages.length).toBe(0);
		expect(result.stats.totalMatches).toBe(0);
		expect(result.stats.timeRange).toBeNull();
	});

	test("results are sorted newest-first", async () => {
		const result = await search({ pattern: fixturePath });
		for (let i = 1; i < result.messages.length; i++) {
			const prevTime = new Date(result.messages[i - 1].timestamp).getTime();
			const currTime = new Date(result.messages[i].timestamp).getTime();
			expect(prevTime).toBeGreaterThanOrEqual(currTime);
		}
	});

	test("durationMs is a positive number", async () => {
		const result = await search({ pattern: fixturePath });
		expect(result.durationMs).toBeGreaterThan(0);
	});

	test("session filter matches specific session", async () => {
		const result = await search({
			pattern: fixturePath,
			sessionId: "sess-001",
		});
		// sess-001 has: summary, system, 2 user, 2 assistant = 6 (progress skipped)
		expect(result.messages.length).toBe(6);
		for (const msg of result.messages) {
			expect(msg.sessionId).toBe("sess-001");
		}
	});
});
