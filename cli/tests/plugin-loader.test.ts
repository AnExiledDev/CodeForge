import { describe, expect, test } from "bun:test";
import { extractFrontMatter } from "../src/loaders/plugin-loader.js";

describe("extractFrontMatter", () => {
	test("parses simple key-value YAML", () => {
		const content = [
			"---",
			"name: explorer",
			"description: A codebase exploration agent",
			"version: 1.0.0",
			"---",
			"",
			"Body content here.",
		].join("\n");

		const result = extractFrontMatter(content);
		expect(result.name).toBe("explorer");
		expect(result.description).toBe("A codebase exploration agent");
		expect(result.version).toBe("1.0.0");
	});

	test("handles multi-line >- block scalars", () => {
		const content = [
			"---",
			"name: explorer",
			"description: >-",
			"  Fast, read-only codebase exploration agent that finds files",
			"  by patterns and searches code for keywords.",
			"tools: Read, Glob, Grep, Bash",
			"---",
		].join("\n");

		const result = extractFrontMatter(content);
		expect(result.name).toBe("explorer");
		expect(result.description).toBe(
			"Fast, read-only codebase exploration agent that finds files by patterns and searches code for keywords.",
		);
		expect(result.tools).toBe("Read, Glob, Grep, Bash");
	});

	test("handles multi-line > block scalars", () => {
		const content = [
			"---",
			"description: >",
			"  A long description that spans",
			"  multiple lines here.",
			"name: test",
			"---",
		].join("\n");

		const result = extractFrontMatter(content);
		expect(result.description).toBe(
			"A long description that spans multiple lines here.",
		);
		expect(result.name).toBe("test");
	});

	test("handles quoted values", () => {
		const content = [
			"---",
			'name: "my-plugin"',
			"description: 'A quoted description'",
			"---",
		].join("\n");

		const result = extractFrontMatter(content);
		expect(result.name).toBe("my-plugin");
		expect(result.description).toBe("A quoted description");
	});

	test("returns empty object for no front-matter", () => {
		const content = "Just some regular content.\nNo front-matter here.";
		const result = extractFrontMatter(content);
		expect(result).toEqual({});
	});

	test("handles empty front-matter block", () => {
		const content = ["---", "---", "Body content."].join("\n");
		const result = extractFrontMatter(content);
		expect(result).toEqual({});
	});

	test("handles front-matter with only whitespace lines", () => {
		const content = ["---", "name: test", "", "version: 2.0", "---"].join("\n");
		const result = extractFrontMatter(content);
		expect(result.name).toBe("test");
	});

	test("handles keys with hyphens", () => {
		const content = [
			"---",
			"skill-name: ast-grep-patterns",
			"min-version: 0.2.0",
			"---",
		].join("\n");

		const result = extractFrontMatter(content);
		expect(result["skill-name"]).toBe("ast-grep-patterns");
		expect(result["min-version"]).toBe("0.2.0");
	});
});
