---
title: Customization
description: Overview of CodeForge customization options — configuration, system prompts, rules, and hooks.
sidebar:
  order: 1
---

CodeForge ships with opinionated defaults that work well out of the box, but every aspect of the environment is designed to be changed. Whether you want to swap the default model, add project-specific coding standards, or wire up custom automation scripts, you can do it without forking anything.

## Customization Philosophy

Three principles guide how CodeForge handles configuration:

- **Sensible defaults with full override** -- The out-of-the-box setup reflects best practices for AI-assisted development. Nothing is locked down; you can change any behavior by editing the appropriate file.
- **Layered configuration** -- Settings compose from broad to specific. Default settings form the base, project settings override them, and environment variables override everything. You only need to specify what you want to change.
- **No magic** -- All configuration lives in readable files (JSON, Markdown, Python scripts). There is no hidden state, no binary configuration, and no behavior that you cannot trace to a specific file.

## Configuration Layers

Customization works through four layers, each targeting a different aspect of the environment:

| Layer | What It Controls | Key Files | Documentation |
|-------|-----------------|-----------|---------------|
| [Configuration](./configuration/) | Feature flags, plugin toggles, runtime settings, container setup | `settings.json`, `devcontainer.json`, `file-manifest.json` | Settings and deployment |
| [System Prompts](./system-prompts/) | Claude Code behavior, coding standards, response style | `main-system-prompt.md`, `writing-system-prompt.md` | Behavioral guidance |
| [Rules](./rules/) | Hard constraints applied to all sessions | `.claude/rules/*.md` | Mandatory requirements |
| [Hooks](./hooks/) | Scripts that run at lifecycle points | `hooks.json` + Python scripts | Automation and validation |

Each layer serves a distinct purpose. Configuration controls _what_ is active. System prompts shape _how_ Claude behaves. Rules define _what must or must not happen_. Hooks _automate actions_ at specific points in the workflow.

## Quick Customizations

Here are the most common changes you can make right away.

### Change the Default Model

Edit `settings.json` and change the `model` field:

```json
{
  "model": "sonnet",
  "env": {
    "ANTHROPIC_MODEL": "claude-sonnet-4-5-20250929"
  }
}
```

This takes effect on the next session. See [Configuration](./configuration/) for the full settings reference.

### Toggle a Plugin

Every plugin can be enabled or disabled in `settings.json` under `enabledPlugins`:

```json
{
  "enabledPlugins": {
    "auto-code-quality@devs-marketplace": false,
    "agent-system@devs-marketplace": true
  }
}
```

Set a plugin to `false` to disable it without removing it.

### Add a Project Rule

Create a Markdown file in `.claude/rules/` with your constraint:

```markdown
# TypeScript Standards

1. Always use strict mode
2. Never use `any` -- use `unknown` instead
3. All API responses must include error handling
```

The rule is loaded automatically on the next session. See [Rules](./rules/) for details.

### Adjust Claude's Coding Style

Edit the main system prompt at `.devcontainer/config/defaults/main-system-prompt.md`. Changes to this file are deployed to `.claude/` on container start. See [System Prompts](./system-prompts/) for guidance on effective prompt customization.

### Add a Custom Hook

Register a script in your plugin's `hooks/hooks.json` to automate quality checks, inject context, or block dangerous operations. See [Hooks](./hooks/) for the full hook API.

### Disable a Feature

Any local DevContainer feature can be turned off by setting `"version": "none"` in `devcontainer.json`:

```json
{
  "features": {
    "./features/shfmt": { "version": "none" },
    "./features/hadolint": { "version": "none" }
  }
}
```

Rebuild the container after changing features. See [Configuration](./configuration/) for more on feature management.

### Override an Environment Variable per Session

You can override any setting for a single session by prefixing the command:

```bash
ANTHROPIC_MODEL="claude-sonnet-4-5-20250929" cc
```

This is useful for testing a different model without changing your config files. See [Environment Variables](../reference/environment/) for all available variables.

## How Configuration Flows

When a CodeForge container starts, configuration is assembled in this order:

1. **Container build** -- `devcontainer.json` installs features and runtimes
2. **Post-start setup** -- `setup.sh` runs scripts that deploy config files
3. **File manifest** -- `file-manifest.json` copies default settings, prompts, and rules to `.claude/`
4. **Plugin activation** -- Enabled plugins register their hooks
5. **Session start** -- Claude Code loads the system prompt, rules, and CLAUDE.md files

At session time, the precedence order is: environment variables > project config > workspace config > defaults.

## Related

- [Plugins](../plugins/) -- the plugin system that many customizations target
- [Architecture](../reference/architecture/) -- how configuration layers interact at runtime
- [Environment Variables](../reference/environment/) -- complete reference for all env vars
