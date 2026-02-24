---
title: First Session
description: Walkthrough of your first Claude Code session inside a CodeForge DevContainer.
sidebar:
  order: 4
---

You've installed CodeForge and the container is running. Now it's time to launch your first Claude Code session and see everything in action. This guide walks you through what happens when you start a session, what to try first, and how the different systems work together.

## Starting a Session

Open a terminal inside the DevContainer and launch Claude Code:

```bash
cc
```

The `cc` command is a CodeForge alias that launches Claude Code with the correct system prompt, permission mode, and plugin hooks. It's the recommended way to start every session.

### Available Launch Commands

| Command | What It Does |
|---------|-------------|
| `cc` | Full CodeForge session with system prompt, plugins, and all configuration |
| `claude` | Same as `cc` — an alias for convenience |
| `ccw` | Writing-focused session using the writing system prompt (great for documentation) |
| `ccraw` | Raw Claude Code session with no CodeForge configuration — useful for debugging |

:::tip[When to use ccraw]
If something isn't working as expected in a CodeForge session, try `ccraw` to see if the issue is with CodeForge's configuration or with Claude Code itself. It launches a completely vanilla session with no plugins, system prompts, or hooks.
:::

## What Happens Automatically

When your session starts, several systems activate behind the scenes to make Claude smarter and safer. You don't need to configure any of this — it just works.

### System Prompt Loading

The main system prompt gives Claude context about your project, coding standards, and behavioral guidelines. It's loaded from your configuration directory and defines how Claude approaches tasks, what tools to prefer, and how to communicate. The prompt is customizable — see [System Prompts](../customization/system-prompts/) for details.

### Plugin Hook Activation

Plugins register hooks that fire at specific points during your session. These run automatically and silently in the background:

**PreToolUse hooks** run before Claude executes a command or edits a file:
- The **workspace scope guard** blocks writes outside your project directory
- The **dangerous command blocker** catches destructive shell commands (`rm -rf /`, `git push --force`, etc.)
- The **protected files guard** prevents edits to secrets, lock files, and other sensitive files

**PostToolUse hooks** run after a tool completes:
- The **session context** plugin injects git state and TODO information
- The **notify hook** sends a desktop notification when Claude finishes a long task

**Stop hooks** run when Claude finishes a turn:
- The **spec reminder** checks whether code was modified without updating specs
- The **auto code quality** plugin runs formatting and linting checks
- The **commit reminder** nudges you to commit if there are significant uncommitted changes

### Session Context Injection

The session context plugin keeps Claude informed about your working environment. At turn boundaries, it injects:

- **Git state** — current branch, uncommitted changes, recent commits
- **Active TODOs** — extracted from TODO comments in recently modified files
- **Commit reminders** — when there are significant uncommitted changes

This means Claude always knows the state of your repository without you having to explain it.

## What to Try First

Here are some practical things to try in your first session to see CodeForge's capabilities:

### Explore Your Codebase

Ask Claude to understand your project:

```
Explore this codebase and explain the architecture.
```

Claude delegates to the **explorer agent**, which systematically reads your project structure, key files, and configuration to build a comprehensive understanding. This is a great starting point for any new project.

### Run a Security Review

```
Review the security of the authentication module.
```

The **security auditor agent** activates and performs a structured review: checking for common vulnerabilities, reviewing authentication flows, and flagging potential issues with concrete recommendations.

### Generate Tests

```
Write tests for the user service.
```

The **test writer agent** generates tests that follow your project's existing patterns. It looks at your test framework, directory structure, and naming conventions before writing anything.

### Start a Feature with a Spec

```
/spec-new
```

This skill walks you through creating a feature specification. Specs bring structure to development — you define what you're building before writing code. See the [Spec Workflow plugin](../plugins/spec-workflow/) for the full lifecycle.

### Check Your Tools

From the terminal (not inside a Claude session), you can verify what's available:

