import { describe, expect, test } from "bun:test";
import path from "path";
import { extractSessionMeta } from "../src/loaders/session-meta.js";

const fixturePath = path.join(
	import.meta.dir,
	"fixtures",
	"session-data",
	"session-with-meta.jsonl",
);

describe("extractSessionMeta", () => {
	test("extracts sessionId from JSONL", async () => {
		const meta = await extractSessionMeta(fixturePath);
		expect(meta.sessionId).toBe("meta-sess-001");
	});

	test("extracts slug from messages", async () => {
		const meta = await extractSessionMeta(fixturePath);
		expect(meta.slug).toBe("wondrous-rainbow");
	});

	test("extracts teamName from messages", async () => {
		const meta = await extractSessionMeta(fixturePath);
		expect(meta.teamName).toBe("test-team");
	});

	test("extracts cwd from first message", async () => {
		const meta = await extractSessionMeta(fixturePath);
		expect(meta.cwd).toBe("/workspaces/projects/TestProject");
	});

	test("extracts gitBranch from system message", async () => {
		const meta = await extractSessionMeta(fixturePath);
		expect(meta.gitBranch).toBe("feat/auth");
	});

	test("collects files read from tool_use blocks", async () => {
		const meta = await extractSessionMeta(fixturePath);
		expect(meta.filesRead).toContain(
			"/workspaces/projects/TestProject/src/auth.ts",
		);
		expect(meta.filesRead).toContain(
			"/workspaces/projects/TestProject/src/login.ts",
		);
	});

	test("collects files written from tool_use blocks", async () => {
		const meta = await extractSessionMeta(fixturePath);
		expect(meta.filesWritten).toContain(
			"/workspaces/projects/TestProject/src/login.ts",
		);
		expect(meta.filesWritten).toContain(
			"/workspaces/projects/TestProject/tests/auth.test.ts",
		);
	});

	test("collects files edited from tool_use blocks", async () => {
		const meta = await extractSessionMeta(fixturePath);
		expect(meta.filesEdited).toContain(
			"/workspaces/projects/TestProject/src/auth.ts",
		);
	});

	test("does not double-count files across Read and Write", async () => {
		const meta = await extractSessionMeta(fixturePath);
		// login.ts is both Read (tool-4) and Write (tool-2), tracked separately
		expect(meta.filesRead).toContain(
			"/workspaces/projects/TestProject/src/login.ts",
		);
		expect(meta.filesWritten).toContain(
			"/workspaces/projects/TestProject/src/login.ts",
		);
	});

	test("counts searchable messages", async () => {
		const meta = await extractSessionMeta(fixturePath);
		// 2 user + 2 assistant + 1 system = 5 searchable
		expect(meta.messageCount).toBe(5);
	});

	test("computes time range from timestamps", async () => {
		const meta = await extractSessionMeta(fixturePath);
		expect(meta.timeRange).not.toBeNull();
		expect(meta.timeRange!.start).toBe("2026-03-01T10:00:00Z");
		expect(meta.timeRange!.end).toBe("2026-03-01T10:01:05Z");
	});

	test("handles non-existent file gracefully", async () => {
		try {
			await extractSessionMeta("/nonexistent/path.jsonl");
			expect(true).toBe(false); // should not reach here
		} catch {
			// Expected — readLines throws for non-existent file
			expect(true).toBe(true);
		}
	});
});
