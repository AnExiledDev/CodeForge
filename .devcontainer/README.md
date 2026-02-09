# CodeForge Usage Guide

Everything you need to know once you're inside the devcontainer.

## Quick Start

1. **Authenticate** (first time only)
   ```bash
   claude
   ```
   Follow the prompts to authenticate via browser or API key.

2. **Start Claude Code**
   ```bash
   cc
   ```

## Claude Code Authentication

Claude Code supports multiple authentication methods. On first run, you'll be prompted to choose:

### Browser Login (Recommended)

```bash
claude
```

Select "Login with browser" and complete authentication in your browser. This uses your Claude.ai account.

### API Key

For programmatic access or environments without browsers:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
claude
```

Get an API key from [console.anthropic.com](https://console.anthropic.com/).

### Credential Persistence

Authentication credentials are stored in `/workspaces/.claude/` and persist across container rebuilds.

For more options, see the [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code).

## GitHub & NPM Authentication

### Automatic Auth via `.secrets` (Recommended)

CodeForge can automatically configure GitHub CLI, git identity, and NPM auth on every container start. Copy the template and fill in your tokens:

```bash
cp .devcontainer/.secrets.example .devcontainer/.secrets
```

Edit `.devcontainer/.secrets`:

```bash
GH_TOKEN=ghp_your_token_here
GH_USERNAME=your-github-username
GH_EMAIL=your-email@example.com
NPM_TOKEN=npm_your_token_here
```

On the next container start (or rebuild), `setup-auth.sh` will:
- Authenticate `gh` CLI and configure git credential helper
- Set `git config --global user.name` and `user.email`
- Set NPM registry auth token

The `.secrets` file is gitignored at two levels (root `.*` + `.devcontainer/.gitignore`) and will never be committed.

**Environment variable fallback**: For Codespaces or CI, set `GH_TOKEN`, `GH_USERNAME`, `GH_EMAIL`, and/or `NPM_TOKEN` as environment variables (e.g., via Codespaces secrets or `localEnv` in `devcontainer.json`). Environment variables take precedence over `.secrets` file values.

Disable automatic auth by setting `SETUP_AUTH=false` in `.devcontainer/.env`.

### Interactive Login (Alternative)

GitHub CLI (`gh`) is pre-installed for repository operations like pushing code, creating pull requests, and accessing private repositories.

```bash
gh auth login
```

Follow the prompts:
1. Select **GitHub.com** (or your enterprise server)
2. Choose your preferred protocol: **HTTPS** (recommended) or **SSH**
3. Authenticate via **browser** (easiest) or paste a personal access token

### Token-Based Login

For automated setups or environments without browser access:

```bash
# From a file
gh auth login --with-token < ~/github-token.txt

