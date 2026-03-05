import chalk from "chalk";
import type { Command } from "commander";
import { loadInstalledPlugins } from "../../loaders/plugin-loader.js";
import {
	formatPluginListJson,
	formatPluginListText,
} from "../../output/plugin-list.js";

interface PluginListOptions {
	format: string;
	color?: boolean;
	enabledOnly?: boolean;
	disabledOnly?: boolean;
}

export function registerPluginListCommand(parent: Command): void {
	parent
		.command("list")
		.description("List installed plugins")
		.option("-f, --format <format>", "Output format: text|json", "text")
		.option("--no-color", "Disable colored output")
		.option("--enabled-only", "Show only enabled plugins")
		.option("--disabled-only", "Show only disabled plugins")
		.action(async (options: PluginListOptions) => {
			try {
				if (!options.color) {
					chalk.level = 0;
				}

				let plugins = await loadInstalledPlugins();

				if (options.enabledOnly) {
					plugins = plugins.filter((p) => p.enabled);
				} else if (options.disabledOnly) {
					plugins = plugins.filter((p) => !p.enabled);
				}

				if (options.format === "json") {
					console.log(formatPluginListJson(plugins));
				} else {
					console.log(
						formatPluginListText(plugins, {
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
