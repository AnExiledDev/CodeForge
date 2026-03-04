# CodeForge Usage Guide

Everything you need to know once you're inside the devcontainer. These instructions apply regardless of which client you used to start the container — VS Code, the `devcontainer` CLI, JetBrains Gateway, DevPod, or GitHub Codespaces.

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

Authentication credentials are stored in `~/.claude/` and persist across container rebuilds via a Docker named volume.

### Long-Lived Token Authentication

For headless or automated environments, you can use a long-lived auth token instead of browser login:

1. Generate a token: `claude setup-token`
2. Add to `.devcontainer/.secrets`:
   ```bash
   CLAUDE_AUTH_TOKEN=sk-ant-oat01-your-token-here
   ```
3. On next container start, `setup-auth.sh` will create `~/.claude/.credentials.json` automatically.

You can also set `CLAUDE_AUTH_TOKEN` as a Codespaces secret for cloud environments.

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

GitHub CLI credentials are automatically persisted across container rebuilds. The container is configured to store credentials in `/workspaces/.gh/` (via `GH_CONFIG_DIR`), which is part of the bind-mounted workspace. Claude Code credentials persist via a Docker named volume mounted at `~/.claude/`.

**You only need to authenticate once.** After running `gh auth login` or configuring `.secrets`, your credentials will survive container rebuilds and be available in future sessions.

## Using Claude Code

### The `cc` Command

The `cc` command is an alias that launches Claude Code with the project's system prompt and plan-mode permissions. For Agent Teams split-pane support, use the **"Claude Teams (tmux)"** terminal profile in VS Code (dropdown next to the `+` button) or connect via `.codeforge/scripts/connect-external-terminal.sh`.

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
| Go | Optional — uncomment Go feature in `devcontainer.json` to enable |
| Rust | Latest stable via devcontainer feature |
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
| `claude-dashboard` | Local session analytics dashboard (token usage, costs, timelines) |

## Configuration

### Environment Variables

