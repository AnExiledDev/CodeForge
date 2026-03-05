import { describe, expect, test } from "bun:test";
import {
	basenameFromPath,
	getHome,
	normalizePath,
	resolveNormalized,
} from "../src/utils/platform.js";

describe("normalizePath", () => {
	test("converts backslashes to forward slashes", () => {
		expect(normalizePath("C:\\Users\\dev\\project")).toBe(
			"C:/Users/dev/project",
		);
	});

	test("leaves forward slashes unchanged", () => {
		expect(normalizePath("/home/dev/project")).toBe("/home/dev/project");
	});

	test("handles mixed separators", () => {
		expect(normalizePath("C:\\Users/dev\\project/src")).toBe(
			"C:/Users/dev/project/src",
		);
	});

	test("handles empty string", () => {
		expect(normalizePath("")).toBe("");
	});
});

describe("getHome", () => {
	test("returns a string with forward slashes only", () => {
		const home = getHome();
		expect(home).not.toContain("\\");
		expect(home.length).toBeGreaterThan(0);
	});
});

describe("resolveNormalized", () => {
	test("returns a normalized absolute path", () => {
		const result = resolveNormalized("/some/path", "child");
		expect(result).not.toContain("\\");
		expect(result).toContain("/some/path/child");
	});
});

describe("basenameFromPath", () => {
	test("extracts filename from Unix path", () => {
		expect(basenameFromPath("/home/user/file.txt")).toBe("file.txt");
	});

	test("extracts filename from Windows path", () => {
		expect(basenameFromPath("C:\\Users\\dev\\file.txt")).toBe("file.txt");
	});

	test("extracts filename with .jsonl extension", () => {
		expect(basenameFromPath("/path/to/session-abc.jsonl")).toBe(
			"session-abc.jsonl",
		);
	});
});
