import chalk from "chalk";
import type { Command } from "commander";
import { loadSettings } from "../../loaders/config-loader.js";
import { findSettingsPaths } from "../../loaders/plugin-loader.js";
import {
	formatConfigShowJson,
	formatConfigShowText,
} from "../../output/config-show.js";

interface ConfigShowOptions {
	format: string;
	color?: boolean;
	source?: boolean;
}

export function registerConfigShowCommand(parent: Command): void {
	parent
		.command("show")
		.description("Show current Claude Code configuration")
		.option("-f, --format <format>", "Output format: text|json", "text")
		.option("--no-color", "Disable colored output")
		.option("--source", "Show workspace source copy instead of deployed")
		.action(async (options: ConfigShowOptions) => {
			try {
				if (!options.color) {
					chalk.level = 0;
				}

				let settingsPath: string;

				if (options.source) {
					const paths = findSettingsPaths();
					if (!paths.source) {
						console.error("Error: Source settings.json not found");
						process.exit(1);
					}
					settingsPath = paths.source;
				} else {
					const paths = findSettingsPaths();
					settingsPath = paths.deployed;
				}

				const settings = await loadSettings(settingsPath);

				if (options.format === "json") {
					console.log(formatConfigShowJson(settings));
				} else {
					console.log(
						formatConfigShowText(settings, {
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
