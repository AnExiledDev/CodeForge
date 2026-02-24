# DevContainer Development Guide

CodeForge devcontainer for AI-assisted development with Claude Code.

## Directory Structure

```
.devcontainer/
├── devcontainer.json          # Container definition
├── .env                       # Setup flags (SETUP_CONFIG, SETUP_ALIASES, etc.)
├── config/
│   ├── file-manifest.json     # Declarative config file deployment
│   └── defaults/              # Source files deployed on start via file-manifest
│       ├── settings.json      # Model, permissions, plugins, env vars
│       ├── main-system-prompt.md
│       ├── ccstatusline-settings.json  # Status bar widget layout
│       └── rules/             # Deployed to .claude/rules/
├── features/                  # Custom devcontainer features
├── plugins/devs-marketplace/  # Local plugin marketplace
└── scripts/                   # Setup scripts (run via postStartCommand)
```

## Key Configuration

| File | Purpose |
|------|---------|
| `config/defaults/settings.json` | Model, tokens, permissions, plugins, env vars |
| `config/defaults/main-system-prompt.md` | System prompt defining assistant behavior |
| `config/defaults/ccstatusline-settings.json` | Status bar widget layout (deployed to ~/.config/ccstatusline/) |
| `config/file-manifest.json` | Controls which config files deploy and when |
| `devcontainer.json` | Container definition: image, features, mounts |
| `.env` | Boolean flags controlling setup steps |

Config files deploy via `file-manifest.json` on every container start. Most deploy to `/workspaces/.claude/`; ccstatusline config deploys to `~/.config/ccstatusline/`. Each entry supports `overwrite`: `"if-changed"` (default, sha256), `"always"`, or `"never"`. Supported variables: `${CLAUDE_CONFIG_DIR}`, `${WORKSPACE_ROOT}`, `${HOME}`.

## Commands

| Command | Purpose |
|---------|---------|
| `cc` / `claude` | Run Claude Code with auto-configuration |
| `ccraw` | Vanilla Claude Code (bypasses config) |
| `ccw` | Claude Code with writing system prompt |
| `ccms` | Search session history (project-scoped) |
| `ccusage` / `ccburn` | Token usage analysis / burn rate |
| `agent-browser` | Headless Chromium (Playwright-based) |
| `check-setup` | Verify CodeForge setup health |
| `claude-dashboard` | Session analytics dashboard (port 7847) |
| `cc-tools` | List all installed tools with versions |

## Plugins

Declared in `settings.json` under `enabledPlugins`, auto-activated on start:

- **agent-system** — 17 custom agents + built-in agent redirection
- **skill-engine** — 21 general coding skills + auto-suggestion
- **spec-workflow** — 8 spec lifecycle skills + spec-reminder hook
- **session-context** — Git state injection, TODO harvesting, commit reminders
- **auto-code-quality** — Auto-format + auto-lint + advisory test runner
- **workspace-scope-guard** — Blocks writes outside working directory
- **dangerous-command-blocker** — Blocks destructive bash commands
- **protected-files-guard** — Blocks edits to secrets/lock files
- **codeforge-lsp** — LSP for Python + TypeScript/JavaScript
- **ticket-workflow** — EARS ticket workflow + auto-linking
- **notify-hook** — Desktop notifications on completion
- **frontend-design** (Anthropic official) — UI/frontend design skill

## Rules System

Rules in `config/defaults/rules/` deploy to `.claude/rules/` on every container start. They load into ALL sessions automatically.

**Current rules:** `spec-workflow.md`, `workspace-scope.md`, `session-search.md`

**Adding rules:** Create `.md` in `config/defaults/rules/`, add a manifest entry in `file-manifest.json`.

## Environment

| Variable | Value |
|----------|-------|
| `CLAUDE_CONFIG_DIR` | `/workspaces/.claude` |
| `ANTHROPIC_MODEL` | `claude-opus-4-6` |
| `WORKSPACE_ROOT` | `/workspaces` |

All experimental feature flags are in `settings.json` under `env`. Setup steps controlled by boolean flags in `.env`.

## Modifying Behavior

1. **Change model**: Edit `config/defaults/settings.json` → `"model"` field
2. **Change system prompt**: Edit `config/defaults/main-system-prompt.md`
3. **Add config file**: Add entry to `config/file-manifest.json`
4. **Add features**: Add to `"features"` in `devcontainer.json`
5. **Disable features**: Set `"version": "none"` in the feature's config
6. **Disable setup steps**: Set flags to `false` in `.env`
7. **Customize status bar**: Edit `config/defaults/ccstatusline-settings.json`

## Features

Custom features in `./features/` follow the [devcontainer feature spec](https://containers.dev/implementors/features/). Every local feature supports `"version": "none"` to skip installation. Claude Code is installed via `ghcr.io/anthropics/devcontainer-features/claude-code:1`.
