import chalk from "chalk";
import type { Command } from "commander";
import { loadTasks } from "../../loaders/task-loader.js";
import { formatTaskJson, formatTaskText } from "../../output/task-text.js";
import { evaluate, parse } from "../../search/query-parser.js";

interface TaskSearchOptions {
	team?: string;
	status?: string;
	limit: string;
	format: string;
	color?: boolean;
	fullText?: boolean;
}

export function registerTaskSearchCommand(parent: Command): void {
	parent
		.command("search")
		.description("Search across task files")
		.argument("[query]", "Search query (supports AND, OR, NOT, quotes)")
		.option("--team <name>", "Filter by team name")
		.option("--status <status>", "Filter by task status")
		.option("-n, --limit <count>", "Maximum number of results", "50")
		.option("-f, --format <format>", "Output format: text|json", "text")
		.option("--no-color", "Disable colored output")
		.option("--full-text", "Disable description truncation")
		.action(async (query: string | undefined, options: TaskSearchOptions) => {
			try {
				if (!options.color) {
					chalk.level = 0;
				}

				let tasks = await loadTasks({
					team: options.team,
					status: options.status,
				});

				// Apply query filter
				if (query) {
					const queryNode = parse(query);
					tasks = tasks.filter((task) =>
						evaluate(queryNode, task.subject + " " + task.description),
					);
				}

				// Apply limit
				const limit = parseInt(options.limit, 10);
				tasks = tasks.slice(0, limit);

				if (options.format === "json") {
					console.log(formatTaskJson(tasks));
				} else {
					console.log(
						formatTaskText(tasks, {
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
