import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { basename, resolve } from "path";
import type { PluginInfo } from "../schemas/plugin.js";

interface DisabledHooksFile {
	disabled: string[];
}

export function extractScriptName(command: string): string {
	const parts = command.trim().split(/\s+/);
	let name = parts[parts.length - 1] ?? command;
	for (let i = parts.length - 1; i >= 0; i--) {
		if (parts[i].includes("/")) {
			name = basename(parts[i]);
			break;
		}
	}
	// Strip .py extension to match disabled-hooks.json convention
	return name.replace(/\.py$/, "");
}

export async function loadDisabledHooks(
	filePath?: string,
): Promise<string[]> {
	const target = filePath ?? resolve(homedir(), ".claude/disabled-hooks.json");
	try {
		const data: DisabledHooksFile = await Bun.file(target).json();
		return Array.isArray(data.disabled) ? data.disabled : [];
	} catch {
		return [];
	}
}

export async function writeDisabledHooks(
	disabled: string[],
	filePath?: string,
): Promise<void> {
	const target = filePath ?? resolve(homedir(), ".claude/disabled-hooks.json");
	const dir = resolve(target, "..");
	mkdirSync(dir, { recursive: true });
	const sorted = [...new Set(disabled)].sort();
	await Bun.write(
		target,
		JSON.stringify({ disabled: sorted }, null, 2) + "\n",
	);
}

export function findDisabledHooksSource(): string | null {
	let dir = process.cwd();
	while (true) {
		for (const candidate of [
			resolve(dir, ".codeforge/claude/disabled-hooks.json"),
			resolve(
				dir,
				".devcontainer/defaults/codeforge/claude/disabled-hooks.json",
			),
		]) {
			if (existsSync(candidate)) {
				return candidate;
			}
		}
		const parent = resolve(dir, "..");
		if (parent === dir) break;
		dir = parent;
	}
	return null;
}

export async function writeDisabledHooksSource(
	disabled: string[],
): Promise<string | null> {
	const source = findDisabledHooksSource();
	if (!source) return null;
	const sorted = [...new Set(disabled)].sort();
	await Bun.write(
		source,
		JSON.stringify({ disabled: sorted }, null, 2) + "\n",
	);
	return source;
}

export function resolveHookNames(
	input: string,
	plugins: PluginInfo[],
): string[] {
	// Check if input matches a plugin name
	const plugin = plugins.find(
		(p) => p.name === input || p.qualifiedName === input,
	);
	if (plugin) {
		const scripts: string[] = [];
		for (const hook of plugin.hooks) {
			for (const cmd of hook.commands) {
				scripts.push(extractScriptName(cmd.command));
			}
		}
		return [...new Set(scripts)];
	}

	// Check if input matches a hook script name
	for (const p of plugins) {
		for (const hook of p.hooks) {
			for (const cmd of hook.commands) {
				if (extractScriptName(cmd.command) === input) {
					return [input];
				}
			}
		}
	}

	return [];
}
