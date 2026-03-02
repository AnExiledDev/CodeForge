---
title: Plugins
description: Overview of the CodeForge plugin system — how plugins work, what they provide, and how to enable or disable them.
sidebar:
  order: 1
---

CodeForge extends Claude Code through a modular plugin system. Each plugin bundles related hooks, scripts, agents, skills, or commands into a self-contained package that integrates directly into your development workflow. You get intelligent task delegation, domain-specific knowledge, specification management, and safety guardrails — all without manual configuration.

## What Plugins Do For You

Plugins are the backbone of CodeForge's power. Instead of configuring Claude Code from scratch, you get a curated set of capabilities that work together out of the box:

- **Agents** delegate tasks to specialists with the right tools and constraints for the job
- **Skills** inject domain expertise (frameworks, patterns, workflows) into your session automatically
- **Hooks** run scripts at key moments — before a tool executes, after it completes, or when a turn finishes
- **Safety guards** prevent destructive commands, enforce file boundaries, and protect critical configuration

Every plugin is independent. You can enable or disable any plugin without affecting the others.

## How Plugins Work

Plugins live inside `.devcontainer/plugins/` and follow a standard directory structure. Each plugin declares its capabilities in a `.claude-plugin/plugin.json` manifest that tells CodeForge what the plugin provides and how to activate it.

### Plugin Structure

A typical plugin directory looks like this:

```
plugins/
└── my-plugin/
    ├── .claude-plugin/
    │   └── plugin.json      # Manifest: name, description, author
    ├── hooks/
    │   └── hooks.json       # Hook registrations (which events to listen for)
    ├── scripts/             # Python scripts that hooks execute
    ├── agents/              # Agent definitions as Markdown files (optional)
    └── skills/              # Skill packs as SKILL.md files (optional)
```

The `plugin.json` manifest is minimal — it identifies the plugin and its author:

```json
{
  "name": "agent-system",
  "description": "21 custom agents with built-in agent redirection, CWD injection, and read-only bash enforcement",
  "author": {
    "name": "AnExiledDev"
  }
}
```

