import chalk from "chalk";
import type { Command } from "commander";
import { loadInstalledPlugins } from "../../loaders/plugin-loader.js";
import {
	formatAgentsJson,
	formatAgentsText,
} from "../../output/plugin-components.js";

interface PluginAgentsOptions {
	format: string;
	color?: boolean;
	plugin?: string;
}

export function registerPluginAgentsCommand(parent: Command): void {
	parent
		.command("agents")
		.description("List agents from installed plugins")
		.option("-f, --format <format>", "Output format: text|json", "text")
		.option("--no-color", "Disable colored output")
		.option("--plugin <name>", "Filter to a specific plugin")
		.action(async (options: PluginAgentsOptions) => {
			try {
				if (!options.color) {
					chalk.level = 0;
				}

				let plugins = await loadInstalledPlugins();

				if (options.plugin) {
					plugins = plugins.filter(
						(p) =>
							p.name === options.plugin || p.qualifiedName === options.plugin,
					);
				}

				if (options.format === "json") {
					console.log(formatAgentsJson(plugins));
				} else {
					console.log(
						formatAgentsText(plugins, {
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
