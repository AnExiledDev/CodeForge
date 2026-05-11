import chalk from "chalk";
import type { Command } from "commander";
import {
	extractScriptName,
	loadDisabledHooks,
} from "../../loaders/hooks-loader.js";
import { loadInstalledPlugins } from "../../loaders/plugin-loader.js";

interface HooksStatusOptions {
	color?: boolean;
}

export function registerHooksStatusCommand(parent: Command): void {
	parent
		.command("status")
		.description("Show summary of hook enablement")
		.option("--no-color", "Disable colored output")
		.action(async (options: HooksStatusOptions) => {
			try {
				if (!options.color) {
					chalk.level = 0;
				}

				const plugins = await loadInstalledPlugins();
				const disabled = new Set(await loadDisabledHooks());

				let total = 0;
				let disabledCount = 0;
				const disabledList: { plugin: string; script: string }[] = [];

				for (const plugin of plugins) {
					for (const hook of plugin.hooks) {
						for (const cmd of hook.commands) {
							total++;
							const script = extractScriptName(cmd.command);
							if (disabled.has(script)) {
								disabledCount++;
								disabledList.push({
									plugin: plugin.name,
									script,
								});
							}
						}
					}
				}

				const enabledCount = total - disabledCount;
				console.log(
					`Hooks: ${total} total, ${chalk.green(String(enabledCount))} enabled, ${chalk.red(String(disabledCount))} disabled`,
				);

				if (disabledList.length > 0) {
					console.log("");
					console.log("Disabled hooks:");
					for (const { plugin, script } of disabledList) {
						console.log(`  ${chalk.red("✗")} ${script} (${plugin})`);
					}
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				console.error(`Error: ${message}`);
				process.exit(1);
			}
		});
}
