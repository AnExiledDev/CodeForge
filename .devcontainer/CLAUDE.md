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
│   │       └── main-system-prompt.md
│   ├── features/            # Custom devcontainer features
│   ├── plugins/             # Local plugin marketplace
│   │   └── devs-marketplace/
│   └── scripts/             # Setup scripts
├── .claude/                 # Runtime Claude config (created on first run)
│   ├── settings.json        # Active settings (managed by file-manifest.json)
│   ├── keybindings.json     # Active keybindings
│   └── system-prompt.md     # Active system prompt
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

> **Note**: Config file copying is controlled by `config/file-manifest.json`. Each entry specifies `overwrite`: `"if-changed"` (default, sha256-based), `"always"`, or `"never"`. Persistent changes go in `.devcontainer/config/defaults/settings.json`.

## Commands

| Command | Purpose |
|---------|---------|
| `claude` | Run Claude Code with auto-configuration (prefers native binary at `~/.local/bin/claude`) |
| `cc` | Shorthand for `claude` with config |
| `ccraw` | Vanilla Claude Code without any config (bypasses function override) |
| `ccusage` | Analyze token usage history |
| `ccburn` | Real-time token burn rate visualization |
| `agent-browser` | Headless Chromium for browser automation (Playwright-based) |
| `gh` | GitHub CLI for repo operations |
| `uv` | Fast Python package manager |
| `ast-grep` | Structural code search |
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
ast-grep, biome, ccstatusline, claude-monitor, dprint, hadolint, lsp-servers, mcp-qdrant, mcp-reasoner, notify-hook, ruff, shfmt, shellcheck, splitrail, tmux

**External features with `version: "none"` support:**
`ghcr.io/devcontainers/features/node`, `ghcr.io/devcontainers/features/github-cli`, `ghcr.io/devcontainers/features/docker-outside-of-docker`, `ghcr.io/devcontainers/features/go` (all official Microsoft features)

**External features without `version: "none"` support:**
`ghcr.io/devcontainers-extra/features/uv`, `ghcr.io/anthropics/devcontainer-features/claude-code`, `ghcr.io/nickmccurdy/bun`

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
| `setup-aliases.sh` | Creates `cc`/`claude`/`ccraw` shell aliases (prefers native binary at `~/.local/bin/claude` via `_CLAUDE_BIN`) |
| `setup-plugins.sh` | Registers local marketplace + installs official Anthropic plugins |
| `setup-update-claude.sh` | Installs native Claude Code binary on first run; background auto-updates on subsequent starts |
| `setup-terminal.sh` | Configures VS Code Shift+Enter keybinding for Claude Code multi-line input |
| `setup-projects.sh` | Auto-detects projects for VS Code Project Manager |
| `setup-symlink-claude.sh` | Symlinks ~/.claude for third-party tool compatibility |

### External Terminal

`connect-external-terminal.sh` connects to the running devcontainer from an external terminal with tmux support for Claude Code Agent Teams split-pane workflows. Run from the host:
```bash
.devcontainer/connect-external-terminal.sh
```

## Installed Plugins

Plugins are declared in `config/defaults/settings.json` under `enabledPlugins` and auto-activated on container start:

### Official (Anthropic)
- `frontend-design@claude-plugins-official` — UI/frontend design skill

### Local Marketplace (devs-marketplace)
- `codeforge-lsp@devs-marketplace` — LSP for Python + TypeScript/JavaScript
- `ticket-workflow@devs-marketplace` — EARS-based ticket workflow with GitHub integration
- `notify-hook@devs-marketplace` — Desktop notifications on completion
- `dangerous-command-blocker@devs-marketplace` — Blocks destructive bash commands
- `protected-files-guard@devs-marketplace` — Blocks edits to secrets/lock files
- `auto-formatter@devs-marketplace` — Batch-formats edited files at Stop (Ruff for Python, Biome for JS/TS/CSS/JSON/GraphQL/HTML; also supports shfmt, dprint, gofmt, rustfmt when installed)
- `auto-linter@devs-marketplace` — Auto-lints edited files at Stop (Pyright + Ruff for Python, Biome for JS/TS/CSS/GraphQL; also supports ShellCheck, hadolint, go vet, clippy when installed)
- `code-directive@devs-marketplace` — 17 custom agents, 17 skills, syntax validation, skill suggestions, agent redirect hook

### Local Marketplace

The `devs-marketplace` in `plugins/` provides locally-managed plugins:

```
plugins/devs-marketplace/
├── .claude-plugin/
│   └── marketplace.json      # Marketplace manifest
└── plugins/
    ├── codeforge-lsp/        # Combined LSP plugin
    ├── ticket-workflow/      # EARS ticket workflow
    ├── auto-formatter/       # Batch formatter (Stop hook)
    ├── auto-linter/          # Pyright linter
    ├── code-directive/       # Agents, skills + hooks
    └── ...
```

## Agents & Skills

The `code-directive` plugin includes 17 custom agent definitions and 17 coding reference skills.

**Agents** (`plugins/devs-marketplace/plugins/code-directive/agents/`):
architect, bash-exec, claude-guide, debug-logs, dependency-analyst, doc-writer, explorer, generalist, git-archaeologist, migrator, perf-profiler, refactorer, researcher, security-auditor, spec-writer, statusline-config, test-writer

The `redirect-builtin-agents.py` hook (PreToolUse/Task) transparently swaps built-in agent types to these custom agents (e.g., Explore→explorer, Plan→architect).

**Skills** (`plugins/devs-marketplace/plugins/code-directive/skills/`):
claude-agent-sdk, claude-code-headless, debugging, docker, docker-py, fastapi, git-forensics, performance-profiling, pydantic-ai, refactoring-patterns, security-checklist, skill-building, spec-refine, specification-writing, sqlite, svelte5, testing

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

## Modifying Behavior

1. **Change default model**: Edit `config/defaults/settings.json`, update `"model"` field
2. **Change system prompt**: Edit `config/defaults/main-system-prompt.md`
3. **Change keybindings**: Edit `config/defaults/keybindings.json`
4. **Add a custom config file**: Add an entry to `config/file-manifest.json` with `src`, `dest`, and optional `overwrite`/`destFilename`
5. **Add features**: Add to `"features"` in `devcontainer.json`
6. **Disable auto-setup**: Set variables to `false` in `.env`
