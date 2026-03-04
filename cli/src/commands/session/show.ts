import chalk from "chalk";
import type { Command } from "commander";
import { homedir } from "os";
import { resolve } from "path";
import { extractSessionMeta } from "../../loaders/session-meta.js";
import { loadTasks } from "../../loaders/task-loader.js";
import {
	formatSessionShowJson,
	formatSessionShowText,
	type SessionShowData,
} from "../../output/session-show.js";
import type { PlanMeta } from "../../schemas/plan.js";
import { discoverSessionFiles } from "../../utils/glob.js";

interface ShowCommandOptions {
	files?: boolean;
	tasks?: boolean;
	plan?: boolean;
	format: string;
	color?: boolean;
}

export function registerShowCommand(parent: Command): void {
	parent
		.command("show")
		.description("Show detailed session information")
		.argument("<identifier>", "Session ID (full or prefix) or slug name")
		.option("--files", "Show file sections", true)
		.option("--no-files", "Hide file sections")
		.option("--tasks", "Show task section", true)
		.option("--no-tasks", "Hide task section")
		.option("--plan", "Show plan section", true)
		.option("--no-plan", "Hide plan section")
		.option("-f, --format <format>", "Output format: text|json", "text")
		.option("--no-color", "Disable colored output")
		.action(async (identifier: string, options: ShowCommandOptions) => {
			try {
				if (!options.color) {
					chalk.level = 0;
				}

				const sessionFiles = await discoverSessionFiles();
				let targetFile: string | undefined;

				// Try UUID prefix match first
				for (const filePath of sessionFiles) {
					const parts = filePath.split("/");
					const filename = parts[parts.length - 1];
					const id = filename.replace(/\.jsonl$/, "");
					if (id.startsWith(identifier)) {
						targetFile = filePath;
						break;
					}
				}

				// If no UUID match, try slug match
				if (!targetFile) {
					for (const filePath of sessionFiles) {
						try {
							const meta = await extractSessionMeta(filePath);
							if (meta.slug === identifier) {
								targetFile = filePath;
								break;
							}
						} catch {}
					}
				}

				if (!targetFile) {
					console.error(`Error: Session not found: ${identifier}`);
					process.exit(1);
				}

				const meta = await extractSessionMeta(targetFile);

				// Try to load plan if slug exists
				let plan: PlanMeta | undefined;
				if (meta.slug) {
					const planPath = resolve(
						homedir(),
						".claude/plans",
						`${meta.slug}.md`,
					);
					try {
						const planFile = Bun.file(planPath);
						if (await planFile.exists()) {
							const content = await planFile.text();
							let title = meta.slug;
							for (const line of content.split("\n")) {
								if (line.startsWith("# ")) {
									title = line.slice(2).trim();
									break;
								}
							}
							plan = {
								slug: meta.slug,
								filePath: planPath,
								title,
								content,
							};
						}
					} catch {
						// Plan not found — skip
					}
				}

				// Load tasks if team exists
				const tasks = meta.teamName
					? await loadTasks({ team: meta.teamName })
					: [];

				const data: SessionShowData = { meta, plan, tasks };

				if (options.format === "json") {
					console.log(formatSessionShowJson(data));
				} else {
					console.log(
						formatSessionShowText(data, {
							noColor: !options.color,
							showFiles: options.files,
							showTasks: options.tasks,
							showPlan: options.plan,
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
