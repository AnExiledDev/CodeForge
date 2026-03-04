import chalk from "chalk";
import type { PlanMeta } from "../schemas/plan.js";

export interface PlanSearchResult {
	plan: PlanMeta;
	matchingLines?: string[];
}

export function formatPlanText(
	results: PlanSearchResult[],
	options?: { noColor?: boolean; fullText?: boolean },
): string {
	if (options?.noColor) {
		chalk.level = 0;
	}

	const lines: string[] = [];

	for (const result of results) {
		lines.push(
			`${chalk.cyan(result.plan.slug)}  ${chalk.bold(result.plan.title)}`,
		);

		if (result.matchingLines && result.matchingLines.length > 0) {
			const contextLines = options?.fullText
				? result.matchingLines
				: result.matchingLines.slice(0, 3);
			for (const line of contextLines) {
				const truncated = options?.fullText
					? line
					: line.length > 120
						? line.slice(0, 120) + "..."
						: line;
				lines.push(`  ${chalk.dim(truncated)}`);
			}
		}

		lines.push("---");
	}

	lines.push(chalk.dim(`Found ${results.length} plans`));

	return lines.join("\n");
}

export function formatPlanJson(results: PlanSearchResult[]): string {
	const output = results.map((r) => ({
		slug: r.plan.slug,
		title: r.plan.title,
		filePath: r.plan.filePath,
		matchingLines: r.matchingLines ?? [],
	}));

	return JSON.stringify(output, null, 2);
}
