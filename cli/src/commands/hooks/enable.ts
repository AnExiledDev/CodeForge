import chalk from "chalk";
import type { Command } from "commander";
import {
	loadDisabledHooks,
	resolveHookNames,
	writeDisabledHooks,
	writeDisabledHooksSource,
} from "../../loaders/hooks-loader.js";
import { loadInstalledPlugins } from "../../loaders/plugin-loader.js";

interface HooksEnableOptions {
	color?: boolean;
}

export function registerHooksEnableCommand(parent: Command): void {
	parent
		.command("enable <name>")
		.description("Re-enable a disabled hook by script or plugin name")
		.option("--no-color", "Disable colored output")
		.action(async (name: string, options: HooksEnableOptions) => {
			try {
				if (!options.color) {
					chalk.level = 0;
				}

				const plugins = await loadInstalledPlugins();
				const scripts = resolveHookNames(name, plugins);

				if (scripts.length === 0) {
					console.error(`Unknown hook or plugin: ${name}`);
					const allPlugins = plugins.map((p) => p.name).join(", ");
					console.error(`Available plugins: ${allPlugins}`);
					process.exit(1);
				}

				const disabled = await loadDisabledHooks();
				const toRemove = new Set(scripts);
				const removed: string[] = [];
				const updated = disabled.filter((s) => {
					if (toRemove.has(s)) {
						removed.push(s);
						return false;
					}
					return true;
				});

				if (removed.length === 0) {
					console.log(
						chalk.yellow("Already enabled:"),
						scripts.join(", "),
					);
					return;
				}

				await writeDisabledHooks(updated);
				const sourcePath = await writeDisabledHooksSource(updated);

				console.log(
					`${chalk.green("✓")} Enabled ${removed.length} hook${removed.length > 1 ? "s" : ""}:`,
				);
				for (const script of removed) {
					console.log(`  - ${script}`);
				}
				console.log("  Updated: ~/.claude/disabled-hooks.json");
				if (sourcePath) {
					console.log(`  Updated: ${sourcePath}`);
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				console.error(`Error: ${message}`);
				process.exit(1);
			}
		});
}
