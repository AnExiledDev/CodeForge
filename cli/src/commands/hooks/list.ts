import chalk from "chalk";
import type { Command } from "commander";
import {
	extractScriptName,
	loadDisabledHooks,
} from "../../loaders/hooks-loader.js";
import { loadInstalledPlugins } from "../../loaders/plugin-loader.js";

interface HooksListOptions {
	format: string;
	color?: boolean;
}

export function registerHooksListCommand(parent: Command): void {
	parent
		.command("list")
		.description("List all hooks with enabled/disabled status")
		.option("-f, --format <format>", "Output format: text|json", "text")
		.option("--no-color", "Disable colored output")
		.action(async (options: HooksListOptions) => {
			try {
				if (!options.color) {
					chalk.level = 0;
				}

				const plugins = await loadInstalledPlugins();
				const disabled = new Set(await loadDisabledHooks());

				if (options.format === "json") {
					const output: {
						plugin: string;
						event: string;
						matcher: string | undefined;
						timeout: number;
						script: string;
						enabled: boolean;
					}[] = [];

					for (const plugin of plugins) {
						for (const hook of plugin.hooks) {
							for (const cmd of hook.commands) {
								const script = extractScriptName(cmd.command);
								output.push({
									plugin: plugin.name,
									event: hook.event,
									matcher: hook.matcher,
									timeout: cmd.timeout,
									script,
									enabled: !disabled.has(script),
								});
							}
						}
					}
					console.log(JSON.stringify(output, null, 2));
				} else {
					const lines: string[] = [];
					lines.push(
						chalk.bold(
							` ${"Plugin".padEnd(27)}${"Event".padEnd(19)}${"Script".padEnd(28)}Status`,
						),
					);

					let enabledCount = 0;
					let disabledCount = 0;

					for (const plugin of plugins) {
						for (const hook of plugin.hooks) {
							for (const cmd of hook.commands) {
								const script = extractScriptName(cmd.command);
								const isDisabled = disabled.has(script);
								if (isDisabled) {
									disabledCount++;
								} else {
									enabledCount++;
								}
								const status = isDisabled
									? chalk.red("disabled")
									: chalk.green("enabled");
								lines.push(
									` ${plugin.name.padEnd(27)}${hook.event.padEnd(19)}${script.padEnd(28)}${status}`,
								);
							}
						}
					}

					const total = enabledCount + disabledCount;
					lines.push("");
					lines.push(
						chalk.dim(
							` ${total} hooks (${enabledCount} enabled, ${disabledCount} disabled)`,
						),
					);
					console.log(lines.join("\n"));
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				console.error(`Error: ${message}`);
				process.exit(1);
			}
		});
}
