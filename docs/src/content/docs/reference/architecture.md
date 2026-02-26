---
title: Architecture
description: System architecture overview — how CodeForge components interact, data flow, and design decisions.
sidebar:
  order: 4
---

This page describes how CodeForge is built -- how its components are organized, how they interact during a session, and the design principles that guide the system. CodeForge is not a standalone application. It is a DevContainer configuration that layers plugins, tools, and agents on top of Claude Code through configuration and scripts.

## System Overview

CodeForge operates in three layers. Each layer builds on the one below it:

```
+------------------------------------------------+
|                  Claude Code                    |
|  (AI assistant, tool execution, conversation)   |
+------------------------------------------------+
|                CodeForge Layer                  |
|  +----------+ +----------+ +--------------+    |
|  | Plugins  | |  Agents  | |    Skills    |    |
|  +----------+ +----------+ +--------------+    |
|  +----------+ +----------+ +--------------+    |
|  |  Hooks   | |  Rules   | |System Prompts|    |
|  +----------+ +----------+ +--------------+    |
+------------------------------------------------+
|                 DevContainer                    |
|  +----------+ +----------+ +--------------+    |
|  | Runtimes | |CLI Tools | | LSP Servers  |    |
|  +----------+ +----------+ +--------------+    |
+------------------------------------------------+
```

**DevContainer layer** provides the foundation: a Python 3.14 container image with Node.js, Rust, and Bun runtimes (Go available as opt-in), plus CLI tools (ruff, biome, ast-grep, tree-sitter, and others).

**CodeForge layer** adds intelligence: plugins register hooks that validate commands, inject context, and run quality checks. Agents provide specialized personas for different tasks. Skills offer on-demand reference material. Rules enforce hard constraints. System prompts shape behavior.

**Claude Code layer** is the AI assistant itself, executing tools, managing conversations, and coordinating multi-agent teams.

## Component Architecture

### Plugin System

Plugins are the primary extension mechanism. Each plugin is a self-contained directory with a manifest (`plugin.json`), optional hooks (`hooks/hooks.json`), and optional scripts (`scripts/`).

**Plugin lifecycle:**

1. **Discovery** -- Plugins are found in the marketplace directory (`.devcontainer/plugins/devs-marketplace/plugins/`)
2. **Registration** -- Plugin manifests are parsed and hooks are registered with Claude Code
3. **Activation** -- Only plugins listed as `true` in `settings.json` `enabledPlugins` are active
4. **Execution** -- Active hooks fire at their registered lifecycle points

**Plugin isolation:** Plugins cannot directly call each other. They communicate only through the hook pipeline and shared context. This prevents coupling between plugins and makes it safe to enable or disable any plugin independently.

### Hook Pipeline

Hooks form a processing pipeline through Claude Code's lifecycle. Every tool use passes through this pipeline:

```
User Request
     |
     v
[PreToolUse hooks] --- block? ---> Error message to user
     |
     | allow
     v
[Tool Execution] (Bash, Edit, Write, Read, etc.)
     |
     v
[PostToolUse hooks] --- inject context into conversation
     |
     v
Claude generates response
     |
     v
[Stop hooks] --- format, lint, test, notify, remind
     |
     v
Response shown to user
```

PreToolUse hooks are **gates**: any hook can block the operation. PostToolUse hooks are **enrichers**: they add context. Stop hooks are **quality checks**: they run after Claude finishes a turn.

Additional hook points (`SessionStart`, `SubagentStart`, `TeammateIdle`, `TaskCompleted`, `UserPromptSubmit`) fire at their respective lifecycle events outside the main tool-use pipeline.

### Agent System

The agent system provides specialized personas with constrained tools and focus areas. CodeForge ships 17 custom agents:

**How agent routing works:**

1. Claude analyzes the user's request and selects an appropriate agent type
2. The `redirect-builtin-agents.py` PreToolUse hook intercepts the agent selection
3. Built-in agent types are transparently swapped for enhanced custom agents:
   - `Explore` is redirected to `explorer` (fast codebase search, read-only)
   - `Plan` is redirected to `architect` (implementation planning, read-only)
   - `general-purpose` is redirected to `generalist` (multi-step tasks)
   - `Bash` is redirected to `bash-exec` (command execution)
4. The custom agent's system prompt is loaded, restricting tools and focus
5. The agent executes within its constraints and returns results

**Agent tiers:** Agents are grouped by capability level. Tier 1 (generalist) has all instruction blocks. Tier 2 (write agents like refactorer, test-writer, doc-writer) have full blocks. Tier 3 (read-only agents like explorer, researcher) have compact blocks.

### Skill Loading

Skills are Markdown knowledge files loaded on demand during a session:

1. The **skill-suggester** UserPromptSubmit hook monitors conversation context
2. When topic keywords match a skill (e.g., "docker" maps to the Docker skill), it suggests the skill to Claude
3. The user or Claude activates the skill via its slash command (e.g., `/docker`)
4. The skill content is injected into the conversation context
5. Claude uses the skill knowledge for the current task

CodeForge ships 35 skills across the skill-engine, spec-workflow, ticket-workflow, and agent-system plugins.

## Directory Structure