# From environment variable
echo "$GITHUB_TOKEN" | gh auth login --with-token
```

Generate a token at [github.com/settings/tokens](https://github.com/settings/tokens) with appropriate scopes (typically `repo`, `read:org`).

### Verifying Authentication

```bash
gh auth status
```

Expected output shows your authenticated account and token scopes.

### Credential Persistence

GitHub CLI credentials are automatically persisted across container rebuilds. The container is configured to store credentials in `/workspaces/.gh/` (via `GH_CONFIG_DIR`), which is part of the bind-mounted workspace.

**You only need to authenticate once.** After running `gh auth login` or configuring `.secrets`, your credentials will survive container rebuilds and be available in future sessions.

## Using Claude Code

### The `cc` Command

The `cc` command is an alias that launches Claude Code with the project's system prompt and plan-mode permissions. For Agent Teams split-pane support, use the **"Claude Teams (tmux)"** terminal profile in VS Code (dropdown next to the `+` button) or connect via `connect-external-terminal.sh`.

```bash
cc                    # Start Claude Code in current directory
cc "explain this"     # Start with an initial prompt
```

### Direct CLI

For more control, use the `claude` command directly:

```bash
claude                        # Basic invocation
claude --help                 # View all options
claude --resume               # Resume previous session
```

## Available Tools

### Languages & Runtimes
| Tool | Description |
|------|-------------|
| Python 3.14 | Base language runtime |
| Node.js LTS | JavaScript runtime |
| TypeScript | Via Node.js |
| Go | Latest stable via devcontainer feature |
| Bun | Fast JavaScript runtime and toolkit |

### Package Managers
| Tool | Description |
|------|-------------|
| `uv` | Fast Python package manager (pip alternative) |
| `npm` | Node.js package manager |
| `pip` / `pipx` | Python package installers |

### Development Tools
| Tool | Description |
|------|-------------|
| `gh` | GitHub CLI for repository operations |
| `docker` | Container CLI (connects to host Docker) |
| `git` | Version control |
| `jq` | JSON processor |
| `curl` | HTTP client |
| `tmux` | Terminal multiplexer for Agent Teams split-pane sessions |
| `biome` | Fast JS/TS/JSON/CSS formatter and linter |
| `ruff` | Fast Python linter and formatter (replaces Black + Flake8) |
| `shfmt` | Shell script formatter |
| `dprint` | Pluggable formatter for Markdown, YAML, TOML, Dockerfile |
| `shellcheck` | Static analysis tool for shell scripts |
| `hadolint` | Dockerfile linter |
| `agent-browser` | Headless browser automation for AI agents |

### Code Intelligence
| Tool | Description |
|------|-------------|
| tree-sitter | AST parsing for JavaScript, TypeScript, Python |
| ast-grep | Structural code search and rewriting |
| Pyright | Python language server |
| TypeScript LSP | TypeScript/JavaScript language server |

### Claude Code Tools
| Tool | Description |
|------|-------------|
| `claude` | Claude Code CLI |
| `cc` | Wrapper with auto-configuration |
| `ccusage` | Token usage analyzer |
| `ccburn` | Visual token burn rate tracker with pace indicators |
| `ccstatusline` | Status bar display (integrated into Claude Code, not standalone CLI) |
| `claude-monitor` | Real-time usage tracking |

## Configuration

### Environment Variables

Copy `.devcontainer/.env.example` to `.devcontainer/.env` and customize:

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_CONFIG_DIR` | `/workspaces/.claude` | Claude configuration directory |
| `SETUP_CONFIG` | `true` | Copy config files during setup (per `file-manifest.json`) |
| `SETUP_ALIASES` | `true` | Add `cc`/`claude`/`ccraw` aliases to shell |
| `SETUP_AUTH` | `true` | Configure Git/NPM auth from `.secrets` |
| `SETUP_PLUGINS` | `true` | Install official plugins + register marketplace |
| `SETUP_UPDATE_CLAUDE` | `true` | Auto-update Claude Code on container start |
| `SETUP_PROJECTS` | `true` | Auto-detect projects for VS Code Project Manager |
| `PLUGIN_BLACKLIST` | `""` | Comma-separated plugin names to skip |

### Claude Code Settings

Default settings are in `.devcontainer/config/defaults/settings.json`. File copying is controlled by `config/file-manifest.json`, which specifies per-file overwrite behavior (`"if-changed"`, `"always"`, or `"never"`).

To add a custom config file, append an entry to `file-manifest.json`:
```json
{
  "src": "my-config.json",
  "dest": "${WORKSPACE_ROOT}",
  "overwrite": "if-changed"
}
```

Key defaults:
- **Model**: Claude Opus 4-6
- **Default mode**: Plan (prompts before executing)
- **Max output tokens**: 64,000

### Keybindings

Default keybindings are in `.devcontainer/config/defaults/keybindings.json` (empty by default — Claude Code defaults apply). Customize by adding entries to the `bindings` array.

**VS Code Terminal Passthrough**: `Ctrl+P` and `Ctrl+F` are configured to pass through to the terminal (via `terminal.integrated.commandsToSkipShell`) so Claude Code receives them. Other VS Code shortcuts that conflict with Claude Code:

| Shortcut | VS Code Action | Claude Code Action |
|----------|---------------|-------------------|
| `Ctrl+G` | Go to Line | `chat:externalEditor` |
| `Ctrl+S` | Save File | `chat:stash` |
| `Ctrl+T` | Open Symbol | `app:toggleTodos` |
| `Ctrl+O` | Open File | `app:toggleTranscript` |
| `Ctrl+B` | Toggle Sidebar | `task:background` |
| `Ctrl+R` | Open Recent | `history:search` |

For conflicting shortcuts, use Meta (Alt) variants or add custom keybindings.

### System Prompt

The default system prompt is in `.devcontainer/config/defaults/main-system-prompt.md`. Override it by creating a `.claude/system-prompt.md` in your project directory.

## Custom Features

CodeForge includes several custom devcontainer features:

