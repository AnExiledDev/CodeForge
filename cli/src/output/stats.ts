import chalk from "chalk";
import type { SearchResult } from "../search/engine.js";

export function formatStats(
	result: SearchResult,
	options: { noColor?: boolean } = {},
): string {
	if (options.noColor) {
		chalk.level = 0;
	}

	const { stats, durationMs } = result;
	const lines: string[] = [];

	lines.push(chalk.bold("Session Search Statistics"));
	lines.push("\u2550".repeat(27));
	lines.push(`Total matches:    ${stats.totalMatches}`);
	lines.push(`Files searched:   ${stats.totalFilesSearched}`);
	lines.push(`Unique sessions:  ${stats.uniqueSessions}`);
	lines.push(`Search duration:  ${durationMs}ms`);

	lines.push("");
	lines.push(chalk.bold("Messages by role:"));
	for (const [role, count] of Object.entries(stats.messagesByRole)) {
		lines.push(`  ${role.padEnd(12)} ${count}`);
	}

	if (stats.timeRange) {
		lines.push("");
		lines.push(chalk.bold("Time range:"));
		lines.push(`  Earliest: ${formatTimestamp(stats.timeRange.earliest)}`);
		lines.push(`  Latest:   ${formatTimestamp(stats.timeRange.latest)}`);
	}

	return lines.join("\n");
}

function formatTimestamp(iso: string): string {
	const d = new Date(iso);
	if (isNaN(d.getTime())) return iso;

	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	const hours = String(d.getHours()).padStart(2, "0");
	const minutes = String(d.getMinutes()).padStart(2, "0");
	const seconds = String(d.getSeconds()).padStart(2, "0");

	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
