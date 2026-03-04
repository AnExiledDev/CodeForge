import chalk from "chalk";
import type { Command } from "commander";
import { formatJson } from "../../output/json.js";
import { formatStats } from "../../output/stats.js";
import { formatText } from "../../output/text.js";
import { search } from "../../search/engine.js";
import { parseRelativeTime, parseTime } from "../../utils/time.js";

interface SearchCommandOptions {
	role?: string;
	limit: string;
	project?: string;
	since?: string;
	after?: string;
	before?: string;
	session?: string;
	format: string;
	stats?: boolean;
	color?: boolean;
	fullText?: boolean;
	pattern?: string;
}

export function registerSearchCommand(parent: Command): void {
	parent
		.command("search")
		.description("Search Claude Code session history")
		.argument("[query]", "Search query (supports AND, OR, NOT, quotes)")
		.option("-r, --role <role>", "Filter by role (user/assistant/system)")
		.option("-n, --limit <count>", "Maximum number of results", "200")
		.option("--project <path>", "Project directory filter")
		.option("--since <time>", 'Relative time filter (e.g. "1 day ago")')
		.option("--after <timestamp>", "Show messages after this timestamp")
		.option("--before <timestamp>", "Show messages before this timestamp")
		.option("-s, --session <id>", "Filter by session ID")
		.option("-f, --format <format>", "Output format: text|json", "text")
		.option("--stats", "Show statistics only")
		.option("--no-color", "Disable colored output")
		.option("--full-text", "Disable content truncation")
		.option("-p, --pattern <glob>", "Custom file glob pattern")
		.action(
			async (query: string | undefined, options: SearchCommandOptions) => {
				try {
					if (!options.color) {
						chalk.level = 0;
					}

					const after = options.since
						? parseRelativeTime(options.since)
						: options.after
							? parseTime(options.after)
							: undefined;

					const before = options.before ? parseTime(options.before) : undefined;

					const result = await search({
						query: query ?? "",
						role: options.role,
						limit: parseInt(options.limit, 10),
						project: options.project,
						after: after?.toISOString(),
						before: before?.toISOString(),
						sessionId: options.session,
						pattern: options.pattern,
					});

					if (options.stats) {
						console.log(formatStats(result, { noColor: !options.color }));
					} else if (options.format === "json") {
						console.log(formatJson(result));
					} else {
						console.log(
							formatText(result, {
								fullText: options.fullText,
								noColor: !options.color,
							}),
						);
					}
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					console.error(`Error: ${message}`);
					process.exit(1);
				}
			},
		);
}
