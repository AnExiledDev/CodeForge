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
    ├── auto-formatter/        # Batch formatter (Stop hook)
    ├── auto-linter/           # Batch linter (Stop hook)
    └── code-directive/        # Agents, skills, hooks
```

Each plugin has a `.claude-plugin/plugin.json` manifest defining its name, description, and capabilities.

## Enabling/Disabling Plugins

Plugins are enabled in `config/defaults/settings.json` under `enabledPlugins`:

```json
"enabledPlugins": [
    "auto-formatter@devs-marketplace",
    "auto-linter@devs-marketplace",
    "code-directive@devs-marketplace"
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

### auto-formatter

**Purpose**: Batch-formats all files edited during a Claude Code session.

**Supported languages**:
| Language | Formatter |
|----------|-----------|
| Python | Ruff |
| Go | gofmt |
| JavaScript/TypeScript/CSS/JSON/GraphQL/HTML | Biome |
| Shell scripts | shfmt |
| Markdown/YAML/TOML/Dockerfile | dprint |
| Rust | rustfmt |

**How it works**: Runs as a Stop hook. When Claude Code stops (end of a conversation turn), it checks which files were edited, detects their language, and runs the appropriate formatter. Has a 30-second timeout.

### auto-linter

**Purpose**: Batch-lints all files edited during a Claude Code session.

**Supported linters**:
| Language | Linter |
|----------|--------|
| Python | Pyright + Ruff |
| JavaScript/TypeScript/CSS/GraphQL | Biome |
| Shell scripts | ShellCheck |
| Go | go vet |
| Dockerfile | hadolint |
| Rust | clippy |

**How it works**: Runs as a Stop hook alongside auto-formatter. Checks edited files and runs the appropriate linter. Results are reported but don't block — they're informational.

### code-directive

**Purpose**: The main intelligence layer — custom agents, coding skills, and behavior hooks.

**Components**:
- **17 custom agents** — Specialized agent definitions for different task types (architect, test-writer, refactorer, etc.)
- **16 coding skills** — Domain-specific reference materials (FastAPI, Docker, testing patterns, etc.)
- **Agent redirection hook** — Transparently swaps built-in agent types to custom agents (e.g., `Explore` → `explorer`, `Plan` → `architect`)
- **Syntax validation hook** — Validates code syntax before commits
- **Skill auto-suggestion hook** — Suggests relevant skills based on conversation context

For detailed agent and skill documentation, see the agent markdown files in `plugins/devs-marketplace/plugins/code-directive/agents/` and skill files in `plugins/devs-marketplace/plugins/code-directive/skills/`.