| Feature | Description |
|---------|-------------|
| `tmux` | Terminal multiplexer with Catppuccin theme for Agent Teams |
| `agent-browser` | Headless browser automation for AI agents |
| `claude-monitor` | Real-time token usage monitoring with ML predictions |
| `ccusage` | Usage analytics CLI |
| `ccburn` | Visual token burn rate tracker with pace indicators |
| `ccstatusline` | Status bar display (integrated into Claude Code, not standalone CLI) |
| `ast-grep` | Structural code search using AST patterns |
| `tree-sitter` | Parser with JS/TS/Python grammars |
| `lsp-servers` | Pyright and TypeScript language servers |
| `biome` | Fast JS/TS/JSON/CSS formatter (global install) |
| `notify-hook` | Desktop notifications on Claude completion |
| `mcp-qdrant` | Qdrant vector database MCP server (optional) |
| `mcp-reasoner` | Enhanced AI reasoning MCP server (optional) |

## Agents & Skills

The `code-directive` plugin includes specialized agent definitions and coding reference skills.

### Custom Agents (17)

Agent definitions in `plugins/devs-marketplace/plugins/code-directive/agents/` provide enhanced behavior when spawned via the `Task` tool. The `redirect-builtin-agents.py` hook transparently swaps built-in agent types to these custom agents.

| Agent | Purpose |
|-------|---------|
| `architect` | System design and implementation planning |
| `bash-exec` | Command execution specialist |
| `claude-guide` | Claude Code feature guidance |
| `debug-logs` | Log analysis and error diagnosis |
| `dependency-analyst` | Dependency analysis and upgrades |
| `doc-writer` | Documentation authoring |
| `explorer` | Fast codebase search and navigation |
| `generalist` | General-purpose multi-step tasks |
| `git-archaeologist` | Git history forensics |
| `migrator` | Code migration and upgrades |
| `perf-profiler` | Performance profiling |
| `refactorer` | Code refactoring with regression checks |
| `researcher` | Research and information gathering |
| `security-auditor` | Security vulnerability analysis |
| `spec-writer` | Specification and requirements authoring |
| `statusline-config` | ccstatusline configuration |
| `test-writer` | Test authoring with pass verification |

### Skills (16)

Skills in `plugins/devs-marketplace/plugins/code-directive/skills/` provide domain-specific coding references:

`claude-agent-sdk` · `claude-code-headless` · `debugging` · `docker` · `docker-py` · `fastapi` · `git-forensics` · `performance-profiling` · `pydantic-ai` · `refactoring-patterns` · `security-checklist` · `skill-building` · `specification-writing` · `sqlite` · `svelte5` · `testing`

## Project Manager

The `setup-projects.sh` script auto-detects projects under `/workspaces/` and maintains a `projects.json` file for the [Project Manager](https://marketplace.visualstudio.com/items?itemName=alefragnani.project-manager) VS Code extension. It watches for new projects via `inotifywait` and updates the project list automatically.

## Essential Gotchas

- **Authentication required**: Run `claude` once to authenticate before using `cc`
- **Plan mode default**: The container starts in "plan" mode, which prompts for approval before making changes
- **Config is managed by manifest**: `config/file-manifest.json` controls which files are copied and when — default `overwrite: "if-changed"` uses sha256 comparison. Persistent changes go in `.devcontainer/config/defaults/settings.json`
- **GitHub auth persists**: Run `gh auth login` once or configure `.secrets`; credentials survive container rebuilds
- **Agent Teams needs tmux**: Split panes only work inside tmux. Use the "Claude Teams (tmux)" VS Code terminal profile or `connect-external-terminal.sh` from WezTerm/iTerm2

## Troubleshooting

Common issues and solutions. For detailed troubleshooting, see [docs/troubleshooting.md](docs/troubleshooting.md).

| Problem | Solution |
|---------|----------|
| `cc: command not found` | Run `source ~/.bashrc` or open a new terminal |
| `claude` fails during startup | Background update may be in progress — wait 10s and retry |
| GitHub push fails | Run `gh auth status` to check authentication |
| Plugin not loading | Check `enabledPlugins` in `config/defaults/settings.json` |
| Feature not installed | Check `devcontainer.json` for `"version": "none"` |
| Tool version/status | Run `cc-tools` to list all tools with version info |
| Full health check | Run `check-setup` to verify setup status |

## Further Reading

**CodeForge Documentation**:
- [Configuration Reference](docs/configuration-reference.md) — all env vars and config options
- [Plugin System](docs/plugins.md) — plugin architecture and per-plugin docs
- [Optional Features](docs/optional-features.md) — mcp-qdrant, mcp-reasoner, splitrail
- [Keybinding Customization](docs/keybindings.md) — resolving VS Code conflicts
- [Troubleshooting](docs/troubleshooting.md) — common issues and solutions

**External**:
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Dev Containers Specification](https://containers.dev/)
- [GitHub CLI Manual](https://cli.github.com/manual/)
