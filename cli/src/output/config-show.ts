import chalk from "chalk";
import type { SettingsJson } from "../schemas/config.js";

const SENSITIVE_PATTERNS = ["TOKEN", "SECRET", "KEY", "PASSWORD"];

function maskValue(key: string, value: string): string {
	const upperKey = key.toUpperCase();
	if (SENSITIVE_PATTERNS.some((p) => upperKey.includes(p))) {
		return value.length > 4 ? value.slice(0, 4) + "****" : "****";
	}
	return value;
}

export function formatConfigShowText(
	settings: SettingsJson,
	options?: { noColor?: boolean },
): string {
	if (options?.noColor) {
		chalk.level = 0;
	}

	const lines: string[] = [];
	const { env, permissions, enabledPlugins, ...other } = settings;

	if (env && Object.keys(env).length > 0) {
		lines.push(chalk.bold("Environment"));
		for (const [key, value] of Object.entries(env)) {
			lines.push(`  ${key.padEnd(36)}${maskValue(key, value)}`);
		}
		lines.push("");
	}

	if (permissions) {
		lines.push(chalk.bold("Permissions"));
		const allow =
			permissions.allow && permissions.allow.length > 0
				? permissions.allow.join(", ")
				: "(none)";
		const deny =
			permissions.deny && permissions.deny.length > 0
				? permissions.deny.join(", ")
				: "(none)";
		lines.push(`  Allow: ${allow}`);
		lines.push(`  Deny:  ${deny}`);
		if (permissions.ask && permissions.ask.length > 0) {
			lines.push(`  Ask:   ${permissions.ask.join(", ")}`);
		}
		lines.push("");
	}

	if (enabledPlugins && Object.keys(enabledPlugins).length > 0) {
		lines.push(chalk.bold("Plugins"));
		for (const [name, enabled] of Object.entries(enabledPlugins)) {
			const status = enabled ? chalk.green("enabled") : chalk.red("disabled");
			lines.push(`  ${name.padEnd(40)}${status}`);
		}
		lines.push("");
	}

	const otherKeys = Object.keys(other);
	if (otherKeys.length > 0) {
		lines.push(chalk.bold("Other Settings"));
		for (const key of otherKeys) {
			const value =
				typeof other[key] === "string"
					? other[key]
					: JSON.stringify(other[key]);
			lines.push(`  ${key}: ${value}`);
		}
		lines.push("");
	}

	// Remove trailing blank line
	if (lines.length > 0 && lines[lines.length - 1] === "") {
		lines.pop();
	}

	return lines.join("\n");
}

export function formatConfigShowJson(settings: SettingsJson): string {
	return JSON.stringify(settings, null, 2);
}
