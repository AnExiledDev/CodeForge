import chalk from "chalk";
import type { PluginInfo } from "../schemas/plugin.js";

export function formatPluginListText(
	plugins: PluginInfo[],
	options?: { noColor?: boolean },
): string {
	if (options?.noColor) {
		chalk.level = 0;
	}

	const lines: string[] = [];

	lines.push(
		chalk.bold(
			` ${"Plugin".padEnd(32)}${"Marketplace".padEnd(26)}${"Status".padEnd(10)}${"Hooks".padStart(7)}${"Agents".padStart(7)}${"Skills".padStart(7)}`,
		),
	);

	for (const plugin of plugins) {
		const statusText = plugin.enabled ? "enabled" : "disabled";
		const statusPadded = statusText.padEnd(10);
		const status = plugin.enabled
			? chalk.green(statusPadded)
			: chalk.red(statusPadded);
		const hooks = String(plugin.hooks.length).padStart(7);
		const agents = String(plugin.agents.length).padStart(7);
		const skills = String(plugin.skills.length).padStart(7);

		lines.push(
			` ${plugin.name.padEnd(32)}${plugin.marketplace.padEnd(26)}${status}${hooks}${agents}${skills}`,
		);
	}

	const enabledCount = plugins.filter((p) => p.enabled).length;
	const disabledCount = plugins.length - enabledCount;
	lines.push("");
	lines.push(
		chalk.dim(
			` ${plugins.length} plugins (${enabledCount} enabled, ${disabledCount} disabled)`,
		),
	);

	return lines.join("\n");
}

export function formatPluginListJson(plugins: PluginInfo[]): string {
	const output = plugins.map((plugin) => ({
		name: plugin.name,
		marketplace: plugin.marketplace,
		qualifiedName: plugin.qualifiedName,
		enabled: plugin.enabled,
		version: plugin.version,
		hookCount: plugin.hooks.length,
		agentCount: plugin.agents.length,
		skillCount: plugin.skills.length,
	}));

	return JSON.stringify(output, null, 2);
}
