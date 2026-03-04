#!/usr/bin/env bun

import { Command } from "commander";
import { registerPlanSearchCommand } from "./commands/plan/search.js";
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

program.parse();
