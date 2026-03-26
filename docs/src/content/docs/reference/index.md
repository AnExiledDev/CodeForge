---
title: Reference
description: Technical reference for CodeForge — commands, environment variables, architecture, and changelog.
sidebar:
  order: 1
---

This section is a lookup resource for CodeForge internals. Use it when you need the exact name of a command, the default value of an environment variable, or a quick reminder of how components connect.

## Reference Pages

| Page | What You Will Find |
|------|-------------------|
| [Commands](./commands/) | Every CLI command and slash command, grouped by category, with usage examples |
| [Environment Variables](./environment/) | All environment variables with types, defaults, and where they are set |
| [Architecture](./architecture/) | System overview, component relationships, data flow, and design principles |
| [Changelog](./changelog/) | Version history from v1.0.0 to current, with migration notes |

## Most-Used Quick Reference

### Session Commands

| Command | What It Does |
|---------|-------------|
| `cc` | Start Claude Code with full CodeForge configuration |
| `ccw` | Start Claude Code in writing mode |
| `ccraw` | Start vanilla Claude Code (no plugins or custom prompt) |
| `ccms "query"` | Search session history _(currently disabled — replaced by `codeforge session search`)_ |
| `check-setup` | Verify your installation is healthy |

### Key Paths

| Path | Purpose |
|------|---------|
| `.codeforge/config/settings.json` | Primary configuration file |
| `.codeforge/config/main-system-prompt.md` | Main system prompt |
| `.codeforge/file-manifest.json` | Config file deployment rules |
| `.devcontainer/devcontainer.json` | Container definition |
| `.devcontainer/plugins/devs-marketplace/` | Local plugin marketplace |
| `.claude/rules/` | Active rules (deployed from defaults) |
| `.specs/` | Feature specifications |

### Spec Workflow Commands

| Command | What It Does |
|---------|-------------|
| `/spec <feature>` | Create, refine, and approve a spec package |
| `/spec constitution` | Create or update project-level Constitution |
| `/build <feature>` | Implement from spec — plan, build, review, close |
| `/specs` | Dashboard: spec health across the project |

## Key Configuration Files

These are the files you will interact with most often when configuring CodeForge:

| File | Location | Purpose |
|------|----------|---------|
| `settings.json` | `.codeforge/config/` | Model selection, plugin toggles, env vars, permissions |
| `main-system-prompt.md` | `.codeforge/config/` | Claude's coding behavior and response style |
| `writing-system-prompt.md` | `.codeforge/config/` | Claude's writing mode behavior |
| `file-manifest.json` | `.codeforge/` | Rules for deploying config files to `.claude/` |
| `devcontainer.json` | `.devcontainer/` | Container image, features, mounts, resource limits |
| `hooks.json` | Each plugin's `hooks/` directory | Hook registration for lifecycle automation |
| `plugin.json` | Each plugin's `.claude-plugin/` directory | Plugin manifest and metadata |

## Inventory at a Glance

| Component | Count | Details |
|-----------|-------|---------|
| DevContainer features | 22 | Runtimes, CLI tools, monitoring |
| Plugins | 17 (13 local + 4 Anthropic official) | Safety, quality, workflow, intelligence |
| Agents | 19 | Specialized personas from explorer to security-auditor |
| Skills | 34 | On-demand knowledge across coding, testing, frameworks |
| Built-in rules | 3 | Workspace scope, spec workflow, session search |
| CLI commands | 10+ | Session, analysis, code quality, intelligence |

## Related

- [Getting Started](../getting-started/) -- setup and first steps
- [Customization](../customization/) -- configuration and extension guides
- [Features](../features/) -- agents, skills, and tools