Copy `.devcontainer/.env.example` to `.devcontainer/.env` and customize:

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_CONFIG_DIR` | `/home/vscode/.claude` | Claude configuration directory |
| `SETUP_CONFIG` | `true` | Copy config files during setup (per `file-manifest.json`) |
| `SETUP_ALIASES` | `true` | Add `cc`/`claude`/`ccraw` aliases to shell |
| `SETUP_AUTH` | `true` | Configure Git/NPM auth from `.secrets` |
| `SETUP_PLUGINS` | `true` | Install official plugins + register marketplace |
| `SETUP_UPDATE_CLAUDE` | `true` | Auto-update Claude Code on container start |
| `SETUP_TERMINAL` | `true` | Configure VS Code Shift+Enter keybinding for Claude Code terminal |
| `SETUP_PROJECTS` | `true` | Auto-detect projects for VS Code Project Manager |
| `SETUP_POSTSTART` | `true` | Run post-start hooks from `/usr/local/devcontainer-poststart.d/` |
| `PLUGIN_BLACKLIST` | `""` | Comma-separated plugin names to skip |

### Claude Code Settings

Default settings are in `.codeforge/config/settings.json`. File copying is controlled by `.codeforge/file-manifest.json`, which specifies per-file overwrite behavior (`"if-changed"`, `"always"`, or `"never"`).

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

Default keybindings are in `.codeforge/config/keybindings.json` (empty by default — Claude Code defaults apply). Customize by adding entries to the `bindings` array.

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

The default system prompt is in `.codeforge/config/main-system-prompt.md`. Override it by creating a `.claude/main-system-prompt.md` in your project directory.

## Custom Features

CodeForge includes custom devcontainer features. Any feature can be disabled by setting `"version": "none"` in `devcontainer.json` — the entry stays in place for easy re-enabling. Each feature's README documents its options and dependencies.

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
| `ruff` | Fast Python linter and formatter |
| `shfmt` | Shell script formatter (disabled by default) |
| `shellcheck` | Static analysis for shell scripts (disabled by default) |
| `hadolint` | Dockerfile linter (disabled by default) |
| `dprint` | Pluggable formatter for Markdown/YAML/TOML (disabled by default) |
| `ccms` | Claude Code session history search |
| `claude-session-dashboard` | Local session analytics dashboard with web UI |
| `notify-hook` | Desktop notifications on Claude completion |
| `mcp-qdrant` | Qdrant vector database MCP server (optional) |

## Safety Plugins

| Plugin | Description |
|--------|-------------|
| `dangerous-command-blocker` | Blocks destructive bash commands (rm -rf, sudo rm, chmod 777, force push) |
| `protected-files-guard` | Blocks modifications to .env, lock files, .git/, and credentials |
| `workspace-scope-guard` | Enforces working directory scope — blocks writes and warns on reads outside the project |

### auto-code-quality

Combined auto-formatter, auto-linter, and advisory test runner plugin at `plugins/devs-marketplace/plugins/auto-code-quality/`. Three-phase pipeline: collect edited files (PostToolUse), batch format + lint (Stop), and advisory test runner (Stop). Supports all languages from the former auto-formatter + auto-linter plugins. Replaces the separate `auto-formatter` and `auto-linter` plugins.

## Alias Management

Features create shell aliases during container build (e.g., `ccusage`, `ccburn`). Separately, `setup-aliases.sh` creates a managed block in `~/.bashrc` and `~/.zshrc` on every container start for `cc`, `claude`, `ccraw`, `ccw`, and `cc-tools`. Both coexist without conflict — feature aliases are installed at build time while setup aliases are refreshed at start time.

## Credential Management

Three methods for providing GitHub/NPM credentials, in order of precedence:

1. **Environment variables** — Set `GH_TOKEN`, `GH_USERNAME`, `GH_EMAIL`, `NPM_TOKEN` as environment variables (e.g., via Codespaces secrets or `localEnv` in `devcontainer.json`)
2. **`.secrets` file** — Create `.devcontainer/.secrets` with token values (see template at `.secrets.example`). Auto-configured by `setup-auth.sh` on container start
3. **Interactive login** — Run `gh auth login` for GitHub CLI, then set git identity manually

All methods persist across container rebuilds via the bind-mounted `/workspaces/.gh/` directory.

4. **`.secrets` file with `CLAUDE_AUTH_TOKEN`** — Long-lived Claude auth token from `claude setup-token`. Auto-creates `~/.claude/.credentials.json` on container start.

## Agents & Skills

Agents and skills are distributed across focused plugins (replacing the former `code-directive` monolith).

### Custom Agents (17) — `agent-system` plugin

Agent definitions in `plugins/devs-marketplace/plugins/agent-system/agents/` provide enhanced behavior when spawned via the `Task` tool. The `redirect-builtin-agents.py` hook transparently swaps built-in agent types to these custom agents.

| Agent | Purpose |
|-------|---------|
| `architect` | System design and implementation planning |
| `bash-exec` | Command execution specialist |
| `claude-guide` | Claude Code feature guidance |
| `debug-logs` | Log analysis and error diagnosis |
| `dependency-analyst` | Dependency analysis and upgrades |
| `documenter` | Documentation, specs, and spec lifecycle |
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

### General Skills (22) — `skill-engine` plugin

Skills in `plugins/devs-marketplace/plugins/skill-engine/skills/` provide domain-specific coding references:

`api-design` · `ast-grep-patterns` · `claude-agent-sdk` · `claude-code-headless` · `debugging` · `dependency-management` · `docker` · `docker-py` · `documentation-patterns` · `fastapi` · `git-forensics` · `migration-patterns` · `performance-profiling` · `pydantic-ai` · `refactoring-patterns` · `security-checklist` · `skill-building` · `sqlite` · `svelte5` · `team` · `testing` · `worktree`

### Spec Skills (8) — `spec-workflow` plugin

Skills in `plugins/devs-marketplace/plugins/spec-workflow/skills/`:

`spec-build` · `spec-check` · `spec-init` · `spec-new` · `spec-refine` · `spec-review` · `spec-update` · `specification-writing`

## Specification Workflow

CodeForge includes a specification-driven development workflow. Every non-trivial feature gets a spec before implementation begins.

### Quick Start

```bash
/spec-init                       # Bootstrap .specs/ directory (first time only)
/spec-new auth-flow              # Create a feature spec (domain is inferred)
/spec-refine auth-flow           # Validate assumptions with user
# ... implement the feature ...
/spec-update auth-flow           # As-built update after implementation
/spec-check                      # Audit all specs for health
```

### The Lifecycle

1. **Backlog** — features live in `.specs/BACKLOG.md` with priority grades (P0–P3)
2. **Milestone** — when starting a milestone, pull features from backlog into `.specs/MILESTONES.md`
3. **Spec** — `/spec-new` creates a spec from the standard template with all requirements tagged `[assumed]`
4. **Refine** — `/spec-refine` walks through every assumption with the user, converting `[assumed]` → `[user-approved]`. The spec's approval status moves from `draft` → `user-approved`. **No implementation begins until approved.**
5. **Implement** — build the feature using the spec's acceptance criteria as the definition of done
6. **Update** — `/spec-update` performs the as-built update: sets status, checks off criteria, adds implementation notes
7. **Health check** — `/spec-check` audits all specs for staleness, missing sections, unapproved status, and other issues

### Approval Workflow

Specs use a two-level approval system:

- **Requirement-level:** each requirement starts as `[assumed]` (AI hypothesis) and becomes `[user-approved]` after explicit user validation via `/spec-refine`
- **Spec-level:** the `**Approval:**` field starts as `draft` and becomes `user-approved` when all requirements pass review

A spec-reminder advisory hook fires at Stop when code was modified but specs weren't updated.

### Skills Reference

| Skill | Purpose |
|-------|---------|
| `/spec-init` | Bootstrap `.specs/` directory with MILESTONES and BACKLOG |
| `/spec-new` | Create a feature spec from the standard template |
| `/spec-refine` | Validate assumptions and get user approval (required before implementation) |
| `/spec-update` | As-built update after implementation |
| `/spec-check` | Audit all specs for health issues |
| `/spec-build` | Orchestrate full implementation from an approved spec (plan, build, review, close) |
| `/spec-review` | Standalone deep implementation review against a spec |
| `/specification-writing` | EARS format templates and acceptance criteria patterns |

### Directory Structure

```
.specs/
├── MILESTONES.md      # Milestone tracker linking to feature specs
├── BACKLOG.md         # Priority-graded feature backlog
├── auth/              # Domain folder
│   ├── login-flow.md  # Feature spec
│   └── oauth.md       # Feature spec
└── search/            # Domain folder
    └── full-text.md   # Feature spec
