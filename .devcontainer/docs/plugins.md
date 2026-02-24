# Plugin System

CodeForge includes a local plugin marketplace that provides specialized tools and hooks for Claude Code.

## Architecture

```
plugins/devs-marketplace/
├── .claude-plugin/
│   └── marketplace.json       # Marketplace manifest (lists all plugins)
└── plugins/
    ├── codeforge-lsp/         # LSP language servers
    ├── ticket-workflow/       # EARS ticket workflow
    ├── notify-hook/           # Desktop notifications
    ├── dangerous-command-blocker/  # Safety: block destructive commands
    ├── protected-files-guard/ # Safety: protect sensitive files
    ├── auto-code-quality/     # Batch formatter + linter + advisory test runner
    ├── agent-system/          # 17 custom agents + redirection hooks
    ├── skill-engine/          # 22 coding skills + auto-suggestion
    ├── spec-workflow/         # 8 spec lifecycle skills + spec-reminder
    ├── session-context/       # Git state, TODO harvesting, commit reminders
    └── workspace-scope-guard/ # Workspace scope enforcement
```

Each plugin has a `.claude-plugin/plugin.json` manifest defining its name, description, and capabilities.

## Enabling/Disabling Plugins

Plugins are enabled in `config/defaults/settings.json` under `enabledPlugins`:

```json
"enabledPlugins": [
    "auto-code-quality@devs-marketplace",
    "agent-system@devs-marketplace",
    "skill-engine@devs-marketplace",
    "spec-workflow@devs-marketplace",
    "session-context@devs-marketplace"
]
```

To disable a plugin, remove its entry from the `enabledPlugins` array.

## PLUGIN_BLACKLIST

To skip a plugin during the installation/registration step (without editing `settings.json`), add it to `PLUGIN_BLACKLIST` in `.env`:

```bash
PLUGIN_BLACKLIST="ticket-workflow,auto-linter"
```

This prevents the plugin from being registered on container start but doesn't remove it from `enabledPlugins`.

---

## Plugin Reference

### codeforge-lsp

**Purpose**: Provides Language Server Protocol servers for code intelligence.

**Servers**:
- **Pyright** — Python type checking and completion (`.py`, `.pyi`)
- **TypeScript Language Server** — TypeScript/JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs`)
- **gopls** — Go language server (`.go`, `.mod`, `.sum`)

Claude Code automatically uses these for hover info, go-to-definition, and find-references.

### ticket-workflow

**Purpose**: EARS-based ticket workflow with GitHub integration.

Provides structured ticket management using EARS (Easy Approach to Requirements Syntax) format. Integrates with GitHub Issues for tracking.

**Commands**: `/ticket:new`, `/ticket:work`, `/ticket:review-commit`, `/ticket:create-pr`

### notify-hook

**Purpose**: Desktop notifications when Claude Code finishes responding.

Sends an OSC escape sequence and terminal bell when Claude completes a response, triggering desktop notifications in supported terminals (WezTerm, iTerm2, VS Code with the OSC notifier extension).

**Configuration**: Enabled via `devcontainer.json` feature options:
```json
"./features/notify-hook": {
    "enableBell": true,
    "enableOsc": true
}
```

### dangerous-command-blocker

**Purpose**: Prevents Claude Code from executing destructive bash commands.

**Blocked patterns**:
- `rm -rf /` and variants
- `sudo rm` on system directories
- `chmod 777` on sensitive paths
- `git push --force` to protected branches
- `dd` with output to block devices
- Other destructive system commands

The blocker runs as a PreToolUse hook on Bash commands. It checks the command against a pattern list and rejects matches.

### protected-files-guard

**Purpose**: Prevents Claude Code from modifying sensitive files.

**Protected patterns**:
- `.env` and `.secrets` files
- Lock files (`package-lock.json`, `uv.lock`, `Cargo.lock`, etc.)
- `.git/` directory contents
- Credential files and SSH keys

Runs as a PreToolUse hook on Write and Edit operations.

### auto-code-quality

**Purpose**: Batch-formats, lints, and runs advisory tests on files edited during a Claude Code session.

**Supported formatters**:
| Language | Formatter |
|----------|-----------|
| Python | Ruff |
| Go | gofmt |
| JavaScript/TypeScript/CSS/JSON/GraphQL/HTML | Biome |
| Shell scripts | shfmt |
| Markdown/YAML/TOML/Dockerfile | dprint |
| Rust | rustfmt |

**Supported linters**:
| Language | Linter |
|----------|--------|
| Python | Pyright + Ruff |
| JavaScript/TypeScript/CSS/GraphQL | Biome |
| Shell scripts | ShellCheck |
| Go | go vet |
| Dockerfile | hadolint |
| Rust | clippy |

**How it works**: Runs as a Stop hook. When Claude Code stops, it checks which files were edited, detects their language, and runs the appropriate formatter and linter. Also includes an advisory test runner that runs affected tests. Results are informational — they don't block.

### agent-system

**Purpose**: 17 specialized agent definitions with built-in agent redirection.

**Components**:
- **17 custom agents** — Specialized agent definitions for different task types (architect, explorer, test-writer, refactorer, security-auditor, researcher, doc-writer, etc.)
- **Agent redirection hook** — Transparently swaps built-in agent types to custom agents (e.g., `Explore` → `explorer`, `Plan` → `architect`)
- **CWD injection hook** — Injects current working directory into agent prompts
- **Read-only bash enforcement** — Prevents read-only agents from executing write operations

For detailed agent documentation, see `plugins/devs-marketplace/plugins/agent-system/agents/`.

### skill-engine

**Purpose**: 22 domain-specific coding reference skills with auto-suggestion.

**Skills**: fastapi, svelte5, docker, docker-py, pydantic-ai, sqlite, testing, debugging, security-checklist, refactoring-patterns, git-forensics, performance-profiling, documentation-patterns, migration-patterns, dependency-management, claude-code-headless, claude-agent-sdk, ast-grep-patterns, api-design, skill-building, team, worktree

**How it works**: Skills are loaded on demand via the Skill tool. A PreToolUse hook auto-suggests relevant skills based on conversation context.

For skill details, see `plugins/devs-marketplace/plugins/skill-engine/skills/`.

### spec-workflow

**Purpose**: 8 spec lifecycle skills with spec-reminder hook.

**Skills**: spec-new, spec-refine, spec-build, spec-review, spec-update, spec-check, spec-init, specification-writing

**How it works**: Provides a structured specification workflow. A Stop hook reminds users to update specs when code was modified but specs weren't.

### workspace-scope-guard

**Purpose**: Enforces workspace scope by blocking writes outside the working directory and warning on out-of-scope reads.

Runs as a PreToolUse hook on Write, Edit, and Read operations. Compares file paths against the current working directory and rejects modifications to files outside the project scope. Read operations outside scope produce a warning but are not blocked. Resolves symlinks and worktree paths correctly via `os.path.realpath()`.
