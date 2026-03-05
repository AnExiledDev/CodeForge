import chalk from "chalk";
import type { Command } from "commander";
import { loadInstalledPlugins } from "../../loaders/plugin-loader.js";
import {
	formatPluginShowJson,
	formatPluginShowText,
} from "../../output/plugin-show.js";

interface PluginShowOptions {
	format: string;
	color?: boolean;
}

export function registerPluginShowCommand(parent: Command): void {
	parent
		.command("show <name>")
		.description("Show detailed information about a plugin")
		.option("-f, --format <format>", "Output format: text|json", "text")
		.option("--no-color", "Disable colored output")
		.action(async (name: string, options: PluginShowOptions) => {
			try {
				if (!options.color) {
					chalk.level = 0;
				}

				const plugins = await loadInstalledPlugins();
				const plugin = plugins.find(
					(p) => p.name === name || p.qualifiedName === name,
				);

				if (!plugin) {
					console.error(`Plugin not found: ${name}`);
					process.exit(1);
				}

				if (options.format === "json") {
					console.log(formatPluginShowJson(plugin));
				} else {
					console.log(
						formatPluginShowText(plugin, {
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
