# CodeForge Devcontainer Changelog

## [v1.7.1] - 2026-02-08

### Added

- **Automatic Git & NPM auth on container start** — new `setup-auth.sh` script reads tokens from `.devcontainer/.secrets` (or environment variables) and configures GitHub CLI, git user identity, and NPM registry auth automatically
- **`.secrets.example` template** — committed template showing required variables (`GH_TOKEN`, `GH_USERNAME`, `GH_EMAIL`, `NPM_TOKEN`)
- **`.env.example` template** — committed template for environment configuration (`.env` itself remains gitignored)
- **`SETUP_AUTH` env var** — controls whether auth setup runs on container start (default: `true`)
- **`AGENT-REDIRECTION.md`** — guide on how the PreToolUse hook system works, how built-in agents are swapped to custom ones, and what else is possible (prompt injection, model overrides, conditional routing, external service chaining)

### Changed

- **README split by audience** — root `README.md` is now the npm/GitHub landing page (install, prerequisites, what's included, quick start); `.devcontainer/README.md` is now the usage guide (auth, tools, config, agents, keybindings, gotchas). No duplicated content between the two
- **Auto-linter moved to Stop hook** — was PostToolUse (ran pyright per-edit, caused agent re-reads); now batch-lints all edited Python files when Claude stops, matching auto-formatter's pattern. Uses its own temp file (`claude-lint-files-{session_id}`) independent of the formatter pipeline
- **`collect-edited-files.py`** — now writes to both `claude-edited-files-*` (formatter) and `claude-lint-files-*` (linter) temp files, keeping the two Stop hook pipelines independent
- **`.devcontainer/.gitignore`** — added `.secrets` explicit ignore and negation patterns (`!.env.example`, `!.secrets.example`, `!.gitignore`) to override root `.*` rule for files that should be tracked
- **`setup.sh` orchestration** — `setup-auth.sh` runs early (after symlink, before config/plugins) so NPM auth is available for plugin installation
- **`PLUGIN_BLACKLIST`** — cleared (was `"workflow-enhancer,planning-reminder"`)

### Removed

- **`workflow-enhancer` plugin** — deleted entirely (was scaffolding only, never active)
- **`planning-reminder` plugin** — deleted entirely (redundant with Claude Code v2.1+ auto plan mode)

---

## [v1.7.0] - 2026-02-08

### Added

- **ccburn feature** — new devcontainer feature for visual token burn rate tracking with shell aliases and statusline wrapper
- **Session resume widget** — ccstatusline displays copyable `cc --resume {sessionId}` command on line 5
- **Burn rate widget** — ccstatusline line 6 shows live ccburn compact output with pace indicators (session/weekly/sonnet limits)
- **17 custom agent definitions** — code-directive plugin now includes specialized agents: architect, bash-exec, claude-guide, debug-logs, dependency-analyst, doc-writer, explorer, generalist, git-archaeologist, migrator, perf-profiler, refactorer, researcher, security-auditor, spec-writer, statusline-config, test-writer
- **6 new skills** — claude-agent-sdk, git-forensics, performance-profiling, refactoring-patterns, security-checklist, specification-writing
- **Agent redirect hook** — `redirect-builtin-agents.py` (PreToolUse/Task) transparently swaps built-in agent types (Explore→explorer, Plan→architect, etc.) to enhanced custom agents
- **Readonly bash guard** — `guard-readonly-bash.py` blocks write operations for read-only agents
- **Regression test hooks** — `verify-no-regression.py` (PostToolUse for refactorer) and `verify-tests-pass.py` (Stop for test-writer)
- **REVIEW-RUBRIC.md** — quality standards document for agent/skill development
- **Keybindings configuration** — new `config/keybindings.json` with schema support
- **VS Code terminal passthrough** — `Ctrl+P` and `Ctrl+F` pass through to Claude Code via `terminal.integrated.commandsToSkipShell`
- **claude-agent-sdk skill** — new code-directive skill for Claude Agent SDK TypeScript integration
- **OVERWRITE_CONFIG documentation** — documented ephemeral settings behavior
- **Project Manager integration** — `setup-projects.sh` auto-detects projects under `/workspaces/`, watches for changes via inotifywait, maintains `projects.json`
- **Claude config symlink** — `setup-symlink-claude.sh` symlinks `~/.claude` → `$CLAUDE_CONFIG_DIR` for third-party tool compatibility
- **Project Manager VS Code extension** — `alefragnani.project-manager` added to devcontainer

### Changed

- **ccstatusline layout** — expanded from 3→6 lines (13→16 widgets), reorganized into logical groups (core metrics, tokens, git, session, totals, burn rate)
- **ccstatusline version** — bumped from 1.0.0 to 1.1.0
- **Plugin declarations centralized** — all 9 marketplace plugins declared in `enabledPlugins` in `config/settings.json`
- **setup-plugins.sh cache sync** — re-added plugin install loop to sync cache from source on every container start; added `.env` fallback so `PLUGIN_BLACKLIST` works on standalone invocation
- **Feature-level config synced** — `features/claude-code/config/settings.json` mirrors main config (model → `claude-opus-4-6`, `MAX_THINKING_TOKENS` → `63999`, `cleanupPeriodDays` → `60`, all env vars)
- **8 new env vars** — `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY`, `CLAUDE_CODE_MAX_RETRIES`, `BASH_MAX_OUTPUT_LENGTH`, `TASK_MAX_OUTPUT_LENGTH`, `CLAUDE_CODE_PLAN_MODE_INTERVIEW_PHASE`, `CLAUDE_CODE_PLAN_V2_AGENT_COUNT`, `CLAUDE_CODE_PLAN_MODE_REQUIRED`, `CLAUDE_CODE_FORCE_GLOBAL_CACHE`
- **setup-config.sh** — added `chown` for correct ownership; added keybindings.json to copy pipeline
- **setup-aliases.sh** — added idempotency guard
- **TMPDIR consistency** — `setup-update-claude.sh` and `ccstatusline/install.sh` use `${TMPDIR:-/tmp}`
- **installsAfter references** — mcp-qdrant and mcp-reasoner updated from `./features/claude-code` to `ghcr.io/anthropics/devcontainer-features/claude-code:1`
- **code-directive hooks.json** — added PreToolUse/Task hook for agent redirection
- **Auto-linter timeout** — pyright reduced from 55s to 10s
- **Auto-formatter tool paths** — resolved via `which` first
- **Protected-files-guard regex** — tightened `id_rsa` pattern
- **Syntax-validator JSONC regex** — handles URLs containing `://`
- **Skill-suggester keywords** — consolidated claude-agent-sdk phrases; added "compose" to docker
- **redirect-builtin-agents.py fix** — `updatedInput` now preserves all original tool input fields (Claude Code replaces rather than merges)
- **System prompt hardened** — added anti-fabrication rule, failure recovery strategy, and silent-violation guard to `execution_discipline` and `rule_precedence`

### Removed

- **setup-irie-claude.sh** — deleted (personal script, no longer invoked)
- **output-style widget** — removed from ccstatusline (low value)

### Documentation

- **CLAUDE.md** — added keybindings.json, updated plugins list, fixed model name, documented VS Code conflicts, documented OVERWRITE_CONFIG, added agents/skills sections, added new scripts
- **README.md** — fixed max output tokens, added keybindings section, added agents/skills, added project manager
- **features/README.md** — full rewrite listing all features
- **CHANGELOG.md** — squashed v1.6.0 + v1.6.1 into this entry

---

## [v1.5.8] - 2026-02-06

### Changed

- **tmux is now opt-in in VS Code**: Reverted auto-tmux-everywhere approach (forced all terminals into tmux, caused shared-view conflicts and hotkey clashes with Claude Code). Default terminal is plain `bash`. A **"Claude Teams (tmux)"** profile is available from the VS Code terminal dropdown for Agent Teams split-pane sessions. External terminal connectors (WezTerm/iTerm2) are unchanged — they still auto-enter tmux
- **Removed auto-tmux from `.bashrc`/`.zshrc`**: The `exec tmux` block that forced every interactive shell into tmux has been removed from `setup-aliases.sh`

---

## [v1.5.3] - 2026-02-06

### Added

- **Catppuccin Mocha tmux theme**: Replaced barebones tmux config with Catppuccin v2.1.3. Rounded window tabs, Nerd Font icons, transparent status bar, colored pane borders. Installed at build time via shallow git clone (~200KB, ~2s)

### Fixed

- **ccstatusline powerline glyphs**: Powerline separators/caps were empty strings, rendering as underscores. Now uses proper Nerd Font glyphs (U+E0B0, U+E0B4, U+E0B6)
- **Unicode rendering in external terminals**: tmux rendered ALL Unicode as underscores because `docker exec` doesn't propagate locale vars. External terminal scripts now pass `LANG`/`LC_ALL=en_US.UTF-8` and use `tmux -u` to force UTF-8 mode. Locale exports also added to `.bashrc`/`.zshrc` as permanent fallback

### Fixed

- **cc/claude aliases**: Converted from shell functions to simple aliases — functions were not reliably invoked across shell contexts (tmux, docker exec, external terminals), causing Claude to launch without config
- **CLAUDE_CONFIG_DIR export**: Now exported in `.bashrc`/`.zshrc` directly, so credentials are found in all shells (not just VS Code terminals where `remoteEnv` applies)

---

## [v1.5.0] - 2026-02-06

### Added

#### Agent Teams (Experimental)
- **Claude Code Agent Teams**: Enabled via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1"` and `teammateMode: "auto"`
- **System prompt guidance**: Agent Teams section with 3–5 active teammate limit and usage heuristics
- **Task tracking**: `CLAUDE_CODE_ENABLE_TASKS: "true"` for structured task management
- **Effort level**: `CLAUDE_CODE_EFFORT_LEVEL: "high"`

#### Features
- **tmux feature**: Split-pane terminal multiplexer for Agent Teams
  - Pre-configured Catppuccin color palette, mouse support, 10,000-line scrollback
  - Creates `claude-teams` session on container start
- **Biome feature**: Fast JS/TS/JSON/CSS formatter via global `@biomejs/biome` install
- **External terminal connectors**: Bash (`.sh`) and PowerShell (`.ps1`) scripts to connect host terminals to devcontainer tmux sessions
- **Claude Code auto-update**: `setup-update-claude.sh` checks for newer Claude Code native binary on every container start
  - Runs non-blocking in background via `setup.sh`
  - Downloads from GCS, verifies SHA256 checksum, atomic binary replacement
  - Controlled by `SETUP_UPDATE_CLAUDE` env var in `.env` (default: `true`)

#### Plugins
- **code-directive plugin**: Replaces `codedirective-skills` with expanded hook infrastructure
  - **New skill**: `debugging` — Log forensics, Docker log analysis, error pattern recognition
  - **Hooks**: `skill-suggester.py` (UserPromptSubmit, SubagentStart), `syntax-validator.py` + `collect-edited-files.py` (PostToolUse)
  - All 10 existing skills migrated from `codedirective-skills`

#### VS Code Extensions
- `GitHub.vscode-github-actions` — GitHub Actions workflow support
- `fabiospampinato.vscode-todo-plus` — Todo+ task management

### Changed

- **Default model**: Claude Opus 4-5 → **Claude Opus 4-6** (frontier)
- **Max output tokens**: 64,000 → **128,000**
- **Container memory**: 3GB → **4GB** (`--memory-swap` raised to 8GB)
- **External terminal connectors**: Now run as `vscode` user and auto-launch `cc` on new tmux sessions
- **Auto-formatter**: Switched from PostToolUse (`format-file.py`) to Stop hook (`format-on-stop.py`)
  - Added Biome support for JS/TS/CSS alongside existing Black and gofmt
  - Batch-formats all edited files when Claude stops instead of formatting on every edit
- **Auto-linter**: Switched from PostToolUse to Stop hook
- **Agent-browser**: Optimized to install only Chromium (previously installed all Playwright browsers)

### Removed

- **codedirective-skills plugin**: Replaced by `code-directive` (all skills preserved)
- **format-file.py**: Replaced by `format-on-stop.py`
- **`CLAUDE_CODE_SUBAGENT_MODEL`**: Environment variable removed (no longer needed)

### Gitignore

- Added `claude-dev-discord-logs/`, `devforge/`

---

## [v1.4.0] - 2026-02-01

### Breaking

- **Package rename**: `claudepod` → `codeforge-dev` on npm. Install via `npx codeforge-dev`
- **Full rebrand**: All references renamed from ClaudePod/claudepod to CodeForge/codeforge

### Added

#### Plugins
- **codedirective-skills plugin**: 9 coding reference skills for the CodeDirective tech stack
  - `fastapi` - Routing, middleware, SSE, Pydantic models
  - `pydantic-ai` - Agents, tools, models, streaming
  - `svelte5` - Runes, reactivity, components, routing, dnd, LayerCake, AI SDK
  - `sqlite` - Python/JS patterns, schema, pragmas, advanced queries
  - `docker` - Dockerfile patterns, Compose services
  - `docker-py` - Container lifecycle, resources, security
  - `claude-code-headless` - CLI flags, output, SDK/MCP
  - `testing` - FastAPI and Svelte testing patterns
  - `skill-building` - Meta-skill for authoring skills
- **codeforge-lsp plugin**: Replaces `claudepod-lsp` with identical functionality
- **Svelte MCP plugin**: Added `svelte@sveltejs/mcp` to official plugins
- **Plugin blacklist system**: `PLUGIN_BLACKLIST` env var in `.env` to skip plugins during auto-install
  - Parsed by `is_blacklisted()` helper in `setup-plugins.sh`
  - Default: `workflow-enhancer` blacklisted

#### System Prompt
- **`<execution_discipline>`**: Verify before assuming, read before writing, instruction fidelity, verify after writing, no silent deviations
- **`<professional_objectivity>`**: Prioritize technical accuracy over agreement, direct measured language
- **`<structural_search>`**: ast-grep and tree-sitter usage guidance with when-to-use-which
- **Scope discipline**: Modify only what the task requires, trust internal code, prefer inline clarity
- **Continuation sessions**: Re-read source files after compaction, verify state before changes
- **Brevity additions**: No problem restatement, no filler/narrative, no time estimates

#### DevContainer
- **Bun runtime**: Added `ghcr.io/rails/devcontainer/features/bun:1.0.2`
- **Playwright browsers**: Installed via `npx playwright install --with-deps` in agent-browser feature
- **Memory cap**: Container limited to 3GB via `--memory=3g --memory-swap=3g`
- **TMPDIR**: Set to `/workspaces/.tmp`
- **VS Code remote extension**: `wenbopan.vscode-terminal-osc-notifier` configured as UI extension

### Changed

- **Permission model**: `--dangerously-skip-permissions` → `--permission-mode plan --allow-dangerously-skip-permissions`
- **Settings**: `autoCompact: true`, `alwaysThinkingEnabled: true`
- **Autocompact threshold**: 80% → 95%
- **Cleanup period**: 360 days → 60 days
- **Tool search**: Added `ENABLE_TOOL_SEARCH: "auto:5"`
- **Tree-sitter**: Removed Go grammar from defaults
- **Ticket-workflow commands**: Renamed `ticket:` → `ticket꞉` for cross-platform filesystem compatibility
- **notify-hook**: Added empty `matcher` field to hooks.json schema

### Removed

- **claudepod-lsp plugin**: Replaced by `codeforge-lsp`

### Gitignore

- Added `code-directive/`, `article/`, `claude-research/`, `dashboard/`, `simple-review/`, `workflow-enhancer/`

---

## [v1.3.1] - 2025-01-24

### Fixed

- **Plugin installation**: Fixed invalid plugin.json schema causing installation failures
  - Removed `$schema`, `category`, `version`, `lspServers` keys from individual plugin.json files
  - These fields now correctly reside only in `marketplace.json`
- **setup-plugins.sh**: Fixed path resolution for marketplace discovery
  - Changed from `${containerWorkspaceFolder:-.}` to `SCRIPT_DIR` relative path
  - Script now works correctly regardless of working directory

### Changed

- **Consolidated LSP setup**: Merged `setup-lsp.sh` into `setup-plugins.sh`
  - Single script now handles both official and local marketplace plugins
  - Removed `SETUP_LSP` environment variable (no longer needed)
- **settings.json**: Updated Claude Code configuration
  - Increased `MAX_THINKING_TOKENS` from 14999 to 63999
  - Added `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`: 80 (auto-compact at 80% context)
  - Added `CLAUDE_CODE_SHELL`: zsh
  - Added `FORCE_AUTOUPDATE_PLUGINS`: true
  - Added `autoUpdatesChannel`: "latest"

### Removed

- **setup-lsp.sh**: Deleted (functionality consolidated into setup-plugins.sh)

---

## [v1.3.0] - 2025-01-24

### Added

#### Code Quality Hooks
- **dangerous-command-blocker**: PreToolUse hook blocks dangerous bash commands
  - Blocks `rm -rf /`, `rm -rf ~`, `sudo rm`, `chmod 777`
  - Blocks `git push --force` to main/master
  - Blocks writes to system directories (`/usr`, `/etc`, `/bin`)
  - Blocks disk formatting (`mkfs.*`, `dd of=/dev/`)
- **protected-files-guard**: PreToolUse hook blocks modifications to sensitive files
  - Blocks `.env`, `.env.*` environment files
  - Blocks `.git/` directory
  - Blocks lock files (`package-lock.json`, `yarn.lock`, `poetry.lock`, etc.)
  - Blocks certificates/keys (`.pem`, `.key`, `.crt`)
  - Blocks credential files and auth directories (`.ssh/`, `.aws/`)
- **auto-formatter**: PostToolUse hook auto-formats edited files
  - Python files via Black (`/usr/local/py-utils/bin/black`)
  - Go files via gofmt (`/usr/local/go/bin/gofmt`)
- **auto-linter**: PostToolUse hook auto-lints edited files
  - Python files via Pyright with JSON output parsing
- **planning-reminder**: PreToolUse hook encourages plan-before-implement workflow

#### Features
- **notify-hook feature**: Desktop notifications when Claude finishes responding
  - OSC escape sequences for terminal notification support
  - Optional audio bell
  - VS Code extension recommendation for terminal notifications
- **agent-browser feature**: Headless browser automation CLI for AI agents
  - Accessibility tree snapshots for AI navigation
  - Screenshots and PDF capture
  - Element interaction and cookie management
- **Go LSP (gopls)**: Full Go language server support
  - Added `gopls` to codeforge-lsp plugin configuration
  - Added `goplsVersion` option to lsp-servers feature
  - Supports `.go`, `.mod`, `.sum` file extensions
- **Go language**: Added `ghcr.io/devcontainers/features/go:1` feature

#### Plugins
- **ticket-workflow plugin**: EARS-based ticket workflow with GitHub integration
  - `/ticket:new` - Transform requirements into EARS-formatted GitHub issues
  - `/ticket:work` - Create technical implementation plans from tickets
  - `/ticket:review-commit` - Thorough code review with requirements verification
  - `/ticket:create-pr` - Create PRs with aggressive security/architecture review
- **notify-hook plugin**: Claude Code hook integration for completion notifications
- **codeforge-lsp plugin.json**: Proper plugin structure for LSP servers

#### Commands & Aliases
- **ccraw alias**: Runs vanilla Claude Code without any config
  - Bypasses the function override via `command claude`
  - Useful for debugging or running without custom system prompt

#### Documentation
- **System prompt**: Added `<tools_reference>` section with all available tools
- **System prompt**: Added `<browser_automation>` section with usage guidance

### Changed

- **claude command**: Now behaves the same as `cc` (auto-creates local config)
  - Uses `command claude` internally to call the actual binary
  - Both `claude` and `cc` auto-setup `.claude/system-prompt.md` and `.claude/settings.json`
- **Container name**: Now includes project folder name for multi-project clarity
  - Format: `CodeForge - ${localWorkspaceFolderBasename}`
- **setup-lsp.sh**: Replaced hard-coded plugin list with dynamic discovery
  - Now reads all plugins from `marketplace.json` using `jq`
  - Automatically installs new plugins when added to marketplace
- **System prompt**: Updated to use correct Claude Code tool names
  - Fixed plan mode references: `PlanMode` → `EnterPlanMode` / `ExitPlanMode`
  - Added explicit tool names throughout directives
- **Plugin installation**: Reduced from 7 plugins to 1 official plugin (frontend-design skill)

### Removed

- `code-review@claude-plugins-official` (command plugin)
- `commit-commands@claude-plugins-official` (command plugin)
- `pr-review-toolkit@claude-plugins-official` (command + agent plugin)
- `code-simplifier` npx installation block

### Files Created

```
.devcontainer/
├── features/
│   ├── agent-browser/
│   │   ├── devcontainer-feature.json
│   │   ├── install.sh
│   │   └── README.md
│   └── notify-hook/
│       ├── devcontainer-feature.json
│       ├── install.sh
│       └── README.md
└── plugins/devs-marketplace/plugins/
    ├── auto-formatter/
    │   ├── .claude-plugin/plugin.json
    │   ├── hooks/hooks.json
    │   └── scripts/format-file.py
    ├── auto-linter/
    │   ├── .claude-plugin/plugin.json
    │   ├── hooks/hooks.json
    │   └── scripts/lint-file.py
    ├── codeforge-lsp/
    │   └── .claude-plugin/plugin.json
    ├── dangerous-command-blocker/
    │   ├── .claude-plugin/plugin.json
    │   ├── hooks/hooks.json
    │   └── scripts/block-dangerous.py
    ├── notify-hook/
    │   ├── .claude-plugin/plugin.json
    │   └── hooks/hooks.json
    ├── planning-reminder/
    │   ├── .claude-plugin/plugin.json
    │   └── hooks/hooks.json
    ├── protected-files-guard/
    │   ├── .claude-plugin/plugin.json
    │   ├── hooks/hooks.json
    │   └── scripts/guard-protected.py
    └── ticket-workflow/
        └── .claude-plugin/
            ├── plugin.json
            ├── system-prompt.md
            └── commands/
                ├── ticket:new.md
                ├── ticket:work.md
                ├── ticket:review-commit.md
                └── ticket:create-pr.md
```

### Files Modified

- `.devcontainer/devcontainer.json` - Added features, VS Code settings, dynamic name
- `.devcontainer/config/main-system-prompt.md` - Tools reference, browser automation
- `.devcontainer/scripts/setup-aliases.sh` - Claude function override, ccraw alias
- `.devcontainer/scripts/setup-lsp.sh` - Dynamic plugin discovery
- `.devcontainer/scripts/setup-plugins.sh` - Trimmed to frontend-design only
- `.devcontainer/features/lsp-servers/install.sh` - Added gopls installation
- `.devcontainer/features/lsp-servers/devcontainer-feature.json` - Added goplsVersion
- `.devcontainer/plugins/devs-marketplace/.claude-plugin/marketplace.json` - All new plugins
- `.devcontainer/CLAUDE.md` - Updated plugin docs, local marketplace section
- `.devcontainer/README.md` - Added agent-browser, Go to tools tables

---

## [v1.2.3] - 2025-01-19

### Changed
- Added `--force` flag support
- Removed devpod references

---

## [v1.2.0] - 2025-01-19

### Added
- **GitHub CLI**: Added `ghcr.io/devcontainers/features/github-cli:1` feature
- **Official Anthropic Plugins**: New `setup-plugins.sh` script
- **SETUP_PLUGINS** environment variable
- **GitHub CLI Credential Persistence**: `GH_CONFIG_DIR=/workspaces/.gh`
- **README.md**: Comprehensive documentation
- **CLAUDE.md**: Development guide for Claude Code

### Changed
- **Plan Mode Default**: Changed `defaultMode` from `"dontAsk"` to `"plan"`
- **cc Command**: Replaced simple alias with smart function

### Removed
- **Specwright**: Completely removed (setup script, aliases, plugin files, ORCHESTRATOR.md)
