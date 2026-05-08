# DevContainer Development Guide

CodeForge devcontainer for AI-assisted development with Claude Code.

## Key Configuration

| File | Purpose |
|------|---------|
| `defaults/codeforge/claude/settings/base.json` | Shared Claude Code settings: permissions, plugins, env vars |
| `defaults/codeforge/claude/settings/profiles/*.json` | Model/context overlays (use `_meta: { model, contextWindow }` shorthand) used to generate deployed profiles |
| `.generated/codeforge/claude/settings/settings*.json` | Generated profiles deployed to `~/.claude/`; `settings.json` is a symlink to the default profile (`isDefault: true` in the generator) |
| `defaults/codeforge/claude/system-prompts/main.md` | System prompt defining assistant behavior |
| `defaults/codeforge/claude/system-prompts/orchestrator.md` | Orchestrator mode prompt (delegation-first) |
| `defaults/codeforge/claude/statusline/settings.json` | Status bar widget layout (deployed to ~/.config/ccstatusline/) |
| `defaults/codeforge/claude/disabled-hooks.json` | Disable individual plugin hooks by script name |
| `defaults/codeforge/claude/router/config.json` | LLM provider routing config (deployed to ~/.claude-code-router/) |
| `defaults/codeforge/file-manifest.json` | Controls which config files deploy and when |
| `devcontainer.json` | Container definition: features, compose config, mounts |
| `docker-compose.yml` | Base Docker Compose file: image, volumes, resource limits |
| `.codeforge/mounts.json` | User/auto-detected volume mount configuration |
| `.codeforge/container.json` | Setup flags, identity, timezone, version lock, plugin config |
| `.codeforge/secrets/` | Docker Compose secrets (one file per secret, gitignored) |

Config files deploy via `defaults/codeforge/file-manifest.json` on every container start. Most deploy to `~/.claude/`; ccstatusline config deploys to `~/.config/ccstatusline/`. Each entry supports `overwrite`: `"if-changed"` (default, sha256), `"always"`, or `"never"`. Supported variables: `${WORKSPACE_ROOT}`, `${CODEFORGE_DIR}`, `${HOME}`.

## Commands

