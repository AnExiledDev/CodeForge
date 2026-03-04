import { describe, expect, test } from "bun:test";
import { evaluate, parse } from "../src/search/query-parser.js";

describe("parse", () => {
	test("single bareword returns a term node", () => {
		const node = parse("hello");
		expect(node).toEqual({ type: "term", value: "hello" });
	});

	test("quoted string returns a term node with exact value", () => {
		const node = parse('"exact phrase"');
		expect(node).toEqual({ type: "term", value: "exact phrase" });
	});

	test("empty query returns term node with empty value", () => {
		const node = parse("");
		expect(node).toEqual({ type: "term", value: "" });
	});

	test("whitespace-only query returns term node with empty value", () => {
		const node = parse("   ");
		expect(node).toEqual({ type: "term", value: "" });
	});

	test("explicit AND creates and node", () => {
		const node = parse("foo AND bar");
		expect(node).toEqual({
			type: "and",
			left: { type: "term", value: "foo" },
			right: { type: "term", value: "bar" },
		});
	});

	test("implicit AND between adjacent terms", () => {
		const node = parse("foo bar");
		expect(node).toEqual({
			type: "and",
			left: { type: "term", value: "foo" },
			right: { type: "term", value: "bar" },
		});
	});

	test("OR creates or node", () => {
		const node = parse("foo OR bar");
		expect(node).toEqual({
			type: "or",
			left: { type: "term", value: "foo" },
			right: { type: "term", value: "bar" },
		});
	});

	test("NOT creates not node", () => {
		const node = parse("NOT foo");
		expect(node).toEqual({
			type: "not",
			operand: { type: "term", value: "foo" },
		});
	});

	test("AND binds tighter than OR", () => {
		// "a OR b AND c" should parse as "a OR (b AND c)"
		const node = parse("a OR b AND c");
		expect(node).toEqual({
			type: "or",
			left: { type: "term", value: "a" },
			right: {
				type: "and",
				left: { type: "term", value: "b" },
				right: { type: "term", value: "c" },
			},
		});
	});

	test("parentheses override precedence", () => {
		// "(a OR b) AND c"
		const node = parse("(a OR b) AND c");
		expect(node).toEqual({
			type: "and",
			left: {
				type: "or",
				left: { type: "term", value: "a" },
				right: { type: "term", value: "b" },
			},
			right: { type: "term", value: "c" },
		});
	});

	test("nested groups parse correctly", () => {
		const node = parse("(a AND (b OR c)) NOT d");
		// This is implicit AND between the group and "NOT d"
		expect(node.type).toBe("and");
		if (node.type === "and") {
			// Left side: (a AND (b OR c))
			expect(node.left).toEqual({
				type: "and",
				left: { type: "term", value: "a" },
				right: {
					type: "or",
					left: { type: "term", value: "b" },
					right: { type: "term", value: "c" },
				},
			});
			// Right side: NOT d
			expect(node.right).toEqual({
				type: "not",
				operand: { type: "term", value: "d" },
			});
		}
	});

	test("unbalanced parentheses throw", () => {
		expect(() => parse("(a AND b")).toThrow();
		expect(() => parse("a AND b)")).toThrow();
	});

	test("standalone NOT throws", () => {
		expect(() => parse("NOT")).toThrow();
	});
});

describe("evaluate", () => {
	test("term matches case-insensitively", () => {
		const node = parse("Hello");
		expect(evaluate(node, "hello world")).toBe(true);
		expect(evaluate(node, "HELLO WORLD")).toBe(true);
		expect(evaluate(node, "goodbye")).toBe(false);
	});

	test("empty term matches everything", () => {
		const node = parse("");
		expect(evaluate(node, "anything")).toBe(true);
		expect(evaluate(node, "")).toBe(true);
	});

	test("AND requires both terms to match", () => {
		const node = parse("foo AND bar");
		expect(evaluate(node, "foo bar baz")).toBe(true);
		expect(evaluate(node, "foo baz")).toBe(false);
		expect(evaluate(node, "bar baz")).toBe(false);
	});

	test("OR requires at least one term to match", () => {
		const node = parse("foo OR bar");
		expect(evaluate(node, "foo")).toBe(true);
		expect(evaluate(node, "bar")).toBe(true);
		expect(evaluate(node, "foo bar")).toBe(true);
		expect(evaluate(node, "baz")).toBe(false);
	});

	test("NOT excludes matching text", () => {
		const node = parse("NOT foo");
		expect(evaluate(node, "bar baz")).toBe(true);
		expect(evaluate(node, "foo bar")).toBe(false);
	});

	test("quoted phrase matches as a single term", () => {
		const node = parse('"exact phrase"');
		expect(evaluate(node, "this is an exact phrase here")).toBe(true);
		expect(evaluate(node, "exact something phrase")).toBe(false);
	});

	test("complex expression evaluates correctly", () => {
		// (a OR b) AND NOT c
		const node = parse("(a OR b) AND NOT c");
		expect(evaluate(node, "a")).toBe(true);
		expect(evaluate(node, "b")).toBe(true);
		expect(evaluate(node, "a c")).toBe(false);
		expect(evaluate(node, "d")).toBe(false);
	});
});
