import type { Command } from "commander";
import { checkGhAuth, checkGitUser } from "./checks/auth.js";
import {
	checkCacheDirs,
	checkDockerMemory,
	checkTmpdir,
	checkWorkspaceFs,
} from "./checks/environment.js";
import { checkGitSafeDirectories } from "./checks/git.js";
import { checkVolumeCandidates } from "./checks/volumes.js";
import { checkDefenderExclusions, checkWslConfig } from "./checks/wsl.js";
import { runFixMode } from "./fix.js";
import { formatJson, formatText } from "./format.js";
import type { CheckResult, DoctorReport } from "./types.js";

export function registerDoctorCommand(parent: Command): void {
	parent
		.command("doctor")
		.description("Check CodeForge environment health (WSL, auth, caches)")
		.option("--format <format>", "Output format: text or json", "text")
		.option("--no-color", "Disable colored output")
		.option("--fix", "Enter interactive fix mode")
		.option("-y, --yes", "Skip TUI prompts, apply all fixes")
		.option("--dry-run", "Show what --fix would change without applying")
		.option("--only <category>", "Filter fixes: auth, env, git, volumes, wsl")
		.action(async (options) => {
			const workspaceRoot = process.env.WORKSPACE_ROOT || "/workspaces";

			// Run auth + environment checks in parallel
			const [authChecks, envChecks] = await Promise.all([
				Promise.all([checkGhAuth(), checkGitUser()]),
				Promise.all([
					checkWorkspaceFs(),
					checkTmpdir(),
					checkCacheDirs(),
					checkDockerMemory(),
				]),
			]);

			// Determine WSL status from workspace FS check
			const isWsl = envChecks.some(
				(c) => c.name === "Workspace filesystem" && c.status === "warn",
			);

			// Run git + volume + WSL checks (WSL checks return null when not WSL)
			const [gitCheck, volumeChecks, wslConfigCheck, defenderCheck] =
				await Promise.all([
					checkGitSafeDirectories(workspaceRoot),
					checkVolumeCandidates(workspaceRoot),
					checkWslConfig(isWsl),
					checkDefenderExclusions(isWsl),
				]);

			// Assemble all checks, filtering out nulls from WSL checks
			const wslChecks = [wslConfigCheck, defenderCheck].filter(
				(c): c is CheckResult => c !== null,
			);

			const checks: CheckResult[] = [
				...authChecks,
				...envChecks,
				gitCheck,
				...volumeChecks,
				...wslChecks,
			];

			const report: DoctorReport = {
				checks,
				passed: checks.filter((c) => c.status === "pass").length,
				failed: checks.filter((c) => c.status === "fail").length,
				warnings: checks.filter((c) => c.status === "warn").length,
			};

			// Display report
			if (options.format === "json") {
				console.log(formatJson(report));
			} else {
				const useColor = options.color !== false;
				console.log(formatText(report, useColor));
			}

			// Fix mode
			if (options.fix) {
				console.log(""); // spacing between report and fix mode
				await runFixMode(checks, {
					yes: options.yes ?? false,
					dryRun: options.dryRun ?? false,
					only: options.only,
				});
			}

			if (report.failed > 0) {
				process.exit(1);
			}
		});
}

// Exported for testing
export { formatJson, formatText } from "./format.js";
export type { CheckResult, DoctorReport } from "./types.js";
