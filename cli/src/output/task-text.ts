import chalk from "chalk";
import type { TaskWithTeam } from "../loaders/task-loader.js";

function colorStatus(status: string): string {
	switch (status) {
		case "pending":
			return chalk.yellow(status);
		case "in_progress":
			return chalk.cyan(status);
		case "completed":
			return chalk.green(status);
		default:
			return status;
	}
}

export function formatTaskText(
	tasks: TaskWithTeam[],
	options?: { noColor?: boolean; fullText?: boolean },
): string {
	if (options?.noColor) {
		chalk.level = 0;
	}

	const lines: string[] = [];

	for (const task of tasks) {
		const team = chalk.magenta(`[${task.team}]`);
		const id = `#${task.id}`;
		const status = colorStatus(task.status);
		lines.push(`${team} ${id}  ${status}  ${task.subject}`);

		if (task.description) {
			const desc = options?.fullText
				? task.description
				: task.description.length > 100
					? task.description.slice(0, 100) + "..."
					: task.description;
			lines.push(`  ${desc}`);
		}
	}

	lines.push("");
	lines.push(chalk.dim(`Found ${tasks.length} tasks`));

	return lines.join("\n");
}

export function formatTaskJson(tasks: TaskWithTeam[]): string {
	const output = tasks.map((t) => ({
		id: t.id,
		team: t.team,
		status: t.status,
		subject: t.subject,
		description: t.description,
		blocks: t.blocks,
		blockedBy: t.blockedBy,
	}));

	return JSON.stringify(output, null, 2);
}
