import chalk from "chalk";
import type { SearchResult } from "../search/engine.js";

export function formatText(
	result: SearchResult,
	options: { fullText?: boolean; noColor?: boolean } = {},
): string {
	if (options.noColor) {
		chalk.level = 0;
	}

	const lines: string[] = [];

	for (const msg of result.messages) {
		const timestamp = formatTimestamp(msg.timestamp);
		const role = colorRole(msg.type);
		const sessionShort = chalk.dim(msg.sessionId.slice(0, 8));
		const filePath = chalk.dim(msg.filePath);

		lines.push(`${timestamp}  ${role}  ${sessionShort}  ${filePath}`);

		const content = msg.content.trim();
		if (content) {
			if (options.fullText) {
				lines.push(content);
			} else {
				const preview = content.slice(0, 150);
				lines.push(preview.length < content.length ? `${preview}...` : preview);
			}
		}

		lines.push("---");
	}

	const { stats, durationMs } = result;
	lines.push(
		chalk.dim(
			`Found ${stats.totalMatches} matches across ${stats.totalFilesSearched} files (${stats.uniqueSessions} sessions) in ${durationMs}ms`,
		),
	);

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

function colorRole(role: string): string {
	switch (role) {
		case "user":
			return chalk.cyan(role);
		case "assistant":
			return chalk.green(role);
		case "system":
			return chalk.yellow(role);
		case "summary":
			return chalk.dim(role);
		default:
			return role;
	}
}
