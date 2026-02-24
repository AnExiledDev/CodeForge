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

Config files deploy via `file-manifest.json` on every container start. Most deploy to `~/.claude/`; ccstatusline config deploys to `~/.config/ccstatusline/`. Each entry supports `overwrite`: `"if-changed"` (default, sha256), `"always"`, or `"never"`. Supported variables: `${CLAUDE_CONFIG_DIR}`, `${WORKSPACE_ROOT}`, `${HOME}`.

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
| `CLAUDE_CONFIG_DIR` | `/home/vscode/.claude` |
| `CLAUDE_AUTH_TOKEN` | Long-lived token from `claude setup-token` (optional, via `.secrets` or Codespaces secrets) |
| `ANTHROPIC_MODEL` | `claude-opus-4-6` |
| `WORKSPACE_ROOT` | `/workspaces` |
| `TERM` | `${localEnv:TERM:xterm-256color}` (via `remoteEnv` — forwards host TERM, falls back to 256-color) |
| `COLORTERM` | `truecolor` (via `remoteEnv` — enables 24-bit color support) |

All experimental feature flags are in `settings.json` under `env`. Setup steps controlled by boolean flags in `.env`.

## Authentication & Persistence

The `~/.claude/` directory is backed by a Docker named volume (`codeforge-claude-config-${devcontainerId}`), persisting config, credentials, and session data across container rebuilds. Each devcontainer instance gets an isolated volume.

**Token authentication:** Set `CLAUDE_AUTH_TOKEN` in `.devcontainer/.secrets` (or as a Codespaces secret) with a long-lived token from `claude setup-token`. On container start, `setup-auth.sh` auto-creates `~/.claude/.credentials.json` with `600` permissions. If `.credentials.json` already exists, token injection is skipped (idempotent). Tokens must match `sk-ant-*` format.

## Modifying Behavior

1. **Change model**: Edit `config/defaults/settings.json` → `"model"` field
2. **Change system prompt**: Edit `config/defaults/main-system-prompt.md`
3. **Add config file**: Add entry to `config/file-manifest.json`
4. **Add features**: Add to `"features"` in `devcontainer.json`
5. **Disable features**: Set `"version": "none"` in the feature's config
6. **Disable setup steps**: Set flags to `false` in `.env`
7. **Customize status bar**: Edit `config/defaults/ccstatusline-settings.json` (see below)

## Status Bar Widgets

The status bar is configured in `config/defaults/ccstatusline-settings.json` (deploys to `~/.config/ccstatusline/settings.json`). Each widget is a JSON object in a line array.

### Widget Properties

| Property | Purpose |
|----------|---------|
| `id` | Unique identifier (UUID or descriptive string) |
| `type` | Widget type (see below) |
| `backgroundColor` | Background color: `bgBlue`, `bgMagenta`, `bgYellow`, `bgGreen`, `bgRed`, etc. |
| `color` | Text color: `brightWhite`, `black`, `cyan`, `yellow`, etc. |
| `rawValue` | `true` to strip type-specific prefixes (e.g., removes "Model:" from model widget) |
| `bold` | `true` for bold text |
| `merge` | `"no-padding"` fuses this widget to the next (no separator/space between them) |
| `customText` | Static text content (only for `custom-text` type) |

### Token Widgets

Each token metric uses a distinct background color for at-a-glance identification:

| Type | Color | Label |
|------|-------|-------|
| `tokens-input` | Blue (`bgBlue`) | **In** |
| `tokens-output` | Magenta (`bgMagenta`) | **Ou** |
| `tokens-cached` | Yellow (`bgYellow`) | **Ca** |
| `tokens-total` | Green (`bgGreen`) | **Tt** |

Labels are `custom-text` widgets with `merge: "no-padding"` so they fuse visually to their data widget:

```json
{ "id": "lbl-tokens-input", "type": "custom-text", "customText": "In",
  "backgroundColor": "bgBlue", "color": "brightWhite", "bold": true, "merge": "no-padding" },
{ "id": "5", "type": "tokens-input",
  "backgroundColor": "bgBlue", "color": "brightWhite", "rawValue": true }
```

### Other Widget Types

`model`, `context-length`, `context-percentage-usable`, `git-branch`, `git-changes`, `git-worktree`, `session-clock`, `session-cost`, `block-timer`, `version`, `custom-command`

## Features

Custom features in `./features/` follow the [devcontainer feature spec](https://containers.dev/implementors/features/). Every local feature supports `"version": "none"` to skip installation. Claude Code is installed via `ghcr.io/anthropics/devcontainer-features/claude-code:1`.
