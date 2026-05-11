import { confirm, isCancel } from "@clack/prompts";
import type { Command } from "commander";
import { rmSync } from "fs";
import { join } from "path";
import { loadDaemonConfig } from "../../daemon/config.js";

export function registerGoalResetCommand(parent: Command): void {
	parent
		.command("reset")
		.description("Clear the current active goal")
		.option("--yes", "Skip confirmation prompt")
		.option("--purge", "Also delete .claude/goal/ artifacts from disk")
		.option("--port <port>", "Override daemon port", Number.parseInt)
		.action(async (options) => {
			const config = loadDaemonConfig();
			const port = options.port ?? config.port;
			const cwd = process.cwd();
			const baseUrl = `http://127.0.0.1:${port}`;

			if (!options.yes) {
				const shouldClear = await confirm({
					message: "Clear the active goal?",
				});
				if (isCancel(shouldClear) || !shouldClear) {
					console.log("Aborted.");
					return;
				}
			}

			try {
				const res = await fetch(`${baseUrl}/goal/clear`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ cwd }),
				});

				if (res.ok) {
					console.log("Goal cleared.");
				} else {
					const data = await parseJsonResponse(res);
					const errorMsg =
						data && typeof data.error === "string"
							? data.error
							: `HTTP ${res.status}`;
					console.log(`Could not clear goal: ${errorMsg}`);
					process.exit(1);
				}
			} catch {
				console.log("Daemon is not running.");
				console.log("");
				console.log("Start it with:");
				console.log("  codeforge goal daemon");
				process.exit(1);
			}

			if (options.purge) {
				const goalDir = join(cwd, ".claude", "goal");
				try {
					rmSync(goalDir, { recursive: true, force: true });
					console.log(`Purged ${goalDir}`);
				} catch {
					// Directory may not exist
				}
			}
		});
}

/** Safely parse JSON from a fetch response — returns null on failure. */
function parseJsonResponse(
	res: Response,
): Promise<Record<string, unknown> | null> {
	return res.json().catch(() => null) as Promise<Record<
		string,
		unknown
	> | null>;
}
