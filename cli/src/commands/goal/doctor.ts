import { spinner } from "@clack/prompts";
import chalk from "chalk";
import type { Command } from "commander";
import { accessSync, constants, existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { loadDaemonConfig } from "../../daemon/config.js";
import { hasGoalHooks } from "../../daemon/templates/settings-patch.js";

interface GoalCheckResult {
	name: string;
	status: "pass" | "warn" | "fail";
	message: string;
	hint?: string;
}

interface GoalDoctorReport {
	checks: GoalCheckResult[];
	passed: number;
	failed: number;
	warnings: number;
}

const HOOK_FILES = [
	"goal-stop.ts",
	"goal-session-start.ts",
	"goal-post-tool.ts",
	"goal-user-prompt.ts",
];

const SKILL_DIRS = [
	"goal",
	"goal-status",
	"goal-pause",
	"goal-resume",
	"goal-clear",
];

function checkHookFiles(projectRoot: string): GoalCheckResult {
	const missing: string[] = [];
	for (const file of HOOK_FILES) {
		const filePath = join(projectRoot, ".claude", "hooks", file);
		if (!existsSync(filePath)) {
			missing.push(file);
		}
	}
	if (missing.length === 0) {
		return {
			name: "Hook files",
			status: "pass",
			message: `All ${HOOK_FILES.length} hook scripts present`,
		};
	}
	return {
		name: "Hook files",
		status: "fail",
		message: `Missing: ${missing.join(", ")}`,
		hint: "Run 'codeforge goal install' to create hook files",
	};
}

function checkSkillFiles(projectRoot: string): GoalCheckResult {
	const missing: string[] = [];
	for (const dir of SKILL_DIRS) {
		const filePath = join(projectRoot, ".claude", "skills", dir, "SKILL.md");
		if (!existsSync(filePath)) {
			missing.push(dir);
		}
	}
	if (missing.length === 0) {
		return {
			name: "Skill files",
			status: "pass",
			message: `All ${SKILL_DIRS.length} skill files present`,
		};
	}
	return {
		name: "Skill files",
		status: "fail",
		message: `Missing: ${missing.join(", ")}`,
		hint: "Run 'codeforge goal install' to create skill files",
	};
}

function checkSettingsHooks(projectRoot: string): GoalCheckResult {
	if (hasGoalHooks(projectRoot)) {
		return {
			name: "Settings hooks",
			status: "pass",
			message: "Goal hooks registered in .claude/settings.json",
		};
	}
	return {
		name: "Settings hooks",
		status: "fail",
		message: "Goal hooks not registered in .claude/settings.json",
		hint: "Run 'codeforge goal install' to register hooks",
	};
}

function checkConfigFile(projectRoot: string): GoalCheckResult {
	const configPath = join(projectRoot, ".codeforge", "goal", "config.json");
	if (existsSync(configPath)) {
		return {
			name: "Config file",
			status: "pass",
			message: ".codeforge/goal/config.json present",
		};
	}
	return {
		name: "Config file",
		status: "fail",
		message: ".codeforge/goal/config.json missing",
		hint: "Run 'codeforge goal install' to create config",
	};
}

async function checkDaemonHealth(port: number): Promise<GoalCheckResult> {
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 3_000);
		const res = await fetch(`http://127.0.0.1:${port}/health`, {
			signal: controller.signal,
		});
		clearTimeout(timer);
		if (res.ok) {
			return {
				name: "Daemon reachable",
				status: "pass",
				message: `Daemon responding on port ${port}`,
			};
		}
		return {
			name: "Daemon reachable",
			status: "fail",
			message: `Daemon returned HTTP ${res.status}`,
			hint: "Restart the daemon with 'codeforge goal daemon'",
		};
	} catch {
		return {
			name: "Daemon reachable",
			status: "warn",
			message: `Daemon not reachable on port ${port}`,
			hint: "Start the daemon with 'codeforge goal daemon'",
		};
	}
}

async function checkDbWritable(port: number): Promise<GoalCheckResult> {
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 3_000);
		const res = await fetch(`http://127.0.0.1:${port}/status`, {
			signal: controller.signal,
		});
		clearTimeout(timer);
		if (res.ok) {
			const data = (await res.json()) as { db?: { path: string; size: number } };
			if (data.db) {
				return {
					name: "DB writable",
					status: "pass",
					message: "Database connected and writable",
				};
			}
		}
		return {
			name: "DB writable",
			status: "fail",
			message: "Database not reported as connected",
			hint: "Check daemon logs at .codeforge/goal/logs/daemon.log",
		};
	} catch {
		return {
			name: "DB writable",
			status: "warn",
			message: "Cannot check DB (daemon not reachable)",
			hint: "Start the daemon first",
		};
	}
}

function checkGoalDirWritable(projectRoot: string): GoalCheckResult {
	const goalDir = join(projectRoot, ".claude", "goal");
	const testFile = join(goalDir, ".doctor-write-test");
	try {
		writeFileSync(testFile, "test");
		unlinkSync(testFile);
		return {
			name: "Goal dir writable",
			status: "pass",
			message: ".claude/goal/ is writable",
		};
	} catch {
		// Directory may not exist yet — check if parent is writable
		const claudeDir = join(projectRoot, ".claude");
		if (!existsSync(claudeDir)) {
			return {
				name: "Goal dir writable",
				status: "warn",
				message: ".claude/ directory does not exist",
				hint: "Run 'codeforge goal install' first",
			};
		}
		return {
			name: "Goal dir writable",
			status: "fail",
			message: ".claude/goal/ is not writable",
			hint: "Check directory permissions",
		};
	}
}

