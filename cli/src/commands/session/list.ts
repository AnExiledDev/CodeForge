import chalk from "chalk";
import type { Command } from "commander";
import { basename } from "path";
import { loadHistory } from "../../loaders/history-loader.js";
import { extractSessionMeta } from "../../loaders/session-meta.js";
import {
	formatSessionListJson,
	formatSessionListText,
	type SessionListEntry,
} from "../../output/session-list.js";
import { discoverSessionFiles } from "../../utils/glob.js";
import { parseRelativeTime, parseTime } from "../../utils/time.js";

interface ListCommandOptions {
	project?: string;
	since?: string;
	after?: string;
	before?: string;
	limit: string;
	format: string;
	color?: boolean;
}

export function registerListCommand(parent: Command): void {
	parent
		.command("list")
		.description("List previous Claude Code sessions")
		.option("--project <path>", "Project directory filter")
		.option("--since <time>", 'Relative time filter (e.g. "1 day ago")')
		.option("--after <timestamp>", "Show sessions after this timestamp")
		.option("--before <timestamp>", "Show sessions before this timestamp")
		.option("-n, --limit <count>", "Maximum number of results", "20")
		.option("-f, --format <format>", "Output format: text|json", "text")
		.option("--no-color", "Disable colored output")
		.action(async (options: ListCommandOptions) => {
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

				const summaries = await loadHistory({
					project: options.project,
					after: after ?? undefined,
					before: before ?? undefined,
					limit: parseInt(options.limit, 10),
				});

				// Discover session files for enrichment
				const sessionFiles = await discoverSessionFiles();
				const filesBySessionId = new Map<string, string>();
				for (const filePath of sessionFiles) {
					// Extract session ID from filename (basename without extension)
					const filename = basename(filePath);
					const id = filename.replace(/\.jsonl$/, "");
					filesBySessionId.set(id, filePath);
				}

				// Enrich summaries with session metadata
				const entries: SessionListEntry[] = [];
				for (const summary of summaries) {
					const filePath = filesBySessionId.get(summary.sessionId);
					let meta;
					if (filePath) {
						try {
							meta = await extractSessionMeta(filePath);
						} catch {
							// Skip enrichment on error
						}
					}
					entries.push({ summary, meta });
				}

				if (options.format === "json") {
					console.log(formatSessionListJson(entries));
				} else {
					console.log(
						formatSessionListText(entries, {
							noColor: !options.color,
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
