import { describe, expect, test } from "bun:test";
import { parseRelativeTime, parseTime } from "../src/utils/time.js";

describe("parseRelativeTime", () => {
	test("parses '1 day ago'", () => {
		const result = parseRelativeTime("1 day ago");
		expect(result).toBeInstanceOf(Date);
		const expected = Date.now() - 24 * 60 * 60 * 1000;
		// Allow 1 second tolerance
		expect(Math.abs(result!.getTime() - expected)).toBeLessThan(1000);
	});

	test("parses '2 hours ago'", () => {
		const result = parseRelativeTime("2 hours ago");
		expect(result).toBeInstanceOf(Date);
		const expected = Date.now() - 2 * 60 * 60 * 1000;
		expect(Math.abs(result!.getTime() - expected)).toBeLessThan(1000);
	});

	test("parses '30 minutes ago'", () => {
		const result = parseRelativeTime("30 minutes ago");
		expect(result).toBeInstanceOf(Date);
		const expected = Date.now() - 30 * 60 * 1000;
		expect(Math.abs(result!.getTime() - expected)).toBeLessThan(1000);
	});

	test("parses '1 week ago'", () => {
		const result = parseRelativeTime("1 week ago");
		expect(result).toBeInstanceOf(Date);
		const expected = Date.now() - 7 * 24 * 60 * 60 * 1000;
		expect(Math.abs(result!.getTime() - expected)).toBeLessThan(1000);
	});

	test("parses '3 months ago'", () => {
		const result = parseRelativeTime("3 months ago");
		expect(result).toBeInstanceOf(Date);
		const expected = Date.now() - 3 * 30 * 24 * 60 * 60 * 1000;
		expect(Math.abs(result!.getTime() - expected)).toBeLessThan(1000);
	});

	test("handles plural and singular forms interchangeably", () => {
		const singular = parseRelativeTime("1 day ago");
		const plural = parseRelativeTime("1 days ago");
		expect(singular).toBeInstanceOf(Date);
		expect(plural).toBeInstanceOf(Date);
		// Both should produce approximately the same result
		expect(Math.abs(singular!.getTime() - plural!.getTime())).toBeLessThan(
			1000,
		);
	});

	test("'0 days ago' returns approximately now", () => {
		const result = parseRelativeTime("0 days ago");
		expect(result).toBeInstanceOf(Date);
		expect(Math.abs(result!.getTime() - Date.now())).toBeLessThan(1000);
	});

	test("returns null for invalid input", () => {
		expect(parseRelativeTime("garbage")).toBeNull();
		expect(parseRelativeTime("")).toBeNull();
		expect(parseRelativeTime("ago 1 day")).toBeNull();
		expect(parseRelativeTime("1 lightyear ago")).toBeNull();
	});
});

describe("parseTime", () => {
	test("parses relative time strings", () => {
		const result = parseTime("1 day ago");
		expect(result).toBeInstanceOf(Date);
		const expected = Date.now() - 24 * 60 * 60 * 1000;
		expect(Math.abs(result!.getTime() - expected)).toBeLessThan(1000);
	});

	test("parses absolute ISO timestamp", () => {
		const result = parseTime("2026-03-01T10:00:00Z");
		expect(result).toBeInstanceOf(Date);
		expect(result!.toISOString()).toBe("2026-03-01T10:00:00.000Z");
	});

	test("parses absolute date string", () => {
		const result = parseTime("2026-03-01");
		expect(result).toBeInstanceOf(Date);
		expect(result!.getFullYear()).toBe(2026);
		expect(result!.getMonth()).toBe(2); // March = 2 (0-indexed)
		expect(result!.getDate()).toBe(1);
	});

	test("returns null for invalid input", () => {
		expect(parseTime("not a date")).toBeNull();
		expect(parseTime("xyz123")).toBeNull();
	});
});
