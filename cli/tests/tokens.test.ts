import { describe, expect, test } from "bun:test";
import {
	isFileWithinTimeRange,
	pathToProjectSlug,
} from "../src/commands/session/tokens.js";

describe("pathToProjectSlug", () => {
	test("encodes absolute paths to claude's slug form", () => {
		expect(pathToProjectSlug("/workspaces/projects/CodeForge")).toBe(
			"-workspaces-projects-CodeForge",
		);
	});

	test("encodes dotfiles with double dashes like claude does", () => {
		// /workspaces/.devcontainer -> /workspaces/-devcontainer (slash -> dash,
		// then the leading dot on the next segment becomes another dash)
		expect(pathToProjectSlug("/workspaces/.devcontainer")).toBe(
			"-workspaces--devcontainer",
		);
	});

	test("strips trailing slashes before encoding", () => {
		expect(pathToProjectSlug("/workspaces/projects/CodeForge/")).toBe(
			"-workspaces-projects-CodeForge",
		);
		expect(pathToProjectSlug("/workspaces/projects/CodeForge///")).toBe(
			"-workspaces-projects-CodeForge",
		);
	});

	test("passes plain substrings through unchanged for backwards compat", () => {
		// No separator -> user wants substring match against a slug
		expect(pathToProjectSlug("CodeForge")).toBe("CodeForge");
		expect(pathToProjectSlug("projects-CodeForge")).toBe("projects-CodeForge");
	});

	test("resolves relative ./ and ../ paths before encoding", () => {
		const abs = pathToProjectSlug("./foo");
		// Resolved path always ends with /foo; after encoding trailing segment is -foo
		expect(abs.endsWith("-foo")).toBe(true);
		// On POSIX, resolved absolute paths start with `/` which encodes to `-`.
		// On Windows they start with a drive letter (e.g. `D:`) so the leading
		// `-` assertion is POSIX-only.
		if (process.platform !== "win32") {
			expect(abs.startsWith("-")).toBe(true);
		}

		const abs2 = pathToProjectSlug("../bar");
		expect(abs2.endsWith("-bar")).toBe(true);
	});
});

describe("isFileWithinTimeRange", () => {
	const jan1 = new Date("2026-01-01T00:00:00Z");
	const feb1 = new Date("2026-02-01T00:00:00Z");
	const mar1 = new Date("2026-03-01T00:00:00Z");

	test("returns true when no bounds are given", () => {
		expect(isFileWithinTimeRange(feb1)).toBe(true);
	});

	test("since: includes mtimes at or after the bound", () => {
		expect(isFileWithinTimeRange(feb1, jan1)).toBe(true);
		expect(isFileWithinTimeRange(feb1, feb1)).toBe(true); // inclusive
		expect(isFileWithinTimeRange(feb1, mar1)).toBe(false);
	});

	test("until: includes mtimes at or before the bound", () => {
		expect(isFileWithinTimeRange(feb1, undefined, mar1)).toBe(true);
		expect(isFileWithinTimeRange(feb1, undefined, feb1)).toBe(true); // inclusive
		expect(isFileWithinTimeRange(feb1, undefined, jan1)).toBe(false);
	});

	test("since + until: inclusive range", () => {
		expect(isFileWithinTimeRange(feb1, jan1, mar1)).toBe(true);
		expect(isFileWithinTimeRange(jan1, feb1, mar1)).toBe(false);
		expect(isFileWithinTimeRange(mar1, jan1, feb1)).toBe(false);
	});
});
