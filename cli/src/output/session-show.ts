import chalk from "chalk";
import type { SessionMeta } from "../loaders/session-meta.js";
import type { TaskWithTeam } from "../loaders/task-loader.js";
import type { PlanMeta } from "../schemas/plan.js";

export interface SessionShowData {
	meta: SessionMeta;
	plan?: PlanMeta;
	tasks: TaskWithTeam[];
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

function sectionHeader(title: string): string {
	const pad = "\u2500".repeat(Math.max(0, 40 - title.length - 2));
	return chalk.bold(`\u2500\u2500\u2500 ${title} ${pad}`);
}

export function formatSessionShowText(
	data: SessionShowData,
	options?: {
		noColor?: boolean;
		showFiles?: boolean;
		showTasks?: boolean;
		showPlan?: boolean;
	},
): string {
	if (options?.noColor) {
		chalk.level = 0;
	}

	const showFiles = options?.showFiles !== false;
	const showTasks = options?.showTasks !== false;
	const showPlan = options?.showPlan !== false;

	const { meta, plan, tasks } = data;
	const lines: string[] = [];

	// Header
	lines.push(`Session:  ${meta.sessionId}`);
	lines.push(`Slug:     ${meta.slug ?? "\u2014"}`);
	lines.push(`Project:  ${meta.cwd ?? "unknown"}`);
	lines.push(`Team:     ${meta.teamName ?? "\u2014"}`);

	if (meta.timeRange) {
		const start = formatTimestamp(meta.timeRange.start);
		const end = formatTimestamp(meta.timeRange.end);
		lines.push(`Time:     ${start} \u2192 ${end}`);
	}

	lines.push(`Messages: ${meta.messageCount}`);

	// Plan section
	if (showPlan && plan) {
		lines.push("");
		lines.push(sectionHeader("Plan"));
		lines.push(chalk.cyan(plan.slug + ".md"));

		const contentLines = plan.content.split("\n");
		const preview = contentLines.slice(0, 5);
		for (const line of preview) {
			lines.push(chalk.dim(line));
		}
	}

	// Tasks section
	if (showTasks && tasks.length > 0) {
		lines.push("");
		lines.push(sectionHeader("Tasks"));

		for (const task of tasks) {
			const id = `#${task.id}`.padEnd(4);
			const status = colorStatus(task.status).padEnd(
				task.status.length + (task.status === "in_progress" ? 0 : 0),
			);
			lines.push(`${id}  ${status}  ${task.subject}`);
		}
	}

	// File sections
	if (showFiles) {
		if (meta.filesRead.length > 0) {
			lines.push("");
			lines.push(sectionHeader("Files Read"));
			for (const f of meta.filesRead) {
				lines.push(chalk.dim(`  ${f}`));
			}
		}

		if (meta.filesWritten.length > 0) {
			lines.push("");
			lines.push(sectionHeader("Files Written"));
			for (const f of meta.filesWritten) {
				lines.push(chalk.dim(`  ${f}`));
			}
		}

		if (meta.filesEdited.length > 0) {
			lines.push("");
			lines.push(sectionHeader("Files Edited"));
			for (const f of meta.filesEdited) {
				lines.push(chalk.dim(`  ${f}`));
			}
		}
	}

	return lines.join("\n");
}

export function formatSessionShowJson(data: SessionShowData): string {
	const output = {
		sessionId: data.meta.sessionId,
		slug: data.meta.slug ?? null,
		project: data.meta.cwd ?? null,
		team: data.meta.teamName ?? null,
		gitBranch: data.meta.gitBranch ?? null,
		timeRange: data.meta.timeRange,
		messageCount: data.meta.messageCount,
		plan: data.plan ? { slug: data.plan.slug, title: data.plan.title } : null,
		tasks: data.tasks.map((t) => ({
			id: t.id,
			team: t.team,
			status: t.status,
			subject: t.subject,
			description: t.description,
		})),
		files: {
			read: data.meta.filesRead,
			written: data.meta.filesWritten,
			edited: data.meta.filesEdited,
		},
	};

	return JSON.stringify(output, null, 2);
}