```
.devcontainer/
+-- devcontainer.json              # Container definition (image, features, mounts)
+-- .env                           # Setup flags (SETUP_CONFIG, SETUP_ALIASES, etc.)
+-- config/
|   +-- file-manifest.json         # Declarative config deployment rules
|   +-- defaults/
|       +-- settings.json          # Claude Code settings (model, plugins, env vars)
|       +-- keybindings.json       # Keyboard shortcuts
|       +-- main-system-prompt.md  # Development system prompt
|       +-- writing-system-prompt.md  # Writing mode system prompt
|       +-- rules/                 # Default rules deployed to .claude/rules/
|           +-- spec-workflow.md
|           +-- workspace-scope.md
|           +-- session-search.md
+-- features/                      # DevContainer features (tool installers)
|   +-- ccms/                      # Session history search (Rust)
|   +-- ccstatusline/              # Terminal status line
|   +-- ccusage/                   # API usage stats
|   +-- ccburn/                    # Token burn rate
|   +-- claude-session-dashboard/  # Web dashboard
|   +-- claude-monitor/            # Real-time monitor
|   +-- ast-grep/                  # Structural code search
|   +-- tree-sitter/               # Syntax parsing
|   +-- ruff/                      # Python formatter/linter
|   +-- biome/                     # JS/TS formatter/linter
|   +-- ... (21 features total)
+-- plugins/
|   +-- devs-marketplace/
|       +-- plugins/
|           +-- agent-system/      # 17 agents + redirection hooks
|           +-- skill-engine/      # 22 skills + auto-suggestion
|           +-- spec-workflow/     # 8 spec lifecycle skills
|           +-- session-context/   # Git state, TODOs, commit reminders
|           +-- auto-code-quality/ # Format + lint + test at Stop
|           +-- dangerous-command-blocker/  # Block destructive commands
|           +-- protected-files-guard/     # Block edits to sensitive files
|           +-- workspace-scope-guard/     # Enforce project isolation
|           +-- ticket-workflow/   # GitHub issue/PR workflow
|           +-- notify-hook/       # Desktop notifications
|           +-- codeforge-lsp/     # Language servers
+-- scripts/                       # Setup scripts (run via postStartCommand)
    +-- setup.sh                   # Main orchestrator
    +-- setup-aliases.sh           # Shell alias configuration
    +-- setup-config.sh            # Config file deployment
    +-- setup-plugins.sh           # Plugin installation
    +-- setup-auth.sh              # Git/NPM auth
    +-- check-setup.sh             # Health verification
```

## Design Principles

### Configuration Over Code

CodeForge avoids custom runtime code where possible. Behavior is defined through configuration files -- JSON manifests, Markdown prompts, and rule files -- rather than compiled programs. Hook scripts are the exception: they are small Python scripts that handle specific validation or enrichment tasks.

### Plugin Isolation

Each plugin operates independently. Plugins cannot directly call each other and do not share state. They communicate only through the hook pipeline (one plugin's PostToolUse output becomes part of the context that another plugin's hook sees). This isolation means you can safely enable, disable, or remove any plugin without affecting others.

### Layered Defaults

Configuration follows a strict override hierarchy: environment variables > project config > workspace config > defaults. You only need to specify what you want to change. Everything else falls through to sensible defaults.

### Read-Only Safety

Agents that do not need write access are restricted to read-only mode. This is enforced at the hook level by the `guard-readonly-bash.py` script, which blocks write operations for read-only agents. This is a security boundary, not a convention.

### Fail-Closed Safety

Safety-critical hooks (dangerous-command-blocker, protected-files-guard, workspace-scope-guard) fail closed: if JSON parsing fails or an unexpected error occurs, the operation is blocked rather than allowed. This prevents safety bypasses due to malformed input.

## Data Flow

### Container Startup

```
devcontainer.json
     |
     v
[Build] Install base image, features, runtimes, tools
     |
     v
[postStartCommand] setup.sh orchestrates:
  1. setup-migrate-claude.sh -- Migrate Claude config from old location
  2. setup-auth.sh           -- Git/NPM authentication
  3. setup-config.sh         -- Deploy settings, prompts, rules via file-manifest.json
  4. setup-aliases.sh        -- Write shell aliases to .bashrc/.zshrc
  5. setup-plugins.sh        -- Sync plugins from marketplace
  6. setup-projects.sh       -- Detect projects, configure Project Manager
  7. setup-terminal.sh       -- Configure terminal settings
  8. setup-update-claude.sh  -- Update Claude Code if needed (background)
```

### Session Lifecycle

1. **Session start** -- User runs `cc`. Claude Code loads the system prompt, rules, CLAUDE.md files. SessionStart hooks fire (git state injection, TODO harvesting).
2. **Turn cycle** -- User input arrives. Claude selects tools. PreToolUse hooks gate each tool call. Tool executes. PostToolUse hooks enrich context. Claude generates a response.
3. **Turn boundary** -- Stop hooks fire: format edited files, lint them, run affected tests, check for uncommitted changes, remind about specs, send notifications.
4. **Session end** -- Session data is written to JSONL files for `ccms` search.

### Context Assembly

At session start, Claude's context is assembled from multiple sources:

```
System Prompt (main-system-prompt.md)
     +
Rules (.claude/rules/*.md)
     +
CLAUDE.md files (project root and parent directories)
     +
Session Context (git state, TODOs -- injected by SessionStart hooks)
     +
Skill Knowledge (injected on-demand during the session)
     +
Agent System Prompt (loaded when a specific agent is activated)
     =
Claude's working context for the session
```

## Related

- [Plugins](../plugins/) -- detailed plugin documentation
- [Hooks](../customization/hooks/) -- hook system details and the full hook reference table
- [Configuration](../customization/configuration/) -- configuration layers and file manifest
