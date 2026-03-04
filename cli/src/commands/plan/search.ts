import chalk from "chalk";
import type { Command } from "commander";
import { loadPlans } from "../../loaders/plan-loader.js";
import {
	formatPlanJson,
	formatPlanText,
	type PlanSearchResult,
} from "../../output/plan-text.js";
import { evaluate, parse } from "../../search/query-parser.js";

interface PlanSearchOptions {
	limit: string;
	format: string;
	color?: boolean;
	fullText?: boolean;
}

function extractContextLines(content: string, query: string): string[] {
	const contentLines = content.split("\n");
	// Extract individual terms from the query (simple word extraction)
	const terms = query
		.replace(/\b(AND|OR|NOT)\b/gi, "")
		.replace(/[()]/g, "")
		.split(/\s+/)
		.filter((t) => t.length > 0)
		.map((t) => t.replace(/^["']|["']$/g, "").toLowerCase());

	if (terms.length === 0) return [];

	const matchingIndices = new Set<number>();

	for (let i = 0; i < contentLines.length; i++) {
		const lower = contentLines[i].toLowerCase();
		for (const term of terms) {
			if (lower.includes(term)) {
				matchingIndices.add(i);
				break;
			}
		}
	}

	// Add context lines (+/- 1 line)
	const contextIndices = new Set<number>();
	for (const idx of matchingIndices) {
		if (idx > 0) contextIndices.add(idx - 1);
		contextIndices.add(idx);
		if (idx < contentLines.length - 1) contextIndices.add(idx + 1);
	}

	// Sort and deduplicate, cap at 5
	const sorted = [...contextIndices].sort((a, b) => a - b).slice(0, 5);
	return sorted.map((i) => contentLines[i]);
}

export function registerPlanSearchCommand(parent: Command): void {
	parent
		.command("search")
		.description("Search across plan files")
		.argument("[query]", "Search query (supports AND, OR, NOT, quotes)")
		.option("-n, --limit <count>", "Maximum number of results", "20")
		.option("-f, --format <format>", "Output format: text|json", "text")
		.option("--no-color", "Disable colored output")
		.option("--full-text", "Disable content truncation")
		.action(async (query: string | undefined, options: PlanSearchOptions) => {
			try {
				if (!options.color) {
					chalk.level = 0;
				}

				const plans = await loadPlans();

				let results: PlanSearchResult[];

				if (query) {
					const queryNode = parse(query);
					results = [];
					for (const plan of plans) {
						if (evaluate(queryNode, plan.content)) {
							const matchingLines = extractContextLines(plan.content, query);
							results.push({ plan, matchingLines });
						}
					}
				} else {
					results = plans.map((plan) => ({ plan }));
				}

				// Apply limit
				const limit = parseInt(options.limit, 10);
				results = results.slice(0, limit);

				if (options.format === "json") {
					console.log(formatPlanJson(results));
				} else {
					console.log(
						formatPlanText(results, {
							noColor: !options.color,
							fullText: options.fullText,
						}),
					);
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				console.error(`Error: ${message}`);
				process.exit(1);
			}
		});
}
