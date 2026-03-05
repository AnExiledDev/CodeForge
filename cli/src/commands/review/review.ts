import chalk from "chalk";
import type { Command } from "commander";
import { formatReviewJson, formatReviewText } from "../../output/review.js";
import { detectBaseBranch, runReview } from "../../runners/review-runner.js";
import type { ReviewScope } from "../../schemas/review.js";

interface ReviewCommandOptions {
	scope: string;
	base?: string;
	include?: string;
	format: string;
	color?: boolean;
	parallel?: boolean;
	model: string;
	maxCost?: string;
	failBelow?: string;
	passes: string;
	verbose?: boolean;
}

export function registerReviewCommand(parent: Command): void {
	parent
		.command("review")
		.description("Multi-pass AI code review of branch changes")
		.option("-s, --scope <scope>", "Review scope: diff|staged|full", "diff")
		.option("-b, --base <branch>", "Base branch for diff scope")
		.option("-i, --include <glob>", "Filter files by glob pattern")
		.option("-f, --format <format>", "Output format: text|json", "text")
		.option("--no-color", "Disable colored output")
		.option(
			"--parallel",
			"Run passes concurrently (~3x cost, faster, more diverse)",
		)
		.option("-m, --model <model>", "Model for review passes", "sonnet")
		.option("--max-cost <usd>", "Maximum total USD across all passes")
		.option(
			"--fail-below <score>",
			"Exit code 1 if score below threshold (1-10)",
		)
		.option("--passes <count>", "Number of passes: 1|2|3", "3")
		.option("-v, --verbose", "Show per-pass progress to stderr")
		.action(async (options: ReviewCommandOptions) => {
			try {
				if (!options.color) chalk.level = 0;

				const scope = options.scope as ReviewScope;
				if (!["diff", "staged", "full"].includes(scope)) {
					console.error("Error: --scope must be diff, staged, or full");
					process.exit(1);
				}

				const passes = parseInt(options.passes, 10) as 1 | 2 | 3;
				if (![1, 2, 3].includes(passes)) {
					console.error("Error: --passes must be 1, 2, or 3");
					process.exit(1);
				}

				const base = options.base || (await detectBaseBranch());
				const maxCost = options.maxCost
					? parseFloat(options.maxCost)
					: undefined;
				const failBelow = options.failBelow
					? parseInt(options.failBelow, 10)
					: undefined;

				if (failBelow !== undefined && (failBelow < 1 || failBelow > 10)) {
					console.error("Error: --fail-below must be between 1 and 10");
					process.exit(1);
				}

				const result = await runReview({
					scope,
					base,
					include: options.include,
					parallel: options.parallel ?? false,
					model: options.model,
					maxCost,
					passes,
					verbose: options.verbose ?? false,
				});

				if (options.format === "json") {
					console.log(formatReviewJson(result));
				} else {
					console.log(
						formatReviewText(result, {
							noColor: !options.color,
						}),
					);
				}

				if (failBelow !== undefined && result.score < failBelow) {
					process.exit(1);
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				console.error(`Error: ${message}`);
				process.exit(1);
			}
		});
}
