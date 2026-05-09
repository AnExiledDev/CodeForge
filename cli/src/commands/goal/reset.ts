import type { Command } from "commander";

export function registerGoalResetCommand(parent: Command): void {
	parent
		.command("reset")
		.description("Reset the current goal state")
		.option("--yes", "Skip confirmation prompt")
		.action((_options) => {
			console.log("Reset not yet implemented (session 2).");
		});
}
