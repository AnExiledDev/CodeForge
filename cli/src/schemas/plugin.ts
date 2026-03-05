export interface InstalledPluginsFile {
	version: number;
	plugins: Record<string, InstalledPluginEntry[]>;
}

export interface InstalledPluginEntry {
	scope: "user" | "project";
	installPath: string;
	version: string;
	installedAt: string;
	lastUpdated: string;
	gitCommitSha?: string;
}

export type KnownMarketplacesFile = Record<string, MarketplaceEntry>;

export interface MarketplaceEntry {
	source: { source: "directory" | "github"; path?: string; repo?: string };
	installLocation: string;
	lastUpdated: string;
}

export interface PluginJsonFile {
	name: string;
	description?: string;
	author?: { name: string; email?: string };
}

export interface HooksJsonFile {
	description?: string;
	hooks: Record<string, HookRuleEntry[]>;
}

export interface HookRuleEntry {
	matcher?: string;
	hooks: { type: "command"; command: string; timeout: number }[];
}

export interface HookInfo {
	event: string;
	matcher?: string;
	commands: { command: string; timeout: number }[];
}

export interface AgentInfo {
	name: string;
	description: string;
	filename: string;
}

export interface SkillInfo {
	name: string;
	description: string;
	dirname: string;
}

export interface PluginInfo {
	name: string;
	marketplace: string;
	qualifiedName: string;
	enabled: boolean;
	version: string;
	installPath: string;
	description: string;
	author: string;
	installedAt: string;
	hooks: HookInfo[];
	agents: AgentInfo[];
	skills: SkillInfo[];
	scripts: string[];
}
