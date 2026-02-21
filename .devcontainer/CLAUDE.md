# DevContainer Development Guide

CodeForge devcontainer for AI-assisted development with Claude Code.

## Directory Structure

```
/workspaces/
├── .devcontainer/           # Container configuration (this directory)
│   ├── devcontainer.json    # Main container definition
│   ├── .env                 # Environment variables
│   ├── config/              # Default configurations
│   │   ├── file-manifest.json # Declarative file-copy manifest
│   │   └── defaults/        # Files copied per manifest
│   │       ├── settings.json    # Claude Code settings
│   │       ├── keybindings.json # Claude Code keybindings
│   │       ├── main-system-prompt.md
│   │       └── writing-system-prompt.md
│   ├── features/            # Custom devcontainer features
│   ├── plugins/             # Local plugin marketplace
│   │   └── devs-marketplace/
│   └── scripts/             # Setup scripts
├── .claude/                 # Runtime Claude config (created on first run)
│   ├── settings.json        # Active settings (managed by file-manifest.json)
│   ├── keybindings.json     # Active keybindings
│   └── main-system-prompt.md # Active system prompt
└── .gh/                     # GitHub CLI config (persists across rebuilds)
    └── hosts.yml            # Authenticated hosts
```

## Key Configuration Files

| File | Purpose |
|------|---------|
| `devcontainer.json` | Container definition: base image, features, mounts, environment |
| `.env` | Environment variables controlling setup behavior |
| `config/file-manifest.json` | Declarative manifest controlling which config files are copied and how |
| `config/defaults/settings.json` | Claude Code defaults: model, tokens, permissions, plugins |
| `config/defaults/keybindings.json` | Claude Code keybindings (empty by default — customizable) |
| `config/defaults/main-system-prompt.md` | Default system prompt defining assistant behavior |
| `config/defaults/writing-system-prompt.md` | Creative-writing system prompt used by `ccw` alias |

> **Note**: Config file copying is controlled by `config/file-manifest.json`. Each entry specifies `overwrite`: `"if-changed"` (default, sha256-based), `"always"`, or `"never"`. Persistent changes go in `.devcontainer/config/defaults/settings.json`.

## Commands

| Command | Purpose |
|---------|---------|
| `claude` | Run Claude Code with auto-configuration (prefers native binary at `~/.local/bin/claude`) |
| `cc` | Shorthand for `claude` with config |
| `ccraw` | Vanilla Claude Code without any config (bypasses function override) |
| `ccw` | Claude Code with the writing system prompt — uses `writing-system-prompt.md` instead of `main-system-prompt.md`, optimized for creative and technical writing tasks |
| `ccusage` | Analyze token usage history |
| `ccburn` | Real-time token burn rate visualization |
| `agent-browser` | Headless Chromium for browser automation (Playwright-based) |
| `gh` | GitHub CLI for repo operations |
| `uv` | Fast Python package manager |
| `ast-grep` | Structural code search |
| `ccms` | Search Claude Code session history (project-scoped) |
| `cc-tools` | List all installed tools with version info |
| `check-setup` | Verify CodeForge setup health |

## Feature Development

