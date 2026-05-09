import type { Command } from "commander";
import { loadDaemonConfig } from "../../daemon/config.js";
import type { StatusResponse } from "../../schemas/goal.js";

export function registerGoalStatusCommand(parent: Command): void {
	parent
		.command("status")
		.description("Show goal daemon status")
		.option("--port <port>", "Override daemon port", Number.parseInt)
		.action(async (options) => {
			const config = loadDaemonConfig();
			const port = options.port ?? config.port;
			const url = `http://127.0.0.1:${port}/status`;

			try {
				const res = await fetch(url);
				const data = (await res.json()) as StatusResponse;

				console.log(`Daemon:     ${data.daemon}`);
				console.log(`Port:       ${data.port}`);
				console.log(`DB path:    ${data.db.path}`);
				console.log(`DB size:    ${data.db.size} bytes`);
				console.log(`Active goal: ${data.activeGoal ?? "none"}`);
				console.log(`Uptime:     ${data.uptime}s`);
			} catch {
				console.log("Daemon is not running.");
				process.exit(1);
			}
		});
}
