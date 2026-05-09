import { spinner } from "@clack/prompts";
import type { Command } from "commander";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "fs";
import { join } from "path";
import { loadDaemonConfig } from "../../daemon/config.js";
import { generateStopHook } from "../../daemon/templates/hooks/stop.js";
import { generateSessionStartHook } from "../../daemon/templates/hooks/session-start.js";
import { generatePostToolHook } from "../../daemon/templates/hooks/post-tool-event.js";
import { generateUserPromptHook } from "../../daemon/templates/hooks/user-prompt.js";
import { generateGoalSkill } from "../../daemon/templates/skills/goal.js";
import { generateGoalStatusSkill } from "../../daemon/templates/skills/goal-status.js";
import { generateGoalPauseSkill } from "../../daemon/templates/skills/goal-pause.js";
import { generateGoalResumeSkill } from "../../daemon/templates/skills/goal-resume.js";
import { generateGoalClearSkill } from "../../daemon/templates/skills/goal-clear.js";
import { patchSettings } from "../../daemon/templates/settings-patch.js";

interface WriteResult {
	path: string;
	action: "created" | "updated" | "unchanged";
}

/**
 * Safely write a file. If it already exists, compare content.
 * If identical: skip. If different: create .bak backup, then write.
 */
function safeWriteFile(filePath: string, content: string): WriteResult {
	const dir = join(filePath, "..");
	mkdirSync(dir, { recursive: true });

	if (existsSync(filePath)) {
		const existing = readFileSync(filePath, "utf-8");
		if (existing === content) {
			return { path: filePath, action: "unchanged" };
		}
		// Content differs — backup then overwrite
		copyFileSync(filePath, `${filePath}.bak`);
		writeFileSync(filePath, content);
		return { path: filePath, action: "updated" };
	}

	writeFileSync(filePath, content);
	return { path: filePath, action: "created" };
}

export function registerGoalInstallCommand(parent: Command): void {
	parent
		.command("install")
		.description("Install goal daemon hooks, skills, and config into the project")
		.action(async () => {
			const projectRoot = process.cwd();
			const config = loadDaemonConfig(projectRoot);
			const port = config.port;
			const s = spinner();
			const results: WriteResult[] = [];

			// Step 1: Create directories
			s.start("Creating directories...");
			const dirs = [
				join(projectRoot, ".claude", "hooks"),
				join(projectRoot, ".claude", "skills", "goal"),
				join(projectRoot, ".claude", "skills", "goal-status"),
				join(projectRoot, ".claude", "skills", "goal-pause"),
				join(projectRoot, ".claude", "skills", "goal-resume"),
				join(projectRoot, ".claude", "skills", "goal-clear"),
				join(projectRoot, ".codeforge", "goal"),
			];
			for (const dir of dirs) {
				mkdirSync(dir, { recursive: true });
			}
			s.stop("Directories ready");

			// Step 2: Write hook scripts
			s.start("Writing hook scripts...");
			const hookFiles: Array<{ name: string; content: string }> = [
				{ name: "goal-stop.ts", content: generateStopHook(port) },
				{ name: "goal-session-start.ts", content: generateSessionStartHook(port) },
				{ name: "goal-post-tool.ts", content: generatePostToolHook(port) },
				{ name: "goal-user-prompt.ts", content: generateUserPromptHook(port) },
			];
			for (const hook of hookFiles) {
				const result = safeWriteFile(
					join(projectRoot, ".claude", "hooks", hook.name),
					hook.content,
				);
				results.push(result);
			}
			s.stop("Hook scripts ready");

			// Step 3: Write skill files
			s.start("Writing skill files...");
			const skillFiles: Array<{ dir: string; content: string }> = [
				{ dir: "goal", content: generateGoalSkill() },
				{ dir: "goal-status", content: generateGoalStatusSkill() },
				{ dir: "goal-pause", content: generateGoalPauseSkill() },
				{ dir: "goal-resume", content: generateGoalResumeSkill() },
				{ dir: "goal-clear", content: generateGoalClearSkill() },
			];
			for (const skill of skillFiles) {
				const result = safeWriteFile(
					join(projectRoot, ".claude", "skills", skill.dir, "SKILL.md"),
					skill.content,
				);
				results.push(result);
			}
			s.stop("Skill files ready");

			// Step 4: Patch settings.json
			s.start("Patching .claude/settings.json...");
			const settingsResult = patchSettings(projectRoot);
			s.stop("Settings patched");

			// Step 5: Create config.json with defaults if missing
			const configPath = join(projectRoot, ".codeforge", "goal", "config.json");
			if (!existsSync(configPath)) {
				const defaultConfig = {
					port,
					host: config.host,
				};
				writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2) + "\n");
				results.push({ path: configPath, action: "created" });
			} else {
				results.push({ path: configPath, action: "unchanged" });
			}

			// Step 6: Print summary
			console.log("");
			console.log("Goal daemon installation summary:");
			console.log("─────────────────────────────────");

			const created = results.filter((r) => r.action === "created");
			const updated = results.filter((r) => r.action === "updated");
			const unchanged = results.filter((r) => r.action === "unchanged");

			if (created.length > 0) {
				console.log(`\n  Created (${created.length}):`);
				for (const r of created) {
					console.log(`    + ${relativeTo(projectRoot, r.path)}`);
				}
			}

			if (updated.length > 0) {
				console.log(`\n  Updated (${updated.length}):`);
				for (const r of updated) {
					console.log(`    ~ ${relativeTo(projectRoot, r.path)} (.bak saved)`);
				}
			}

			if (unchanged.length > 0) {
				console.log(`\n  Unchanged (${unchanged.length}):`);
				for (const r of unchanged) {
					console.log(`    - ${relativeTo(projectRoot, r.path)}`);
				}
			}

			if (settingsResult.created) {
				console.log("\n  Settings: .claude/settings.json created");
			} else if (settingsResult.patched) {
				console.log("\n  Settings: .claude/settings.json updated");
				if (settingsResult.backedUp) {
					console.log("            .claude/settings.json.bak saved");
				}
			} else {
				console.log("\n  Settings: .claude/settings.json (unchanged)");
			}

			console.log("\nRun 'codeforge goal doctor' to verify the installation.");
		});
}

function relativeTo(base: string, filePath: string): string {
	if (filePath.startsWith(base)) {
		return filePath.slice(base.length + 1);
	}
	return filePath;
}

// Exported for testing
export { safeWriteFile };
