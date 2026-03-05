import chalk from "chalk";
import type { PluginInfo } from "../schemas/plugin.js";

function extractScriptName(command: string): string {
	const parts = command.trim().split(/\s+/);
	for (let i = parts.length - 1; i >= 0; i--) {
		if (parts[i].includes("/")) {
			const segments = parts[i].split("/");
			return segments[segments.length - 1];
		}
	}
	return parts[parts.length - 1] ?? command;
}

export function formatPluginShowText(
	plugin: PluginInfo,
	options?: { noColor?: boolean },
): string {
	if (options?.noColor) {
		chalk.level = 0;
	}

	const lines: string[] = [];
	const labelWidth = 16;

	lines.push(chalk.bold(plugin.name));

	const status = plugin.enabled
		? chalk.green("enabled")
		: chalk.red("disabled");

	lines.push(`  ${"Description:".padEnd(labelWidth)}${plugin.description}`);
	lines.push(`  ${"Marketplace:".padEnd(labelWidth)}${plugin.marketplace}`);
	lines.push(`  ${"Version:".padEnd(labelWidth)}${plugin.version}`);
	lines.push(`  ${"Status:".padEnd(labelWidth)}${status}`);
	lines.push(`  ${"Installed:".padEnd(labelWidth)}${plugin.installedAt}`);
	lines.push(`  ${"Install Path:".padEnd(labelWidth)}${plugin.installPath}`);

	if (plugin.hooks.length > 0) {
		lines.push("");
		lines.push(`  ${chalk.bold(`Hooks (${plugin.hooks.length}):`)}`);
		for (const hook of plugin.hooks) {
			for (const cmd of hook.commands) {
				const event = hook.event.padEnd(16);
				const matcher = (hook.matcher ?? "\u2014").padEnd(15);
				const script = extractScriptName(cmd.command).padEnd(32);
				const timeout = `(${cmd.timeout}s)`;
				lines.push(`    ${event}${matcher}${script}${timeout}`);
			}
		}
	}

	if (plugin.agents.length > 0) {
		lines.push("");
		lines.push(`  ${chalk.bold(`Agents (${plugin.agents.length}):`)}`);
		const agentNames = plugin.agents.map((a) => a.name).join(", ");
		lines.push(`    ${agentNames}`);
	}

	if (plugin.skills.length > 0) {
		lines.push("");
		lines.push(`  ${chalk.bold(`Skills (${plugin.skills.length}):`)}`);
		const skillNames = plugin.skills.map((s) => s.name).join(", ");
		lines.push(`    ${skillNames}`);
	}

	return lines.join("\n");
}

export function formatPluginShowJson(plugin: PluginInfo): string {
	return JSON.stringify(plugin, null, 2);
}
