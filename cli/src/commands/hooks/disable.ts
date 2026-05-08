import chalk from "chalk";
import type { Command } from "commander";
import {
	loadDisabledHooks,
	resolveHookNames,
	writeDisabledHooks,
	writeDisabledHooksSource,
} from "../../loaders/hooks-loader.js";
import { loadInstalledPlugins } from "../../loaders/plugin-loader.js";

const SECURITY_PLUGINS = new Set([
	"workspace-scope-guard",
	"dangerous-command-blocker",
	"protected-files-guard",
]);

interface HooksDisableOptions {
	color?: boolean;
}

export function registerHooksDisableCommand(parent: Command): void {
	parent
		.command("disable <name>")
		.description("Disable a hook by script or plugin name")
		.option("--no-color", "Disable colored output")
		.action(async (name: string, options: HooksDisableOptions) => {
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

				// Security warning for safety-critical plugins
				const plugin = plugins.find(
					(p) => p.name === name || p.qualifiedName === name,
				);
				if (plugin && SECURITY_PLUGINS.has(plugin.name)) {
					console.log(
						chalk.yellow(
							"⚠  Warning: This is a security hook. Disabling it removes a safety boundary.",
						),
					);
				}

				const disabled = await loadDisabledHooks();
				const added: string[] = [];

				for (const script of scripts) {
					if (!disabled.includes(script)) {
						disabled.push(script);
						added.push(script);
					}
				}

				if (added.length === 0) {
					console.log(
						chalk.yellow("Already disabled:"),
						scripts.join(", "),
					);
					return;
				}

				await writeDisabledHooks(disabled);
				const sourcePath = await writeDisabledHooksSource(disabled);

				console.log(
					`${chalk.red("✓")} Disabled ${added.length} hook${added.length > 1 ? "s" : ""}:`,
				);
				for (const script of added) {
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
