#!/usr/bin/env bun

import { Command } from "commander";
import { registerConfigApplyCommand } from "./commands/config/apply.js";
import { registerConfigShowCommand } from "./commands/config/show.js";
import { registerContainerDownCommand } from "./commands/container/down.js";
import { registerContainerExecCommand } from "./commands/container/exec.js";
import { registerContainerLsCommand } from "./commands/container/ls.js";
import { registerContainerRebuildCommand } from "./commands/container/rebuild.js";
import { registerContainerShellCommand } from "./commands/container/shell.js";
import { registerContainerUpCommand } from "./commands/container/up.js";
import { registerIndexBuildCommand } from "./commands/index/build.js";
import { registerIndexCleanCommand } from "./commands/index/clean.js";
import { registerIndexSearchCommand } from "./commands/index/search.js";
import { registerIndexShowCommand } from "./commands/index/show.js";
import { registerIndexStatsCommand } from "./commands/index/stats.js";
import { registerIndexTreeCommand } from "./commands/index/tree.js";
import { registerPlanSearchCommand } from "./commands/plan/search.js";
import { registerPluginAgentsCommand } from "./commands/plugin/agents.js";
import { registerPluginDisableCommand } from "./commands/plugin/disable.js";
import { registerPluginEnableCommand } from "./commands/plugin/enable.js";
import { registerPluginHooksCommand } from "./commands/plugin/hooks.js";
import { registerPluginListCommand } from "./commands/plugin/list.js";
import { registerPluginShowCommand } from "./commands/plugin/show.js";
import { registerPluginSkillsCommand } from "./commands/plugin/skills.js";
import { registerProxyCommand } from "./commands/proxy.js";
import { registerListCommand } from "./commands/session/list.js";
import { registerSearchCommand } from "./commands/session/search.js";
import { registerShowCommand } from "./commands/session/show.js";
import { registerTokensCommand } from "./commands/session/tokens.js";
import { registerTaskListCommand } from "./commands/task/list.js";
import { registerTaskSearchCommand } from "./commands/task/search.js";
import { registerTaskShowCommand } from "./commands/task/show.js";
import { isInsideContainer, proxyCommand } from "./utils/context.js";
import { resolveContainer } from "./utils/docker.js";

const program = new Command();

program
	.name("codeforge")
	.description("CLI for CodeForge development workflows (experimental)")
	.version("0.1.0")
	.option("--local", "Run against local host filesystem (skip container proxy)")
	.option("--container <name>", "Target a specific container by name");

const session = program
	.command("session")
	.description("Search and analyze Claude Code session history");

registerSearchCommand(session);
registerListCommand(session);
registerShowCommand(session);
registerTokensCommand(session);

const task = program.command("task").description("Search and manage tasks");

registerTaskListCommand(task);
registerTaskSearchCommand(task);
registerTaskShowCommand(task);

const plan = program.command("plan").description("Search and manage plans");

registerPlanSearchCommand(plan);

const plugin = program
	.command("plugin")
	.description("Manage Claude Code plugins");

registerPluginListCommand(plugin);
registerPluginShowCommand(plugin);
registerPluginEnableCommand(plugin);
registerPluginDisableCommand(plugin);
registerPluginHooksCommand(plugin);
registerPluginAgentsCommand(plugin);
registerPluginSkillsCommand(plugin);

const config = program
	.command("config")
	.description("Manage Claude Code configuration");

registerConfigShowCommand(config);
registerConfigApplyCommand(config);

const index = program
	.command("index")
	.description("Build and search a codebase symbol index");

registerIndexBuildCommand(index);
registerIndexSearchCommand(index);
registerIndexShowCommand(index);
registerIndexStatsCommand(index);
registerIndexTreeCommand(index);
registerIndexCleanCommand(index);

const container = program
	.command("container")
	.description("Manage CodeForge devcontainers");

registerContainerUpCommand(container);
registerContainerDownCommand(container);
registerContainerRebuildCommand(container);
registerContainerExecCommand(container);
registerContainerLsCommand(container);
registerContainerShellCommand(container);

registerProxyCommand(program);

// Proxy middleware: when outside container and not --local, proxy existing commands into container
program.hook("preAction", async (_thisCommand, actionCommand) => {
	const opts = program.opts();

	// Skip proxy if inside container or --local is set
	if (isInsideContainer() || opts.local) return;

	// Skip proxy for container commands (they run on host)
	let cmd = actionCommand;
	while (cmd.parent && cmd.parent !== program) {
		cmd = cmd.parent;
	}
	if (cmd.name() === "container" || cmd.name() === "proxy") return;

	// Proxy into running container
	try {
		const target = await resolveContainer(opts.container);
		// Build args: strip --local and --container flags from original args
		const args = process.argv.slice(2).filter((arg, i, arr) => {
			if (arg === "--local") return false;
			if (arg === "--container") return false;
			// Skip the value after --container
			if (i > 0 && arr[i - 1] === "--container") return false;
			return true;
		});
		await proxyCommand(target.id, args);
		// proxyCommand calls process.exit, but just in case:
		process.exit(0);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`Proxy error: ${message}`);
		console.error("Use --local to run against the host filesystem directly.");
		process.exit(1);
	}
});

program.parse();
