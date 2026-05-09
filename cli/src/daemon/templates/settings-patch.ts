import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "fs";
import { dirname, join } from "path";

interface HookEntry {
	type: string;
	command: string;
}

interface HookMatcher {
	matcher: string;
	hooks: HookEntry[];
}

interface SettingsJson {
	hooks?: Record<string, HookMatcher[]>;
	[key: string]: unknown;
}

const GOAL_HOOKS: Record<string, string> = {
	Stop: "bun run .claude/hooks/goal-stop.ts",
	SessionStart: "bun run .claude/hooks/goal-session-start.ts",
	PostToolUse: "bun run .claude/hooks/goal-post-tool.ts",
	UserPromptSubmit: "bun run .claude/hooks/goal-user-prompt.ts",
};

/**
 * Patch .claude/settings.json to register goal daemon hooks.
 * Merges with existing hooks — appends ours, does not replace existing ones.
 * If our hooks already exist (match by command path), updates in place.
 */
export function patchSettings(
	projectRoot: string,
): { patched: boolean; created: boolean; backedUp: boolean } {
	const settingsPath = join(projectRoot, ".claude", "settings.json");
	const result = { patched: false, created: false, backedUp: false };

	let settings: SettingsJson = {};

	if (existsSync(settingsPath)) {
		const raw = readFileSync(settingsPath, "utf-8");
		settings = JSON.parse(raw) as SettingsJson;
	} else {
		result.created = true;
	}

	if (!settings.hooks) {
		settings.hooks = {};
	}

	let changed = false;

	for (const [hookName, command] of Object.entries(GOAL_HOOKS)) {
		if (!settings.hooks[hookName]) {
			settings.hooks[hookName] = [];
		}

		const matchers = settings.hooks[hookName];

		// Find existing entry with our command
		let found = false;
		for (const matcher of matchers) {
			for (let i = 0; i < matcher.hooks.length; i++) {
				if (matcher.hooks[i].command === command) {
					found = true;
					// Already exists and matches — no update needed
					break;
				}
			}
			if (found) break;
		}

		if (!found) {
			// Append our hook as a new matcher entry
			matchers.push({
				matcher: "",
				hooks: [{ type: "command", command }],
			});
			changed = true;
		}
	}

	if (!changed && !result.created) {
		return result;
	}

	// Back up existing file if it had content and we're changing it
	if (existsSync(settingsPath) && changed) {
		const backupPath = `${settingsPath}.bak`;
		copyFileSync(settingsPath, backupPath);
		result.backedUp = true;
	}

	mkdirSync(dirname(settingsPath), { recursive: true });
	writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
	result.patched = true;

	return result;
}

/** Check if settings.json already has goal hooks registered. */
export function hasGoalHooks(projectRoot: string): boolean {
	const settingsPath = join(projectRoot, ".claude", "settings.json");
	if (!existsSync(settingsPath)) return false;

	try {
		const raw = readFileSync(settingsPath, "utf-8");
		const settings = JSON.parse(raw) as SettingsJson;
		if (!settings.hooks) return false;

		for (const command of Object.values(GOAL_HOOKS)) {
			let found = false;
			for (const matchers of Object.values(settings.hooks)) {
				for (const matcher of matchers) {
					for (const hook of matcher.hooks) {
						if (hook.command === command) {
							found = true;
							break;
						}
					}
					if (found) break;
				}
				if (found) break;
			}
			if (!found) return false;
		}
		return true;
	} catch {
		return false;
	}
}