The real configuration lives in `hooks.json`, which maps hook events to the scripts that handle them. Here is an example from the skill engine:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 ${CLAUDE_PLUGIN_ROOT}/scripts/skill-suggester.py",
            "timeout": 3
          }
        ]
      }
    ]
  }
}
```

Each hook registration specifies the event to listen for, the script to run, and a timeout in seconds. The `${CLAUDE_PLUGIN_ROOT}` variable resolves to the plugin's directory, so scripts are always found regardless of installation path.

### The Hook System

Hooks are the primary integration mechanism. They let plugins run custom logic at specific moments during a Claude Code session. Each hook fires at a defined point in the tool lifecycle:

| Hook Event | When It Fires | Typical Use |
|------------|---------------|-------------|
| **PreToolUse** | Before a tool executes | Block dangerous commands, enforce read-only mode, redirect agents |
| **PostToolUse** | After a tool completes | Inject context, check for regressions, process results |
| **Stop** | When the assistant finishes a turn | Run quality checks, send notifications, remind about specs |
| **UserPromptSubmit** | When the user sends a prompt | Auto-suggest skills, fetch ticket context, inject state |
| **SubagentStart** | When a subagent is spawned | Inject working directory, configure agent environment |
| **TeammateIdle** | When a teammate agent is idle | Check for task completion, reassign work |
| **TaskCompleted** | When a team task finishes | Verify results, trigger follow-up work |

Hook scripts are Python programs that receive JSON on stdin and return JSON on stdout. They can either **allow** the operation (exit 0), **block** it (exit 2 with a reason), or **inject context** (return additional information for Claude to use).

:::tip[Hooks Are Non-Destructive]
Most hooks are advisory — they add context or surface reminders without interrupting your flow. Only safety-critical hooks (like the dangerous command blocker) actively block operations.
:::

See [Hooks](../customization/hooks/) for the full hook API and configuration details.

## Installed Plugins

CodeForge ships with 13 local marketplace plugins plus 1 external Anthropic plugin, organized into two categories: **core plugins** that provide primary functionality, and **safety and integration plugins** that protect your work and connect to external tools.

### Core Plugins

These plugins deliver the headline features of CodeForge — intelligent delegation, domain expertise, and workflow management.

| Plugin | What It Does |
|--------|-------------|
| [Agent System](./agent-system/) | 21 specialized agents with automatic delegation, CWD injection, and read-only enforcement |
| [Skill Engine](./skill-engine/) | 22 domain skills with context-aware auto-suggestion |
| [Spec Workflow](./spec-workflow/) | Full specification lifecycle from creation through implementation to as-built closure |
| [Ticket Workflow](./ticket-workflow/) | GitHub issue integration with EARS-formatted tickets and automated PR reviews |
| [Git Workflow](./git-workflow/) | Standalone git operations: /ship (review/commit/push/PR) and /pr:review |
| [Prompt Snippets](./prompt-snippets/) | Quick behavioral mode switches via /ps command |

### Safety Plugins

These plugins prevent mistakes, enforce boundaries, and keep your work safe.

| Plugin | What It Does |
|--------|-------------|
| [Auto Code Quality](./auto-code-quality/) | Automated formatting, linting, and advisory test running |
| [Dangerous Command Blocker](./dangerous-command-blocker/) | Blocks destructive shell commands like `rm -rf`, `drop table`, force pushes |
| [Workspace Scope Guard](./workspace-scope-guard/) | Ensures file operations stay within your project directory |
| [Protected Files Guard](./protected-files-guard/) | Prevents modification of secrets, lock files, and critical configuration |

### Integration Plugins

These plugins connect CodeForge to external tools and add quality-of-life features.

| Plugin | What It Does |
|--------|-------------|
| [Session Context](./session-context/) | Injects git state, harvests TODOs, and reminds about uncommitted work |
| [Notify Hook](./notify-hook/) | Desktop notifications when tasks complete |
| [CodeForge LSP](./codeforge-lsp/) | Language server protocol integration for Python, TypeScript, and Go |
| [Frontend Design](./frontend-design/) | Frontend design patterns and UI component skills (Anthropic official) |
| Code Review | Automated code review skill (Anthropic official) |
| Feature Dev | Feature development guidance skill (Anthropic official) |
| PR Review Toolkit | PR review commands and agents (Anthropic official) |

## Enabling and Disabling Plugins

Plugins are declared in `settings.json` under the `enabledPlugins` key. Every plugin listed there activates automatically when your container starts.

```json
{
  "enabledPlugins": [
    "agent-system",
    "skill-engine",
    "spec-workflow",
    "session-context",
    "auto-code-quality",
    "workspace-scope-guard",
    "dangerous-command-blocker",
    "protected-files-guard",
    "codeforge-lsp",
    "ticket-workflow",
    "notify-hook",
    "frontend-design",
    "code-review",
    "feature-dev",
    "pr-review-toolkit"
  ]
}
```

To disable a plugin, remove it from the list. To re-enable it, add it back. Changes take effect on the next container start.

:::caution[Safety Plugins]
Think carefully before disabling safety plugins like `dangerous-command-blocker` or `workspace-scope-guard`. These protect against accidental data loss and scope violations.
:::

See [Configuration](../customization/configuration/) for the full `settings.json` reference.

## The Plugin Marketplace

All plugins ship through the CodeForge devs-marketplace — a curated collection bundled with the devcontainer. The marketplace lives at `.devcontainer/plugins/devs-marketplace/plugins/` and contains every plugin's source code, hooks, agents, skills, and scripts.

The marketplace model means plugins are tested and maintained alongside CodeForge itself. When you update your devcontainer, you get the latest versions of all plugins automatically.

:::note[Custom Plugins]
The plugin structure is open and well-defined. You can create your own plugins by following the same directory layout and manifest format. Place custom plugins in `.devcontainer/plugins/` and add them to `enabledPlugins` in your settings.
:::

## Related

- [Hooks](../customization/hooks/) — detailed hook API and event documentation
- [Configuration](../customization/configuration/) — managing settings and plugin activation
- [Agent System](./agent-system/) — the flagship plugin for intelligent delegation
- [Architecture](../reference/architecture/) — how plugins fit into the CodeForge system