function checkEnvVar(name: string, label: string): GoalCheckResult {
	if (process.env[name]) {
		return {
			name: label,
			status: "pass",
			message: `${name} is set`,
		};
	}
	return {
		name: label,
		status: "warn",
		message: `${name} not set`,
		hint: `Set ${name} in your environment for AI-powered evaluations`,
	};
}

function checkGitAvailable(): GoalCheckResult {
	try {
		const result = Bun.spawnSync(["git", "--version"]);
		if (result.exitCode === 0) {
			return {
				name: "Git available",
				status: "pass",
				message: "git is in PATH",
			};
		}
		return {
			name: "Git available",
			status: "fail",
			message: "git command failed",
			hint: "Install git or add it to PATH",
		};
	} catch {
		return {
			name: "Git available",
			status: "fail",
			message: "git not found in PATH",
			hint: "Install git",
		};
	}
}

function formatGoalDoctorText(report: GoalDoctorReport, useColor: boolean): string {
	const c = {
		bold: useColor ? chalk.bold : (s: string) => s,
		green: useColor ? chalk.green : (s: string) => s,
		yellow: useColor ? chalk.yellow : (s: string) => s,
		red: useColor ? chalk.red : (s: string) => s,
	};

	function icon(status: GoalCheckResult["status"]): string {
		switch (status) {
			case "pass":
				return c.green("✓");
			case "warn":
				return c.yellow("⚠");
			case "fail":
				return c.red("✗");
		}
	}

	const lines: string[] = [];
	lines.push(c.bold("Goal Doctor"));
	lines.push("━━━━━━━━━━━");
	lines.push("");

	for (const check of report.checks) {
		lines.push(`  ${icon(check.status)} ${check.name} — ${check.message}`);
		if (check.hint) {
			lines.push(`    → ${check.hint}`);
		}
	}

	lines.push("");
	lines.push("━━━━━━━━━━━");
	const parts = [`${report.passed} passed`];
	if (report.failed > 0) parts.push(`${report.failed} failed`);
	if (report.warnings > 0)
		parts.push(`${report.warnings} warning${report.warnings !== 1 ? "s" : ""}`);
	lines.push(`  ${parts.join(", ")}`);

	return lines.join("\n");
}

function formatGoalDoctorJson(report: GoalDoctorReport): string {
	return JSON.stringify(
		{
			checks: report.checks,
			summary: {
				passed: report.passed,
				failed: report.failed,
				warnings: report.warnings,
			},
		},
		null,
		2,
	);
}

export function registerGoalDoctorCommand(parent: Command): void {
	parent
		.command("doctor")
		.description("Check goal daemon installation health")
		.option("--format <format>", "Output format: text or json", "text")
		.option("--no-color", "Disable colored output")
		.action(async (options) => {
			const projectRoot = process.cwd();
			const config = loadDaemonConfig(projectRoot);
			const port = config.port;
			const showSpinner = options.format !== "json";
			const s = showSpinner ? spinner() : null;

			s?.start("Checking goal daemon installation...");

			// Run local checks (sync) and remote checks (async) in parallel
			const [
				hookCheck,
				skillCheck,
				settingsCheck,
				configCheck,
				goalDirCheck,
				groqCheck,
				openrouterCheck,
				gitCheck,
				daemonCheck,
				dbCheck,
			] = await Promise.all([
				Promise.resolve(checkHookFiles(projectRoot)),
				Promise.resolve(checkSkillFiles(projectRoot)),
				Promise.resolve(checkSettingsHooks(projectRoot)),
				Promise.resolve(checkConfigFile(projectRoot)),
				Promise.resolve(checkGoalDirWritable(projectRoot)),
				Promise.resolve(checkEnvVar("GROQ_API_KEY", "GROQ_API_KEY")),
				Promise.resolve(checkEnvVar("OPENROUTER_API_KEY", "OPENROUTER_API_KEY")),
				Promise.resolve(checkGitAvailable()),
				checkDaemonHealth(port),
				checkDbWritable(port),
			]);

			s?.stop("Checks complete");

			const checks: GoalCheckResult[] = [
				hookCheck,
				skillCheck,
				settingsCheck,
				configCheck,
				daemonCheck,
				dbCheck,
				goalDirCheck,
				groqCheck,
				openrouterCheck,
				gitCheck,
			];

			const report: GoalDoctorReport = {
				checks,
				passed: checks.filter((c) => c.status === "pass").length,
				failed: checks.filter((c) => c.status === "fail").length,
				warnings: checks.filter((c) => c.status === "warn").length,
			};

			if (options.format === "json") {
				console.log(formatGoalDoctorJson(report));
			} else {
				const useColor = options.color !== false;
				console.log(formatGoalDoctorText(report, useColor));
			}

			if (report.failed > 0) {
				process.exit(1);
			}
		});
}

// Exported for testing
export {
	checkHookFiles,
	checkSkillFiles,
	checkSettingsHooks,
	checkConfigFile,
	checkDaemonHealth,
	checkDbWritable,
	checkGoalDirWritable,
	checkEnvVar,
	checkGitAvailable,
	formatGoalDoctorJson,
	formatGoalDoctorText,
};
export type { GoalCheckResult, GoalDoctorReport };
