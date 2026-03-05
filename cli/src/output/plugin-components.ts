import chalk from "chalk";
import { basename } from "path";
import type { PluginInfo } from "../schemas/plugin.js";

function extractScriptName(command: string): string {
	const parts = command.trim().split(/\s+/);
	for (let i = parts.length - 1; i >= 0; i--) {
		if (parts[i].includes("/")) {
			return basename(parts[i]);
		}
	}
	return parts[parts.length - 1] ?? command;
}

function truncate(str: string, max: number): string {
	return str.length > max ? str.slice(0, max - 1) + "\u2026" : str;
}

export function formatHooksText(
	plugins: PluginInfo[],
	options?: { noColor?: boolean },
): string {
	if (options?.noColor) {
		chalk.level = 0;
	}

	const lines: string[] = [];

	lines.push(
		chalk.bold(
			` ${"Plugin".padEnd(27)}${"Event".padEnd(19)}${"Matcher".padEnd(13)}${"Timeout".padEnd(9)}Script`,
		),
	);

	let totalHooks = 0;
	const pluginsWithHooks = new Set<string>();

	for (const plugin of plugins) {
		for (const hook of plugin.hooks) {
			for (const cmd of hook.commands) {
				totalHooks++;
				pluginsWithHooks.add(plugin.name);
				const matcher = hook.matcher ?? "\u2014";
				const timeout = `${cmd.timeout}s`;
				const script = extractScriptName(cmd.command);

				lines.push(
					` ${plugin.name.padEnd(27)}${hook.event.padEnd(19)}${matcher.padEnd(13)}${timeout.padEnd(9)}${script}`,
				);
			}
		}
	}

	lines.push("");
	lines.push(
		chalk.dim(` ${totalHooks} hooks across ${pluginsWithHooks.size} plugins`),
	);

	return lines.join("\n");
}

export function formatHooksJson(plugins: PluginInfo[]): string {
	const output: {
		plugin: string;
		event: string;
		matcher: string | undefined;
		timeout: number;
		command: string;
	}[] = [];

	for (const plugin of plugins) {
		for (const hook of plugin.hooks) {
			for (const cmd of hook.commands) {
				output.push({
					plugin: plugin.name,
					event: hook.event,
					matcher: hook.matcher,
					timeout: cmd.timeout,
					command: cmd.command,
				});
			}
		}
	}

	return JSON.stringify(output, null, 2);
}

export function formatAgentsText(
	plugins: PluginInfo[],
	options?: { noColor?: boolean },
): string {
	if (options?.noColor) {
		chalk.level = 0;
	}

	const lines: string[] = [];

	lines.push(
		chalk.bold(` ${"Agent".padEnd(20)}${"Plugin".padEnd(16)}Description`),
	);

	let totalAgents = 0;
	const pluginsWithAgents = new Set<string>();

	for (const plugin of plugins) {
		for (const agent of plugin.agents) {
			totalAgents++;
			pluginsWithAgents.add(plugin.name);
			const desc = truncate(agent.description, 50);

			lines.push(` ${agent.name.padEnd(20)}${plugin.name.padEnd(16)}${desc}`);
		}
	}

	lines.push("");
	lines.push(
		chalk.dim(
			` ${totalAgents} agents across ${pluginsWithAgents.size} plugins`,
		),
	);

	return lines.join("\n");
}

export function formatAgentsJson(plugins: PluginInfo[]): string {
	const output: {
		name: string;
		plugin: string;
		description: string;
		filename: string;
	}[] = [];

	for (const plugin of plugins) {
		for (const agent of plugin.agents) {
			output.push({
				name: agent.name,
				plugin: plugin.name,
				description: agent.description,
				filename: agent.filename,
			});
		}
	}

	return JSON.stringify(output, null, 2);
}

export function formatSkillsText(
	plugins: PluginInfo[],
	options?: { noColor?: boolean },
): string {
	if (options?.noColor) {
		chalk.level = 0;
	}

	const lines: string[] = [];

	lines.push(
		chalk.bold(` ${"Skill".padEnd(24)}${"Plugin".padEnd(16)}Description`),
	);

	let totalSkills = 0;
	const pluginsWithSkills = new Set<string>();

	for (const plugin of plugins) {
		for (const skill of plugin.skills) {
			totalSkills++;
			pluginsWithSkills.add(plugin.name);
			const desc = truncate(skill.description, 50);

			lines.push(` ${skill.name.padEnd(24)}${plugin.name.padEnd(16)}${desc}`);
		}
	}

	lines.push("");
	lines.push(
		chalk.dim(
			` ${totalSkills} skills across ${pluginsWithSkills.size} plugins`,
		),
	);

	return lines.join("\n");
}

export function formatSkillsJson(plugins: PluginInfo[]): string {
	const output: {
		name: string;
		plugin: string;
		description: string;
		dirname: string;
	}[] = [];

	for (const plugin of plugins) {
		for (const skill of plugin.skills) {
			output.push({
				name: skill.name,
				plugin: plugin.name,
				description: skill.description,
				dirname: skill.dirname,
			});
		}
	}

	return JSON.stringify(output, null, 2);
}
