import chalk from "chalk";
import type { Command } from "commander";
import { loadInstalledPlugins } from "../../loaders/plugin-loader.js";
import { setPluginEnabled } from "../../loaders/settings-writer.js";

interface PluginDisableOptions {
	color?: boolean;
}

export function registerPluginDisableCommand(parent: Command): void {
	parent
		.command("disable <name>")
		.description("Disable a plugin")
		.option("--no-color", "Disable colored output")
		.action(async (name: string, options: PluginDisableOptions) => {
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

				const result = await setPluginEnabled(plugin.qualifiedName, false);

				console.log(`${chalk.red("✓")} Disabled ${plugin.qualifiedName}`);
				if (result.deployed) {
					console.log("  Updated: ~/.claude/settings.json");
				}
				if (result.source) {
					console.log("  Updated: /workspaces/.codeforge/config/settings.json");
				} else {
					console.log("  Source settings.json not found — deployed copy only");
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				console.error(`Error: ${message}`);
				process.exit(1);
			}
		});
}
