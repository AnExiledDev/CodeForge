import { dirname } from "node:path";
import type { CheckResult } from "../types.js";
import { spawn } from "../util.js";

export async function checkGitSafeDirectories(
	workspaceRoot: string,
): Promise<CheckResult> {
	// Find all git repos (directories) and worktrees (files with gitdir:)
	const [dirResult, fileResult] = await Promise.all([
		spawn("find", [
			workspaceRoot,
			"-maxdepth",
			"6",
			"-name",
			".git",
			"-type",
			"d",
		]),
		spawn("find", [
			workspaceRoot,
			"-maxdepth",
			"6",
			"-name",
			".git",
			"-type",
			"f",
		]),
	]);

	const gitPaths = [
		...(dirResult.exitCode === 0 && dirResult.stdout
			? dirResult.stdout.split("\n").filter(Boolean)
			: []),
		...(fileResult.exitCode === 0 && fileResult.stdout
			? fileResult.stdout.split("\n").filter(Boolean)
			: []),
	];

	if (gitPaths.length === 0) {
		return {
			name: "Git safe directories",
			category: "git",
			status: "pass",
			message: "no git repositories found",
		};
	}

	// Get project roots from .git paths
	const projectDirs = [...new Set(gitPaths.map((p) => dirname(p)))];

	// Get current safe.directory entries
	const { stdout: safeOutput } = await spawn("git", [
		"config",
		"--global",
		"--get-all",
		"safe.directory",
	]);

	const safeDirs = new Set(
		safeOutput ? safeOutput.split("\n").filter(Boolean) : [],
	);

	// Find project dirs not in the safe list
	const missing = projectDirs.filter((dir) => !safeDirs.has(dir));

	if (missing.length === 0) {
		return {
			name: "Git safe directories",
			category: "git",
			status: "pass",
			message: `all ${projectDirs.length} project${projectDirs.length !== 1 ? "s" : ""} registered`,
		};
	}

	return {
		name: "Git safe directories",
		category: "git",
		status: "warn",
		message: `${missing.length} project${missing.length !== 1 ? "s" : ""} missing safe.directory`,
		hint: "Run codeforge doctor --fix --only git",
		fix: {
			label: `Add ${missing.length} safe.directory entr${missing.length !== 1 ? "ies" : "y"}`,
			detail: `Registers ${missing.length} project director${missing.length !== 1 ? "ies" : "y"} as git safe directories to prevent "dubious ownership" errors (CVE-2022-24765). Takes effect immediately.`,
			impact: `${missing.length} git config change${missing.length !== 1 ? "s" : ""}`,
			requiresRebuild: false,
			apply: async () => {
				const added: string[] = [];
				for (const dir of missing) {
					const { exitCode } = await spawn("git", [
						"config",
						"--global",
						"--add",
						"safe.directory",
						dir,
					]);
					if (exitCode === 0) {
						added.push(dir);
					}
				}

				if (added.length === 0) {
					return {
						applied: false,
						message: "Failed to add any safe.directory entries",
					};
				}

				return {
					applied: true,
					message: `Added ${added.length} safe.directory entr${added.length !== 1 ? "ies" : "y"}: ${added.join(", ")}`,
				};
			},
		},
	};
}
