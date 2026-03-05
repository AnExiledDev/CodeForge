#!/usr/bin/env bun

import { Command } from "commander";
import { registerConfigApplyCommand } from "./commands/config/apply.js";
import { registerConfigShowCommand } from "./commands/config/show.js";
import { registerPlanSearchCommand } from "./commands/plan/search.js";
import { registerPluginAgentsCommand } from "./commands/plugin/agents.js";
import { registerPluginDisableCommand } from "./commands/plugin/disable.js";
import { registerPluginEnableCommand } from "./commands/plugin/enable.js";
import { registerPluginHooksCommand } from "./commands/plugin/hooks.js";
import { registerPluginListCommand } from "./commands/plugin/list.js";
import { registerPluginShowCommand } from "./commands/plugin/show.js";
import { registerPluginSkillsCommand } from "./commands/plugin/skills.js";
import { registerReviewCommand } from "./commands/review/review.js";
import { registerListCommand } from "./commands/session/list.js";
import { registerSearchCommand } from "./commands/session/search.js";
import { registerShowCommand } from "./commands/session/show.js";
import { registerTaskSearchCommand } from "./commands/task/search.js";

const program = new Command();

program
	.name("codeforge")
	.description("CLI for CodeForge development workflows")
	.version("0.1.0");

const session = program
	.command("session")
	.description("Search and analyze Claude Code session history");

registerSearchCommand(session);
registerListCommand(session);
registerShowCommand(session);

const task = program.command("task").description("Search and manage tasks");

registerTaskSearchCommand(task);

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

registerReviewCommand(program);

program.parse();
