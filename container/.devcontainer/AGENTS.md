# DevContainer Development Guide

CodeForge devcontainer for AI-assisted development with Claude Code.

## Key Configuration

| File | Purpose |
|------|---------|
| `defaults/codeforge/config/settings.json` | Model, tokens, permissions, plugins, env vars |
| `defaults/codeforge/config/main-system-prompt.md` | System prompt defining assistant behavior |
| `defaults/codeforge/config/orchestrator-system-prompt.md` | Orchestrator mode prompt (delegation-first) |
| `defaults/codeforge/config/ccstatusline-settings.json` | Status bar widget layout (deployed to ~/.config/ccstatusline/) |
| `defaults/codeforge/config/disabled-hooks.json` | Disable individual plugin hooks by script name |
| `defaults/codeforge/config/claude-code-router.json` | LLM provider routing config (deployed to ~/.claude-code-router/) |
| `defaults/codeforge/file-manifest.json` | Controls which config files deploy and when |
| `devcontainer.json` | Container definition: image, features, mounts |
| `.env` | Boolean flags controlling setup steps |

Config files deploy via `defaults/codeforge/file-manifest.json` on every container start. Most deploy to `~/.claude/`; ccstatusline config deploys to `~/.config/ccstatusline/`. Each entry supports `overwrite`: `"if-changed"` (default, sha256), `"always"`, or `"never"`. Supported variables: `${CLAUDE_CONFIG_DIR}`, `${WORKSPACE_ROOT}`, `${HOME}`.

## Commands

| Command | Purpose |
|---------|---------|
| `cc` / `claude` | Run Claude Code with auto-configuration (opus-4-5, 200k context) |
| `codeforge config apply` | Deploy config files to `~/.claude/` (same as container start) |
| `ccraw` | Vanilla Claude Code (bypasses config) |
| `ccw` | Claude Code with writing system prompt (opus-4-5, 200k context) |
| `cc-orc` | Claude Code in orchestrator mode, delegation-first (opus-4-5, 200k context) |
| `cc7` / `ccw7` / `cc-orc7` | Claude Code on opus-4-7 with 400k context (main / writing / orchestrator modes) |
| `codex` | OpenAI Codex CLI terminal coding agent |
| `ccms` | Session history search _(disabled — requires Rust toolchain; uncomment in devcontainer.json to enable)_ |
| `codeforge proxy` | Launch Claude Code through mitmproxy — inspect API traffic in browser (port 8081) |
| `ccr start` / `ccr stop` | Claude Code Router daemon control |
| `ccr-apply` | Redeploy router config + restart daemon |
| `ccusage` / `ccburn` | Token usage analysis / burn rate |
| `agent-browser` | Headless Chromium (Playwright-based) |
| `check-setup` | Verify CodeForge setup health |
| `dbr` | Dynamic port forwarding ([devcontainer-bridge](https://github.com/bradleybeddoes/devcontainer-bridge)) |
| `cc-tools` | List all installed tools with versions |

## Plugins

Declared in `settings.json` under `enabledPlugins`, auto-activated on start:

- **agent-system** — 19 custom agents + built-in agent redirection
- **skill-engine** — 23 general coding skills + auto-suggestion
- **spec-workflow** — 3 spec lifecycle skills (`/spec`, `/build`, `/specs`) + spec-reminder hook
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

Rules in `defaults/codeforge/config/rules/` deploy to `.claude/rules/` on every container start. They load into ALL sessions automatically.

**Current rules:** `auto-memory.md`, `explicit-start.md`, `plan-presentation.md`, `scope-discipline.md`, `session-search.md`, `spec-workflow.md`, `surface-decisions.md`, `workspace-scope.md`, `zero-tolerance-bugs.md`

**Adding rules:** Create `.md` in `defaults/codeforge/config/rules/`, add a manifest entry in `defaults/codeforge/file-manifest.json`.

## Authentication & Persistence

The `~/.claude/` directory is backed by a Docker named volume (`codeforge-claude-config-${devcontainerId}`), persisting config, credentials, and session data across container rebuilds. Each devcontainer instance gets an isolated volume.

**Token authentication:** Set `CLAUDE_AUTH_TOKEN` in `.devcontainer/.secrets` (or as a Codespaces secret) with a long-lived token from `claude setup-token`. On container start, `setup-auth.sh` auto-creates `~/.claude/.credentials.json` with `600` permissions. If `.credentials.json` already exists, token injection is skipped (idempotent). Tokens must match `sk-ant-*` format.

Codex CLI credentials (`~/.codex/`) are backed by a separate Docker named volume (`codeforge-codex-config-${devcontainerId}`). Set `OPENAI_API_KEY` in `.devcontainer/.secrets` (or as a Codespaces secret) for automatic API key injection, or run `codex` interactively for browser-based ChatGPT OAuth.

**Claude Code Router:** Set provider API keys (`ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`) in `.devcontainer/.secrets`. Keys are exported as env vars on container start and read at runtime by the router's `$ENV_VAR` interpolation in `~/.claude-code-router/config.json`. Edit routing rules in `defaults/codeforge/config/claude-code-router.json` and run `ccr-apply` to redeploy.

## Modifying Behavior

1. **Change model**: Edit `defaults/codeforge/config/settings.json` → `"model"` field
2. **Change system prompt**: Edit `defaults/codeforge/config/main-system-prompt.md`
3. **Add config file**: Place in `defaults/codeforge/config/`, add entry to `defaults/codeforge/file-manifest.json`
4. **Add features**: Add to `"features"` in `devcontainer.json`
5. **Disable features**: Set `"version": "none"` in the feature's config
6. **Disable setup steps**: Set flags to `false` in `.env`
7. **Customize status bar**: Edit `defaults/codeforge/config/ccstatusline-settings.json`
8. **Lock Claude Code version**: Set `CLAUDE_VERSION_LOCK=2.1.80` in `.env` — the update script installs that exact version on container start instead of updating to latest. Unset to resume auto-updates.
9. **Disable individual hooks**: Add script name (without `.py`) to `disabled` array in `defaults/codeforge/config/disabled-hooks.json` — takes effect immediately, no restart needed

## Plugin Development Notes

### `${CLAUDE_PLUGIN_DATA}` — Persistent Plugin Storage

Available since Claude Code v2.1.78. Resolves to a dedicated data directory per plugin that survives plugin updates (unlike `${CLAUDE_PLUGIN_ROOT}`, which points to the plugin's source directory).

**Current state:** Not used in CodeForge plugins. Plugins store transient state in `/tmp/{prefix}-{session_id}`.

**Future use:** When a plugin needs persistent state across sessions (cached configs, learned preferences, usage frequency), use `${CLAUDE_PLUGIN_DATA}` in hook commands instead of `/tmp/`.