```

All specs live in domain subfolders. Specs aim for ~200 lines each; split into separate specs in the domain folder when longer.

## Project Manager

The `setup-projects.sh` script auto-detects projects under `/workspaces/` and maintains a `projects.json` file for the [Project Manager](https://marketplace.visualstudio.com/items?itemName=alefragnani.project-manager) VS Code extension. It watches for new projects via `inotifywait` and updates the project list automatically.

## Essential Gotchas

- **Authentication required**: Run `claude` once to authenticate before using `cc`
- **Plan mode default**: The container starts in "plan" mode, which prompts for approval before making changes
- **Config is managed by manifest**: `.codeforge/file-manifest.json` controls which files are copied and when — default `overwrite: "if-changed"` uses sha256 comparison. Persistent changes go in `.codeforge/config/settings.json`
- **GitHub auth persists**: Run `gh auth login` once or configure `.secrets`; credentials survive container rebuilds
- **Agent Teams needs tmux**: Split panes only work inside tmux. Use the "Claude Teams (tmux)" VS Code terminal profile or `.codeforge/scripts/connect-external-terminal.sh` from WezTerm/iTerm2

## Troubleshooting

Common issues and solutions. For detailed troubleshooting, see the [Troubleshooting](https://codeforge.core-directive.com/reference/troubleshooting/) page on the docs site.

| Problem | Solution |
|---------|----------|
| `cc: command not found` | Run `source ~/.bashrc` or open a new terminal |
| `claude` fails during startup | Background update may be in progress — wait 10s and retry |
| GitHub push fails | Run `gh auth status` to check authentication |
| Plugin not loading | Check `enabledPlugins` in `.codeforge/config/settings.json` |
| Feature not installed | Check `devcontainer.json` for `"version": "none"` |
| Tool version/status | Run `cc-tools` to list all tools with version info |
| Full health check | Run `check-setup` to verify setup status |

## Further Reading

**CodeForge Documentation**:
- [Configuration Reference](https://codeforge.core-directive.com/customization/configuration/) — all env vars and config options
- [Plugin System](https://codeforge.core-directive.com/plugins/) — plugin architecture and per-plugin docs
- [Optional Features](https://codeforge.core-directive.com/customization/optional-features/) — mcp-qdrant and other optional components, disabling features
- [Keybinding Customization](https://codeforge.core-directive.com/customization/keybindings/) — resolving VS Code conflicts
- [Troubleshooting](https://codeforge.core-directive.com/reference/troubleshooting/) — common issues and solutions

**External**:
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Dev Containers Specification](https://containers.dev/)
- [GitHub CLI Manual](https://cli.github.com/manual/)
