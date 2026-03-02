---
title: First Session
description: Walkthrough of your first Claude Code session inside a CodeForge DevContainer.
sidebar:
  order: 6
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
| `cc-orc` | Orchestrator mode — delegation-first approach, useful for complex multi-agent tasks |
| `ccraw` | Raw Claude Code session with no CodeForge configuration — useful for debugging |

:::tip[When to use ccraw]
If something isn't working as expected in a CodeForge session, try `ccraw` to see if the issue is with CodeForge's configuration or with Claude Code itself. It launches a completely vanilla session with no plugins, system prompts, or hooks.
:::

## What Happens Automatically

When your session starts, several systems activate behind the scenes. You don't need to configure any of this — it just works.

- **System prompt** — gives Claude context about your project, coding standards, and how to communicate. Customizable via [System Prompts](../customization/system-prompts/).
- **Plugin hooks** — 17 plugins fire automatically at key moments: blocking dangerous commands, guarding workspace scope, injecting git state, running code quality checks, and more. See the [Plugins Overview](../plugins/) for details on each one.
- **Session context** — Claude always knows your current branch, uncommitted changes, recent commits, and active TODOs without you having to explain it.

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

# Search past session history (ccms is currently disabled — replacement pending)
# ccms "what did we work on"

# Check API token usage
ccusage

# Open the session analytics dashboard
claude-dashboard
```

## Agents and Skills

CodeForge includes **21 specialized agents** and **38 skills** that activate automatically based on what you're working on. You don't need to memorize names — just describe what you want, and Claude delegates to the right specialist. The examples in "What to Try First" above show this in action.

- **[Agents](../features/agents/)** — specialized AI personas for architecture, debugging, testing, security, migrations, and more
- **[Skills](../features/skills/)** — domain-specific knowledge packs (FastAPI, Docker, Svelte, debugging patterns, etc.) that the skill engine suggests automatically or you invoke with slash commands like `/spec-new`

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
- [Agents](../features/agents/) — explore all 21 specialized agents in detail
- [Skills](../features/skills/) — browse the complete skill catalog
- [Configuration](../customization/configuration/) — customize CodeForge to match your preferences
- [Commands Reference](../reference/commands/) — full reference for all CLI commands
