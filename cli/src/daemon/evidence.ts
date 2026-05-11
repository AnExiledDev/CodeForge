import type { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { Evidence } from "../schemas/goal.js";

// Timeout for git subprocesses — prevents a hung git from blocking evaluation indefinitely.
const GIT_TIMEOUT_MS = 30_000;

async function runGit(cwd: string, args: string[]): Promise<string[]> {
	try {
		const proc = Bun.spawn(["git", ...args], {
			cwd,
			stdout: "pipe",
			stderr: "pipe",
		});

		// Read stdout and wait for exit concurrently, race against timeout
		const outputPromise = new Response(proc.stdout).text();
		const timeout = new Promise<"timeout">((resolve) =>
			setTimeout(() => resolve("timeout"), GIT_TIMEOUT_MS),
		);
		const race = await Promise.race([proc.exited, timeout]);

		if (race === "timeout") {
			proc.kill();
			return [];
		}

		if (proc.exitCode !== 0) {
			return [];
		}

		const output = await outputPromise;
		return output
			.trim()
			.split("\n")
			.filter((line) => line.length > 0);
	} catch {
		return [];
	}
}

function parsePlanCheckboxes(cwd: string): {
	checked: string[];
	unchecked: string[];
} {
	const planPath = join(cwd, ".claude", "goal", "plan.md");
	if (!existsSync(planPath)) {
		return { checked: [], unchecked: [] };
	}

	const content = readFileSync(planPath, "utf-8");
	const lines = content.split("\n");
	const checked: string[] = [];
	const unchecked: string[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith("- [x]") || trimmed.startsWith("- [X]")) {
			checked.push(trimmed.slice(6).trim());
		} else if (trimmed.startsWith("- [ ]")) {
			unchecked.push(trimmed.slice(6).trim());
		}
	}

	return { checked, unchecked };
}

function queryRecentValidationCommands(
	db: Database,
	goalId: string | null,
): string[] {
	if (!goalId) {
		return [];
	}

	const validationPatterns = [
		"%test%",
		"%build%",
		"%lint%",
		"%check%",
		"%typecheck%",
		"%tsc%",
		"%jest%",
		"%vitest%",
		"%bun test%",
	];

	const placeholders = validationPatterns
		.map(() => "input_json LIKE ?")
		.join(" OR ");
	const query = `SELECT input_json FROM tool_events WHERE goal_id = ? AND (${placeholders}) ORDER BY created_at DESC LIMIT 20`;

	try {
		const rows = db.prepare(query).all(goalId, ...validationPatterns) as Array<{
			input_json: string;
		}>;

		return rows
			.map((row) => {
				try {
					const parsed = JSON.parse(row.input_json);
					return parsed.command ?? parsed.input ?? row.input_json;
				} catch {
					return row.input_json;
				}
			})
			.filter((cmd): cmd is string => typeof cmd === "string");
	} catch {
		return [];
	}
}

export async function gatherEvidence(
	cwd: string,
	goalId: string | null,
	db: Database,
): Promise<Evidence> {
	const [gitStatus, gitDiffStat, gitDiffNames, changedFiles] =
		await Promise.all([
			runGit(cwd, ["status", "--short"]),
			runGit(cwd, ["diff", "--stat"]),
			runGit(cwd, ["diff", "--name-only"]),
			goalId
				? runGit(cwd, ["diff", "--name-only", "HEAD@{0}"])
				: Promise.resolve([]),
		]);

	const { checked, unchecked } = parsePlanCheckboxes(cwd);
	const recentValidationCommands = queryRecentValidationCommands(db, goalId);

	return {
		gitStatus,
		gitDiffStat,
		gitDiffNames,
		uncheckedPlanItems: unchecked,
		checkedPlanItems: checked,
		recentValidationCommands,
		changedFilesSinceGoalStart: changedFiles,
	};
}