| Command | Purpose |
|---------|---------|
| `cc` / `claude` / `cc6` | Run Claude Code with auto-configuration (opus-4-6, 200k context) |
| `codeforge config apply` | Deploy config files to `~/.claude/` (same as container start) |
| `ccraw` | Vanilla Claude Code (bypasses config) |
| `cc5` / `cc6` / `cc61` / `cc7` / `cc71` | Main prompt profiles for opus-4-5 200k, opus-4-6 200k, opus-4-6 1M bounded to 400k, opus-4-7 200k, opus-4-7 1M bounded to 400k |
| `ccw*` | Same profile matrix with the writing system prompt |
| `cc-orc*` | Same profile matrix in orchestrator mode, delegation-first |
| `codex` | OpenAI Codex CLI terminal coding agent |
| `rtk gain` | Show RTK token savings statistics for the session |
| `rtk discover` | List all commands RTK can compress |
| `rtk status` | Show RTK version and configuration |
| `hermes` | Nous Research Hermes Agent CLI (run `hermes setup` on first use) |
| `ccms` | Session history search _(disabled — requires Rust toolchain; uncomment in devcontainer.json to enable)_ |
| `codeforge proxy` | Launch Claude Code through mitmproxy — inspect API traffic in browser (port 8081) |
| `ccr start` / `ccr stop` | Claude Code Router daemon control |
| `ccr-apply` | Redeploy router config + restart daemon |
| `ccusage` / `ccburn` | Token usage analysis / burn rate |
| `karma-status` | Claude Code Karma dashboard process status and logs |
| `agent-browser` | Headless Chromium (Playwright-based) |
| `check-setup` | Verify CodeForge setup health |
| `codeforge doctor` | Environment health check (WSL, auth, caches, memory, volumes) |
| `codeforge doctor --fix` | Interactive fix mode — apply fixes for detected issues |
| `dbr` | Dynamic port forwarding ([devcontainer-bridge](https://github.com/bradleybeddoes/devcontainer-bridge)) |
| `cc-tools` | List all installed tools with versions |
| `claude-mem-worker` | Claude-Mem worker management (start/stop/status) |
| `ccdiag` | Session diagnostics: orphaned tool calls, errors, token usage, API proxy |
| `analyze-sessions` | Session quality metrics: thinking depth, Read:Edit ratio, frustration indicators |
| `lamarck skill <name>` | Skill analysis and improvement suggestions from session history |
| `sandcastle` | AI agent orchestration — parallel workflows, branch strategies, iteration loops |

## Plugins

Declared in `settings.json` under `enabledPlugins`, auto-activated on start:

### Active

- **agent-system** — 4 custom agents (architect, claude-guide, explorer, generalist) + built-in agent redirection + `/verify-tests` skill
- **skill-engine** — 2 coding knowledge packs (`/team`, `/agent-browser`) + auto-suggestion
- **auto-code-quality** — File tracking, syntax validation, `/cq` quality gate (format + lint + test on demand)
- **session-context** — Git state injection, TODO harvesting, commit reminders
- **workspace-scope-guard** — Blocks writes outside working directory
- **dangerous-command-blocker** — Blocks destructive bash commands
- **protected-files-guard** — Blocks edits to secrets/lock files
- **frontend-design** (Anthropic official) — UI/frontend design skill
- **code-review** (Anthropic official) — Code review skill
- **feature-dev** (Anthropic official) — Feature development skill
- **pr-review-toolkit** (Anthropic official) — PR review commands + agents

### Disabled

- **spec-workflow** — Spec lifecycle (archived, pending rewrite)
- **git-workflow** — Ship + PR review (archived, pending rewrite)
- **ticket-workflow** — EARS ticket workflow (archived, pending rewrite)
- **notify-hook** — Desktop notifications (archived, pending rewrite)
- **prompt-snippets** — Behavioral mode switches (archived, pending rewrite)
- **codeforge-lsp** — LSP servers (disabled)

## Rules System

Rules in `defaults/codeforge/claude/rules/` deploy to `.claude/rules/` on every container start. They load into ALL sessions automatically.

**Current rules:** `auto-memory.md`, `explicit-start.md`, `plan-presentation.md`, `rtk-awareness.md`, `scope-discipline.md`, `session-search.md`, `spec-workflow.md`, `surface-decisions.md`, `workspace-scope.md`, `zero-tolerance-bugs.md`

**Adding rules:** Create `.md` in `defaults/codeforge/claude/rules/`, add a manifest entry with a stable `id` in `defaults/codeforge/file-manifest.json`.

## Authentication & Persistence

The `~/.claude/` directory is backed by a Docker named volume (`codeforge-claude-config-${devcontainerId}`), persisting config, credentials, and session data across container rebuilds. Each devcontainer instance gets an isolated volume.

**Secrets** are stored as individual files in `.codeforge/secrets/` (gitignored). Each file contains the raw secret value. On host startup, `generate-compose.mjs` discovers these files and generates Docker Compose secret mounts at `/run/secrets/<name>`. The `setup-auth.sh` script reads secrets with a fallback chain: env var (Codespaces) → `/run/secrets/` (Docker Compose) → skip.

**Supported secrets:** `gh_token`, `npm_token`, `claude_code_oauth_token`, `openai_api_key`, `anthropic_api_key`, `deepseek_api_key`, `gemini_api_key`, `openrouter_api_key`.

**Claude Code auth:** Set `claude_code_oauth_token` (from `claude setup-token`) in `.codeforge/secrets/`. The token is exported as `CLAUDE_CODE_OAUTH_TOKEN` env var for Claude Code's native headless auth. **WARNING:** `CLAUDE_CODE_OAUTH_TOKEN` does not work when `ANTHROPIC_API_KEY` is also set.

**GitHub auth + identity:** Two options: (1) set `gh_token` in `.codeforge/secrets/` for fully automated auth, or (2) run `gh auth login` manually after container build — credentials persist via the `codeforge-gh-config` Docker named volume across rebuilds. On container start, `setup-auth.sh` detects either source, derives `user.name` and `user.email` from the GitHub API, and configures the git credential helper. The credential helper (`gh auth setup-git`) runs unconditionally on every start, so git operations work immediately after a manual `gh auth login`. Override identity via `.codeforge/container.json` `identity` section.

**Codex CLI:** Set `openai_api_key` in `.codeforge/secrets/`. Credentials (`~/.codex/`) are backed by a separate Docker named volume.

**Claude Code Router:** Set provider keys (`anthropic_api_key`, `deepseek_api_key`, `gemini_api_key`, `openrouter_api_key`) in `.codeforge/secrets/`. Keys are exported as env vars on container start and read at runtime by the router's `$ENV_VAR` interpolation in `~/.claude-code-router/config.json`. Edit routing rules in `defaults/codeforge/claude/router/config.json` or override `.codeforge/claude/router/config.json`, then run `ccr-apply` to redeploy.

**oh-my-claude:** The local `features/oh-my-claude` feature is opt-in. It installs the OMC CLI and generated agents, skips OMC hooks/MCP/statusline, and preserves CodeForge-managed `~/.claude/settings.json`. OMC proxy sessions are launched per session with `omc cc` or the `omc-cc` helper; do not add a post-start OMC daemon.

**Claude Code Karma:** The local `features/claude-code-karma` feature is default-on. It installs Karma from a pinned git ref, starts the UI on port `7847` and API on port `7848`, and patches Karma so its Settings API/UI are read-only. CodeForge owns generated `~/.claude/settings.json`; add Karma hooks in `defaults/codeforge/claude/settings/base.json`, not from Karma.

## Memory & Analysis Tools

### claude-mem — Persistent Memory System

Real-time observation capture with hybrid search (SQLite + Chroma vectors) and MCP tools. Replaces the previously-disabled `memory-awareness`, `context-memory`, and `post-tool` hooks.

**Architecture:** A background worker service (port 37777) receives hook events via HTTP POST and processes them asynchronously. The `claude-mem-hook` wrapper script is a thin HTTP proxy — it sends the payload and exits 0 immediately regardless of outcome (non-blocking).

**Hooks registered in `claude/settings/base.json`:**
- `SessionStart` → `claude-mem-hook context` (load relevant memories)
- `UserPromptSubmit` → `claude-mem-hook session-init` (initialize session tracking)
- `PreToolUse[Read]` → `claude-mem-hook file-context` (inject file-level memories)
- `PostToolUse[*]` → `claude-mem-hook observation` (capture observations)
- `Stop` → `claude-mem-hook summarize` (session summary + memory consolidation)

**MCP tools** (registered via poststart.d, available in Claude Code sessions):
- `search` — hybrid SQLite FTS + Chroma vector search
- `timeline` — chronological observation history
- `get_observations` — retrieve specific observations
- `smart_search` — context-aware search with relevance ranking

**Data:** `~/.claude-mem/` (settings, SQLite DB, Chroma vectors, logs)

**Management:** `claude-mem-worker start|stop|status`

**License:** AGPL-3.0 (development tool only, not distributed)

### lamarck — Skill Analysis

Analyzes Claude Code session history to extract learnings and skill patterns. Runs on a cron schedule (default: every 4 hours).

**Usage:**
- `lamarck skill <name> --mode suggest` — get improvement suggestions for a specific skill
- `lamarck --project /workspaces` — full session analysis (runs automatically via cron)

**Cron:** `0 */4 * * *` (configurable via `cronInterval` option in devcontainer.json)

**State:** `~/.lamarck/`, logs at `/tmp/lamarck.log`

### ccdiag — Session Diagnostics

Go CLI tool for diagnosing Claude Code session issues.

**Usage:**
- `ccdiag orphans` — find orphaned tool calls (started but never completed)
- `ccdiag errors` — analyze session errors and failure patterns
- `ccdiag tokens` — token usage breakdown per session/tool
- `ccdiag proxy` — launch API proxy on port 9119 for traffic inspection

### claude-session-analyzer — Quality Metrics

Python tool measuring session quality via multiple signals.

**Usage:**
- `analyze-sessions ~/.claude/projects/ --start 2026-01-01` — analyze sessions from a date
- `analyze-sessions ~/.claude/projects/ --format json` — JSON output for scripting

**Metrics:** thinking depth, Read:Edit ratio, tool call patterns, frustration indicators (repeated failures, context resets)

## Agent Orchestration

### sandcastle — Multi-Agent Workflows

TypeScript library/CLI for orchestrating AI coding agents in isolated environments. Handles workflow orchestration — branch strategies, prompt templating, iteration loops, completion detection, lifecycle hooks, and merging — while delegating execution to a pluggable sandbox provider.

**Usage:**
- `sandcastle init` — scaffold `.sandcastle/` workflow directory in a project
- `sandcastle run` — execute a workflow definition

**Target workflows:**
- Parallel agents on separate branches (fan-out decomposition)
- Implement → review → fix sequential pipelines
- Large plan decomposition → staged units → distribution → review loops → final reports

**Integration model:** Use a custom local-process provider that creates git worktrees as sandboxes and spawns Claude Code CLI as child processes. Agents inherit all `~/.claude/` config, workspace-scope-guard confinement, and environment variables from the parent process.

**Docs:** [github.com/mattpocock/sandcastle](https://github.com/mattpocock/sandcastle)

**Security:** Pinned to ≥0.5.4 (command injection CVE fix in earlier versions).

## Modifying Behavior

1. **Change shared Claude settings**: Edit `defaults/codeforge/claude/settings/base.json`, then run `node scripts/generate-settings-profiles.js`
   - **Add a new profile**: Create a `profiles/<name>.json` with `_meta: { model, contextWindow }` and any profile-specific fields, then add an entry to the `profiles` array in `scripts/generate-settings-profiles.js`. Set `isDefault: true` to make it the default `settings.json` symlink target.
   - **Change the default profile**: Set `isDefault: true` on the desired profile in the `profiles` array and remove it from the previous default, then regenerate.
2. **Change system prompt**: Edit `defaults/codeforge/claude/system-prompts/main.md`
3. **Add config file**: Place it under the relevant `defaults/codeforge/{claude,codex,rtk}/` area, add an entry with stable `id` to `defaults/codeforge/file-manifest.json`
4. **Add features**: Add to `"features"` in `devcontainer.json`
5. **Disable features**: Set `"version": "none"` in the feature's config
6. **Disable setup steps**: Set flags to `false` in `.codeforge/container.json` under `setup`
7. **Customize status bar**: Edit `defaults/codeforge/claude/statusline/settings.json`
8. **Lock Claude Code version**: Set `"versionLock": "2.1.80"` under `claude` in `.codeforge/container.json` — the update script installs that exact version on container start instead of updating to latest. Set to `null` to resume auto-updates.
9. **Disable individual hooks**: Add script name (without `.py`) to `disabled` array in `~/.claude/disabled-hooks.json` or override source `.codeforge/claude/disabled-hooks.json`
10. **Change container timezone**: Set `"timezone": "America/New_York"` (or any IANA timezone) in `.codeforge/container.json`. Default is `America/Chicago` (Central Time). Applied on container start.

## Plugin Development Notes

### `${CLAUDE_PLUGIN_DATA}` — Persistent Plugin Storage

Available since Claude Code v2.1.78. Resolves to a dedicated data directory per plugin that survives plugin updates (unlike `${CLAUDE_PLUGIN_ROOT}`, which points to the plugin's source directory).

**Current state:** Not used in CodeForge plugins. Plugins store transient state in `/tmp/{prefix}-{session_id}`.

**Future use:** When a plugin needs persistent state across sessions (cached configs, learned preferences, usage frequency), use `${CLAUDE_PLUGIN_DATA}` in hook commands instead of `/tmp/`.