```bash
# List all installed tools and their versions
cc-tools

# Search past session history
ccms "what did we work on"

# Check API token usage
ccusage

# Open the session analytics dashboard
claude-dashboard
```

## Working with Agents

CodeForge includes 17 specialized agents. You don't need to know their names — Claude automatically delegates to the right agent based on your request. But understanding what's available helps you make better requests.

Here are some example interactions and which agents handle them:

| Your Request | Agent | What It Does |
|-------------|-------|-------------|
| "Explore this codebase" | Explorer | Systematic codebase navigation |
| "Design the API for user management" | Architect | System design and architecture |
| "Debug why the login fails" | Debug Logs | Log analysis and bug investigation |
| "Refactor this module to reduce duplication" | Refactorer | Safe, incremental code transformations |
| "Write a migration from SQLite to PostgreSQL" | Migrator | Database and framework migrations |
| "Profile the performance of the search endpoint" | Perf Profiler | Performance analysis and optimization |
| "Audit this module for vulnerabilities" | Security Auditor | Security review and recommendations |
| "Write documentation for the API" | Doc Writer | Documentation generation |

Each agent carries domain-specific instructions that guide how Claude approaches the task. For example, the security auditor checks OWASP Top 10 categories, while the test writer respects your project's testing patterns and frameworks.

See [Agents](../features/agents/) for the full list of all 17 agents and their specializations.

## Working with Skills

Skills are domain-specific knowledge packs that Claude draws on when relevant. They're suggested automatically by the skill engine based on what you're working on, or you can invoke them directly with slash commands.

### Frequently Used Skills

| Skill | What It Provides |
|-------|-----------------|
| `/spec-new` | Create a new feature specification |
| `/spec-build` | Implement a feature from its spec (plan, build, review, close) |
| `/spec-check` | Audit spec health across the project |
| `/spec-update` | Update specs to match current implementation |

### Auto-Suggested Skills

You don't always need to invoke skills manually. The skill engine watches what you're working on and suggests relevant skills. For example:

- Working on a FastAPI endpoint? The FastAPI skill is suggested with best practices for route design, dependency injection, and error handling
- Writing Docker configuration? The Docker skill provides patterns for multi-stage builds, security hardening, and compose setups
- Debugging a tricky issue? The debugging skill offers systematic approaches to isolate and fix problems

See [Skills](../features/skills/) for the complete catalog of all 21 available skills.

## Understanding the Status Line

If your terminal supports it, CodeForge provides a status line that shows session information at a glance. The `ccstatusline` feature adds session metadata to your terminal prompt, so you always know which session you're in and its current state.

## Tips for Effective Sessions

:::tip[Be specific with requests]
Instead of "fix the bug," try "the login endpoint returns 500 when the email field is empty — debug and fix it." More context leads to better results, even though CodeForge gives Claude a lot of context automatically.
:::

:::tip[Use the spec workflow for features]
For anything beyond a simple bug fix, start with `/spec-new`. Writing a spec first helps Claude (and you) think through the design before writing code. The spec becomes a living document that tracks what was built and why.
:::

:::tip[Let agents do their thing]
When Claude delegates to a specialized agent, the agent follows its own structured approach. A security audit, for example, systematically checks categories rather than just looking at what seems obvious. Trust the process — the structured approach catches things that ad-hoc reviews miss.
:::

:::caution[Watch for commit reminders]
The session context plugin reminds you to commit when there are significant uncommitted changes. Don't ignore these — frequent commits make it easy to review and revert changes. Claude can help you write commit messages too.
:::

## Next Steps

- [Plugins Overview](../plugins/) — understand how each plugin enhances your workflow
- [Agents](../features/agents/) — explore all 17 specialized agents in detail
- [Skills](../features/skills/) — browse the complete skill catalog
- [Configuration](../customization/configuration/) — customize CodeForge to match your preferences
- [Commands Reference](../reference/commands/) — full reference for all CLI commands
