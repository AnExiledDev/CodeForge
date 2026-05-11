import type { Command } from "commander";
import { join } from "path";
import { loadDaemonConfig } from "../../daemon/config.js";
import type { GoalState } from "../../schemas/goal.js";

interface GoalCurrentResponse {
	goal: GoalState;
}

/** Validate that a parsed JSON object has the expected goal response shape. */
function isGoalResponse(data: unknown): data is GoalCurrentResponse {
	if (!data || typeof data !== "object") return false;
	const obj = data as Record<string, unknown>;
	if (!obj.goal || typeof obj.goal !== "object") return false;
	const goal = obj.goal as Record<string, unknown>;
	return typeof goal.id === "string" && typeof goal.objective === "string";
}

export function registerGoalStatusCommand(parent: Command): void {
	parent
		.command("status")
		.description("Show current goal status")
		.option("--port <port>", "Override daemon port", Number.parseInt)
		.option("--format <format>", "Output format (text or json)", "text")
		.action(async (options) => {
			const config = loadDaemonConfig();
			const port = options.port ?? config.port;
			const cwd = process.cwd();
			const baseUrl = `http://127.0.0.1:${port}`;

			let goalData: GoalCurrentResponse | null = null;
			let daemonReachable = false;

			try {
				const res = await fetch(
					`${baseUrl}/goal/current?cwd=${encodeURIComponent(cwd)}`,
				);
				daemonReachable = true;

				if (res.ok) {
					const parsed: unknown = await res.json();
					if (isGoalResponse(parsed)) {
						goalData = parsed;
					}
				}
			} catch {
				// Daemon not reachable
			}

			if (options.format === "json") {
				const output = {
					daemonRunning: daemonReachable,
					goal: goalData?.goal ?? null,
					artifacts: goalData?.goal
						? {
								stateJson: join(cwd, ".claude", "goal", "state.json"),
								progressMd: join(cwd, ".claude", "goal", "progress.md"),
							}
						: null,
				};
				console.log(JSON.stringify(output, null, 2));
				return;
			}

			if (!daemonReachable) {
				console.log("Daemon is not running.");
				console.log("");
				console.log("Start it with:");
				console.log("  codeforge goal daemon");
				process.exit(1);
			}

			if (!goalData) {
				console.log("No active goal.");
				return;
			}

			const g = goalData.goal;
			console.log(`Goal:       ${g.id}`);
			console.log(`Status:     ${g.status}${g.paused ? " (paused)" : ""}`);
			console.log(`Objective:  ${g.objective}`);
			console.log(`Checkpoint: ${g.currentCheckpoint}`);
			console.log(`Loops:      ${g.loopCount} / ${g.maxLoops}`);
			console.log(`Created:    ${g.createdAt}`);
			console.log(`Updated:    ${g.updatedAt}`);
			console.log("");
			console.log("Artifacts:");
			console.log(
				`  state.json:    ${join(cwd, ".claude", "goal", "state.json")}`,
			);
			console.log(
				`  progress.md:   ${join(cwd, ".claude", "goal", "progress.md")}`,
			);
		});
}