Custom features live in `./features/`. Each feature follows the [devcontainer feature spec](https://containers.dev/implementors/features/):

```
features/
└── my-feature/
    ├── devcontainer-feature.json   # Metadata and options
    ├── install.sh                  # Installation script
    └── README.md                   # Documentation
```

To test a feature locally, reference it in `devcontainer.json`:
```json
"features": {
  "./features/my-feature": {}
}
```

> **Note**: Claude Code is installed via `ghcr.io/anthropics/devcontainer-features/claude-code:1` (Anthropic's official feature).

### Disabling Features with `version: "none"`

Every local feature supports `"version": "none"` to skip installation entirely. This is useful for trimming build time or disabling tools you don't need without removing them from `devcontainer.json`.

```json
"features": {
  "./features/ruff": { "version": "none" },
  "./features/biome": {},
  "./features/hadolint": { "version": "none" }
}
```

When `version` is set to `"none"`, the feature's `install.sh` exits immediately with a skip message. The feature entry stays in `devcontainer.json` so re-enabling is a one-word change.

**Currently disabled features** (not needed for Python/JS/TS workflow):

| Feature | Handles | Reason |
|---------|---------|--------|
| `shfmt` | Shell formatting | Not needed — Python/JS/TS only |
| `shellcheck` | Shell linting | Not needed — Python/JS/TS only |
| `hadolint` | Dockerfile linting | Not needed — Python/JS/TS only |
| `dprint` | Markdown/YAML/TOML/Dockerfile formatting | Not needed — Python/JS/TS only |

The auto-formatter and auto-linter plugins gracefully skip missing tools at runtime.

**All local features support this pattern:**
ast-grep, biome, ccms, ccstatusline, claude-monitor, dprint, hadolint, lsp-servers, mcp-qdrant, mcp-reasoner, notify-hook, ruff, shfmt, shellcheck, splitrail, tmux

**External features with `version: "none"` support:**
`ghcr.io/devcontainers/features/node`, `ghcr.io/devcontainers/features/github-cli`, `ghcr.io/devcontainers/features/docker-outside-of-docker`, `ghcr.io/devcontainers/features/go` (all official Microsoft features)

**External features without `version: "none"` support:**
`ghcr.io/devcontainers-extra/features/uv`, `ghcr.io/anthropics/devcontainer-features/claude-code`, `ghcr.io/rails/devcontainer/features/bun`

**External features with `version: "none"` support (Rust):**
`ghcr.io/devcontainers/features/rust` (official Microsoft feature)

> **Convention**: Every new local feature must include a `version` option (default `"latest"`) in its `devcontainer-feature.json` and a skip guard at the top of `install.sh`:
> ```bash
> if [ "${VERSION}" = "none" ]; then
>     echo "[feature-name] Skipping installation (version=none)"
>     exit 0
> fi
> ```

## Setup Scripts

Scripts in `./scripts/` run via `postStartCommand`:

| Script | Purpose |
|--------|---------|
| `setup.sh` | Main orchestrator |
| `setup-config.sh` | Copies config files per `config/file-manifest.json` to destinations |
| `setup-aliases.sh` | Creates `cc`/`claude`/`ccraw`/`ccw` shell aliases (prefers native binary at `~/.local/bin/claude` via `_CLAUDE_BIN`) |
| `setup-plugins.sh` | Registers local marketplace + installs official Anthropic plugins |
| `setup-update-claude.sh` | Installs native Claude Code binary on first run; background auto-updates on subsequent starts |
| `setup-terminal.sh` | Configures VS Code Shift+Enter keybinding for Claude Code multi-line input |
| `setup-projects.sh` | Auto-detects projects for VS Code Project Manager |
| `setup-auth.sh` | Configures Git and NPM auth from `.secrets` file or environment variables |
| `check-setup.sh` | Verifies CodeForge setup health (binary paths, config files, features) |
| `setup-symlink-claude.sh` | Symlinks ~/.claude for third-party tool compatibility |

### External Terminal

`connect-external-terminal.sh` connects to the running devcontainer from an external terminal with tmux support for Claude Code Agent Teams split-pane workflows. Run from the host:
```bash
.devcontainer/connect-external-terminal.sh
```

On Windows, use `connect-external-terminal.ps1` (PowerShell equivalent).

## Installed Plugins

Plugins are declared in `config/defaults/settings.json` under `enabledPlugins` and auto-activated on container start:

### Official (Anthropic)
- `frontend-design@claude-plugins-official` — UI/frontend design skill

### Local Marketplace (devs-marketplace)
- `codeforge-lsp@devs-marketplace` — LSP for Python + TypeScript/JavaScript
- `ticket-workflow@devs-marketplace` — EARS-based ticket workflow with GitHub integration and auto-linking hook
- `notify-hook@devs-marketplace` — Desktop notifications on completion
- `dangerous-command-blocker@devs-marketplace` — Blocks destructive bash commands
- `protected-files-guard@devs-marketplace` — Blocks edits to secrets/lock files
- `agent-system@devs-marketplace` — 17 custom agents with built-in agent redirection, CWD injection, and read-only bash enforcement
- `skill-engine@devs-marketplace` — 21 coding skills with auto-suggestion hook
- `spec-workflow@devs-marketplace` — 8 spec lifecycle skills with spec-reminder hook
- `session-context@devs-marketplace` — Session boundary hooks (git state injection, TODO harvesting, commit reminders)
- `auto-code-quality@devs-marketplace` — Combined auto-format + auto-lint + advisory test runner
- `workspace-scope-guard@devs-marketplace` — Blocks writes and warns on reads outside the working directory

### Local Marketplace

The `devs-marketplace` in `plugins/` provides locally-managed plugins:

```
plugins/devs-marketplace/
├── .claude-plugin/
│   └── marketplace.json      # Marketplace manifest
└── plugins/
    ├── codeforge-lsp/        # Combined LSP plugin
    ├── ticket-workflow/      # EARS ticket workflow + auto-linking hook
    ├── agent-system/         # 17 custom agents + redirection
    ├── skill-engine/         # 21 coding skills + auto-suggestion
    ├── spec-workflow/        # 8 spec lifecycle skills
    ├── session-context/      # Session boundary hooks
    ├── auto-code-quality/    # Combined format + lint + test runner
    ├── workspace-scope-guard/ # Workspace scope enforcement
    └── ...
```

## Agents & Skills

Agents and skills are distributed across focused plugins:

**Agents** (`plugins/devs-marketplace/plugins/agent-system/agents/`):
architect, bash-exec, claude-guide, debug-logs, dependency-analyst, doc-writer, explorer, generalist, git-archaeologist, migrator, perf-profiler, refactorer, researcher, security-auditor, spec-writer, statusline-config, test-writer

The `redirect-builtin-agents.py` hook (PreToolUse/Task) transparently swaps built-in agent types to these custom agents (e.g., Explore→explorer, Plan→architect).

**General Skills** (`plugins/devs-marketplace/plugins/skill-engine/skills/`):
api-design, ast-grep-patterns, claude-agent-sdk, claude-code-headless, debugging, dependency-management, docker, docker-py, documentation-patterns, fastapi, git-forensics, migration-patterns, performance-profiling, pydantic-ai, refactoring-patterns, security-checklist, skill-building, sqlite, svelte5, team, testing

**Spec Skills** (`plugins/devs-marketplace/plugins/spec-workflow/skills/`):
spec-build, spec-check, spec-init, spec-new, spec-refine, spec-review, spec-update, specification-writing

## VS Code Keybinding Conflicts

Claude Code runs inside VS Code's integrated terminal. VS Code intercepts some shortcuts before they reach the terminal:

| Shortcut | VS Code Action | Claude Code Action |
|----------|---------------|-------------------|
| `Ctrl+G` | Go to Line | `chat:externalEditor` |
| `Ctrl+S` | Save File | `chat:stash` |
| `Ctrl+T` | Open Symbol | `app:toggleTodos` |
| `Ctrl+O` | Open File | `app:toggleTranscript` |
| `Ctrl+B` | Toggle Sidebar | `task:background` |
| `Ctrl+P` | Quick Open | `chat:modelPicker` |
| `Ctrl+R` | Open Recent | `history:search` |

`Ctrl+P` and `Ctrl+F` are configured to pass through to the terminal via `terminal.integrated.commandsToSkipShell` in `devcontainer.json`. For other conflicts, use Meta (Alt) variants or customize via `config/defaults/keybindings.json`.

## Environment Variables

Key environment variables set in the container:

| Variable | Value |
|----------|-------|
| `WORKSPACE_ROOT` | `/workspaces` |
| `CLAUDE_CONFIG_DIR` | `/workspaces/.claude` |
| `GH_CONFIG_DIR` | `/workspaces/.gh` |
| `ANTHROPIC_MODEL` | `claude-opus-4-6` |
| `TMPDIR` | `/workspaces/.tmp` |
| `CLAUDECODE` | `null` (unset) |

Setting `"CLAUDECODE": null` in `remoteEnv` unsets this variable inside the container, which allows nested Claude Code sessions (claude-in-claude) that would otherwise be blocked by the outer session's detection flag.

All setup steps are controlled by boolean flags in `.devcontainer/.env`. Set any to `false` to disable:
`SETUP_CONFIG`, `SETUP_ALIASES`, `SETUP_AUTH`, `SETUP_PLUGINS`, `SETUP_UPDATE_CLAUDE`, `SETUP_TERMINAL`, `SETUP_PROJECTS`, `SETUP_POSTSTART`.

### Experimental Environment Variables

These are set in `config/defaults/settings.json` under `env` and control Claude Code experimental features:

| Variable | Value | Description |
|----------|-------|-------------|
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | `1` | Enables Agent Teams (multi-agent orchestration) |
| `CLAUDE_CODE_EFFORT_LEVEL` | `high` | Sets reasoning effort level |
| `CLAUDE_CODE_ENABLE_TASKS` | `true` | Enables the task/todo system |
| `CLAUDE_CODE_PLAN_MODE_INTERVIEW_PHASE` | `true` | Enables interview phase before plan execution |
| `CLAUDE_CODE_PLAN_V2_AGENT_COUNT` | `3` | Number of agents in Plan V2 orchestration |
| `CLAUDE_CODE_PLAN_MODE_REQUIRED` | `true` | Forces plan mode for teammate agents |
| `ENABLE_CLAUDE_CODE_SM_COMPACT` | `1` | Enables smart compaction for context management |
| `CLAUDE_CODE_FORCE_GLOBAL_CACHE` | `1` | Forces global prompt caching |
| `FORCE_AUTOUPDATE_PLUGINS` | `1` | Auto-updates plugins on every session start |

## Git Worktrees

CodeForge supports git worktrees for working on multiple branches simultaneously.

### Layout

Worktrees live in a `.worktrees/` directory alongside the main repo:

```
/workspaces/projects/
├── CodeForge/           # main repo (.git directory)
└── .worktrees/          # worktree container
    ├── feature-a/       # worktree checkout (.git file)
    └── bugfix-b/        # worktree checkout (.git file)
```

### Creating Compatible Worktrees

```bash
cd /workspaces/projects/CodeForge
mkdir -p /workspaces/projects/.worktrees
git worktree add /workspaces/projects/.worktrees/my-branch my-branch
```

### Project Detection

- `setup-projects.sh` scans `.worktrees/` directories at depth 3 (inside container dirs like `projects/`)
- Worktrees are detected by their `.git` file (containing `gitdir:`) and tagged with both `"git"` and `"worktree"` in Project Manager
- Each worktree appears as an independent project in VS Code Project Manager

### Compatibility

- `workspace-scope-guard` resolves worktree paths correctly via `os.path.realpath()`
- `protected-files-guard` protects both `.git/` directories and `.git` files (worktree pointers)
- Read-only agents (e.g., git-archaeologist) can use `git worktree list` but cannot add/remove worktrees

## Modifying Behavior

1. **Change default model**: Edit `config/defaults/settings.json`, update `"model"` field
2. **Change system prompt**: Edit `config/defaults/main-system-prompt.md`
3. **Change keybindings**: Edit `config/defaults/keybindings.json`
4. **Add a custom config file**: Add an entry to `config/file-manifest.json` with `src`, `dest`, and optional `overwrite`/`destFilename`
5. **Add features**: Add to `"features"` in `devcontainer.json`
6. **Disable auto-setup**: Set variables to `false` in `.env`

## Rules System

Rules live in `config/defaults/rules/` and are copied to `.claude/rules/` by the file manifest (`config/file-manifest.json`) on every container start. Unlike CLAUDE.md (which loads on demand when entering a project), rules load automatically on every Claude Code session.

**Current rules**: `spec-workflow.md`, `workspace-scope.md`, `session-search.md`

**Adding custom rules**: Create a `.md` file in `config/defaults/rules/`, then add a manifest entry in `config/file-manifest.json` pointing to `${CLAUDE_CONFIG_DIR}/rules` as the destination. The rule will be deployed on the next container start.
