import { describe, expect, test } from "bun:test";
import { pathToProjectSlug } from "../src/commands/session/tokens.js";

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
		expect(abs.startsWith("-")).toBe(true);

		const abs2 = pathToProjectSlug("../bar");
		expect(abs2.endsWith("-bar")).toBe(true);
	});
});
