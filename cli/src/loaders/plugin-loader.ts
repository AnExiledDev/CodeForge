import { existsSync } from "fs";
import { homedir } from "os";
import { basename, dirname, resolve } from "path";
import type { SettingsJson } from "../schemas/config.js";
import type {
	AgentInfo,
	HookInfo,
	HooksJsonFile,
	InstalledPluginsFile,
	PluginInfo,
	PluginJsonFile,
	SkillInfo,
} from "../schemas/plugin.js";
import { findWorkspacePath } from "../utils/devcontainer.js";

export function extractFrontMatter(content: string): Record<string, string> {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return {};

	const result: Record<string, string> = {};
	const lines = match[1].split(/\r?\n/);
	let currentKey: string | null = null;
	let currentValue = "";

	for (const line of lines) {
		const kvMatch = line.match(/^(\w[\w-]*)\s*:\s*(.*)/);
		if (kvMatch) {
			if (currentKey !== null) {
				result[currentKey] = currentValue.trim();
			}
			currentKey = kvMatch[1];
			const rawValue = kvMatch[2].trim();
			if (rawValue === ">-" || rawValue === ">") {
				currentValue = "";
			} else {
				currentValue = rawValue.replace(/^["']|["']$/g, "");
			}
		} else if (currentKey !== null && /^\s+/.test(line)) {
			const continuation = line.trim();
			if (currentValue) {
				currentValue += " " + continuation;
			} else {
				currentValue = continuation;
			}
		}
	}

	if (currentKey !== null) {
		result[currentKey] = currentValue.trim();
	}

	return result;
}

export async function loadPluginDetail(installPath: string): Promise<{
	hooks: HookInfo[];
	agents: AgentInfo[];
	skills: SkillInfo[];
	scripts: string[];
}> {
	const hooks: HookInfo[] = [];
	const agents: AgentInfo[] = [];
	const skills: SkillInfo[] = [];
	const scripts: string[] = [];

	// Hooks
	try {
		const hooksFile: HooksJsonFile = await Bun.file(
			resolve(installPath, "hooks/hooks.json"),
		).json();
		for (const [event, rules] of Object.entries(hooksFile.hooks)) {
			for (const rule of rules) {
				hooks.push({
					event,
					matcher: rule.matcher,
					commands: rule.hooks.map((h) => ({
						command: h.command,
						timeout: h.timeout,
					})),
				});
			}
		}
	} catch (err) {
		if (process.env.DEBUG) console.error(`[plugin-loader] ${err}`);
	}

	// Agents
	try {
		const glob = new Bun.Glob("*.md");
		for await (const entry of glob.scan({
			cwd: resolve(installPath, "agents"),
			absolute: true,
		})) {
			try {
				const content = await Bun.file(entry).text();
				const fm = extractFrontMatter(content);
				agents.push({
					name: fm.name || basename(entry, ".md"),
					description: fm.description || "",
					filename: basename(entry),
				});
			} catch (err) {
				if (process.env.DEBUG) console.error(`[plugin-loader] ${err}`);
			}
		}
	} catch (err) {
		if (process.env.DEBUG) console.error(`[plugin-loader] ${err}`);
	}

	// Skills
	try {
		const glob = new Bun.Glob("*/SKILL.md");
		for await (const entry of glob.scan({
			cwd: resolve(installPath, "skills"),
			absolute: true,
		})) {
			try {
				const content = await Bun.file(entry).text();
				const fm = extractFrontMatter(content);
				const dir = basename(dirname(entry));
				skills.push({
					name: fm.name || dir,
					description: fm.description || "",
					dirname: dir,
				});
			} catch (err) {
				if (process.env.DEBUG) console.error(`[plugin-loader] ${err}`);
			}
		}
	} catch (err) {
		if (process.env.DEBUG) console.error(`[plugin-loader] ${err}`);
	}

	// Scripts
	try {
		const glob = new Bun.Glob("*");
		for await (const entry of glob.scan({
			cwd: resolve(installPath, "scripts"),
			absolute: true,
		})) {
			scripts.push(basename(entry));
		}
	} catch (err) {
		if (process.env.DEBUG) console.error(`[plugin-loader] ${err}`);
	}

	return { hooks, agents, skills, scripts };
}

export function findSettingsPaths(): {
	deployed: string;
	source: string | null;
} {
	const deployed = resolve(homedir(), ".claude/settings.json");

	let source: string | null = null;
	let dir = process.cwd();

	while (true) {
		for (const candidate of settingsSourceCandidates(dir)) {
			if (existsSync(candidate)) {
				source = candidate;
				break;
			}
		}
		if (source) break;

		const parent = resolve(dir, "..");
		if (parent === dir) break;
		dir = parent;
	}

	if (!source) {
		try {
			const workspaceRoot = findWorkspacePath();
			if (workspaceRoot) {
				for (const fallback of settingsSourceCandidates(workspaceRoot)) {
					if (existsSync(fallback)) {
						source = fallback;
						break;
					}
				}
			}
		} catch (err) {
			if (process.env.DEBUG) console.error(`[plugin-loader] ${err}`);
		}
	}

	return { deployed, source };
}

function settingsSourceCandidates(workspaceRoot: string): string[] {
	return [
		resolve(
			workspaceRoot,
			".devcontainer/.generated/codeforge/claude/settings/settings.json",
		),
		resolve(workspaceRoot, ".codeforge/claude/settings/base.json"),
		resolve(
			workspaceRoot,
			".devcontainer/defaults/codeforge/claude/settings/base.json",
		),
	];
}

function resolveEnabled(
	qualifiedName: string,
	pluginName: string,
	enabledPlugins: Record<string, boolean> | undefined,
): boolean {
	if (!enabledPlugins) return true;

	// Direct match
	if (qualifiedName in enabledPlugins) {
		return enabledPlugins[qualifiedName];
	}

	// Name prefix match — different marketplace name
	const prefix = pluginName + "@";
	for (const key of Object.keys(enabledPlugins)) {
		if (key.startsWith(prefix)) {
			return enabledPlugins[key];
		}
	}

	// Not found — default enabled
	return true;
}

export async function loadInstalledPlugins(): Promise<PluginInfo[]> {
	const claudeDir = resolve(homedir(), ".claude");

	let installedFile: InstalledPluginsFile;
	try {
		installedFile = await Bun.file(
			resolve(claudeDir, "plugins/installed_plugins.json"),
		).json();
	} catch {
		return [];
	}

	let settings: SettingsJson;
	try {
		settings = await Bun.file(resolve(claudeDir, "settings.json")).json();
	} catch {
		settings = {};
	}

	const results: PluginInfo[] = [];

	for (const [qualifiedName, entries] of Object.entries(
		installedFile.plugins,
	)) {
		if (!entries || entries.length === 0) continue;

		const atIndex = qualifiedName.indexOf("@");
		const pluginName =
			atIndex >= 0 ? qualifiedName.slice(0, atIndex) : qualifiedName;
		const marketplace = atIndex >= 0 ? qualifiedName.slice(atIndex + 1) : "";

		const entry = entries[0];
		const enabled = resolveEnabled(
			qualifiedName,
			pluginName,
			settings.enabledPlugins,
		);

		let description = "";
		let author = "";
		try {
			const pluginJson: PluginJsonFile = await Bun.file(
				resolve(entry.installPath, ".claude-plugin/plugin.json"),
			).json();
			description = pluginJson.description || "";
			author = pluginJson.author?.name || "";
		} catch (err) {
			if (process.env.DEBUG) console.error(`[plugin-loader] ${err}`);
		}

		const detail = await loadPluginDetail(entry.installPath);

		results.push({
			name: pluginName,
			marketplace,
			qualifiedName,
			enabled,
			version: entry.version,
			installPath: entry.installPath,
			description,
			author,
			installedAt: entry.installedAt,
			hooks: detail.hooks,
			agents: detail.agents,
			skills: detail.skills,
			scripts: detail.scripts,
		});
	}

	results.sort((a, b) => a.name.localeCompare(b.name));
	return results;
}
