# DevContainer Development Guide

CodeForge devcontainer for AI-assisted development with Claude Code.

## Key Configuration

| File | Purpose |
|------|---------|
| `.codeforge/config/settings.json` | Model, tokens, permissions, plugins, env vars |
| `.codeforge/config/main-system-prompt.md` | System prompt defining assistant behavior |
| `.codeforge/config/orchestrator-system-prompt.md` | Orchestrator mode prompt (delegation-first) |
| `.codeforge/config/ccstatusline-settings.json` | Status bar widget layout (deployed to ~/.config/ccstatusline/) |
| `.codeforge/file-manifest.json` | Controls which config files deploy and when |
| `devcontainer.json` | Container definition: image, features, mounts |
| `.env` | Boolean flags controlling setup steps |

Config files deploy via `.codeforge/file-manifest.json` on every container start. Most deploy to `~/.claude/`; ccstatusline config deploys to `~/.config/ccstatusline/`. Each entry supports `overwrite`: `"if-changed"` (default, sha256), `"always"`, or `"never"`. Supported variables: `${CLAUDE_CONFIG_DIR}`, `${WORKSPACE_ROOT}`, `${HOME}`.

## Commands

| Command | Purpose |
|---------|---------|
| `cc` / `claude` | Run Claude Code with auto-configuration |
| `codeforge config apply` | Deploy config files to `~/.claude/` (same as container start) |
| `ccraw` | Vanilla Claude Code (bypasses config) |
| `ccw` | Claude Code with writing system prompt |
| `cc-orc` | Claude Code in orchestrator mode (delegation-first) |
| `ccms` | Session history search _(disabled — requires Rust toolchain; uncomment in devcontainer.json to enable)_ |
| `ccusage` / `ccburn` | Token usage analysis / burn rate |
| `agent-browser` | Headless Chromium (Playwright-based) |
| `check-setup` | Verify CodeForge setup health |
| `claude-dashboard` | Session analytics dashboard (port 7847) |
| `dbr` | Dynamic port forwarding ([devcontainer-bridge](https://github.com/bradleybeddoes/devcontainer-bridge)) |
| `cc-tools` | List all installed tools with versions |

## Plugins

Declared in `settings.json` under `enabledPlugins`, auto-activated on start:

- **agent-system** — 21 custom agents (4 workhorse + 17 specialist) + built-in agent redirection
- **skill-engine** — 22 general coding skills + auto-suggestion
- **spec-workflow** — 8 spec lifecycle skills + spec-reminder hook
- **session-context** — Git state injection, TODO harvesting, commit reminders
- **auto-code-quality** — Auto-format + auto-lint + advisory test runner
- **workspace-scope-guard** — Blocks writes outside working directory
- **dangerous-command-blocker** — Blocks destructive bash commands
- **protected-files-guard** — Blocks edits to secrets/lock files
- **codeforge-lsp** — LSP for Python + TypeScript/JavaScript
- **ticket-workflow** — EARS ticket workflow + auto-linking
- **git-workflow** — Standalone ship (commit/push/PR) + PR review
- **notify-hook** — Desktop notifications on completion
- **frontend-design** (Anthropic official) — UI/frontend design skill
- **code-review** (Anthropic official) — Code review skill
- **feature-dev** (Anthropic official) — Feature development skill
- **pr-review-toolkit** (Anthropic official) — PR review commands + agents
- **prompt-snippets** — Quick behavioral mode switches via /ps command

## Rules System

Rules in `.codeforge/config/rules/` deploy to `.claude/rules/` on every container start. They load into ALL sessions automatically.

**Current rules:** `spec-workflow.md`, `workspace-scope.md`, `session-search.md`

**Adding rules:** Create `.md` in `.codeforge/config/rules/`, add a manifest entry in `.codeforge/file-manifest.json`.

## Authentication & Persistence

The `~/.claude/` directory is backed by a Docker named volume (`codeforge-claude-config-${devcontainerId}`), persisting config, credentials, and session data across container rebuilds. Each devcontainer instance gets an isolated volume.

**Token authentication:** Set `CLAUDE_AUTH_TOKEN` in `.devcontainer/.secrets` (or as a Codespaces secret) with a long-lived token from `claude setup-token`. On container start, `setup-auth.sh` auto-creates `~/.claude/.credentials.json` with `600` permissions. If `.credentials.json` already exists, token injection is skipped (idempotent). Tokens must match `sk-ant-*` format.

## Modifying Behavior

1. **Change model**: Edit `.codeforge/config/settings.json` → `"model"` field
2. **Change system prompt**: Edit `.codeforge/config/main-system-prompt.md`
3. **Add config file**: Place in `.codeforge/config/`, add entry to `.codeforge/file-manifest.json`
4. **Add features**: Add to `"features"` in `devcontainer.json`
5. **Disable features**: Set `"version": "none"` in the feature's config
6. **Disable setup steps**: Set flags to `false` in `.env`
7. **Customize status bar**: Edit `.codeforge/config/ccstatusline-settings.json`
