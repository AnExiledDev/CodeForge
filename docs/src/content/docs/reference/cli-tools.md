---
title: CLI Tools Reference
description: Reference for all CLI tools and utilities installed in the CodeForge DevContainer.
sidebar:
  order: 3
---

CodeForge includes 25 core CLI tools and utilities in the default inventory.

This page also includes closely related runtimes, package managers, and language servers so you can see the full command-line surface in one place.

## Session & Claude Tools

These tools manage your Claude Code sessions, track usage, and provide monitoring capabilities.

### cc / claude

Launch Claude Code with the full CodeForge configuration — custom system prompt, all plugins, agents, and skills active.

```bash
# Start a CodeForge-configured Claude session
cc

# Equivalent — 'claude' is an alias for the same configuration
claude
```

Both `cc` and `claude` set up the CodeForge system prompt, enable plan permission mode, and load all configured plugins. This is the primary way to start Claude Code in a CodeForge environment.

### ccraw

Launch Claude Code without any CodeForge configuration — no custom system prompt, no plugins, no agents. Useful for debugging or when you need vanilla Claude Code behavior.

```bash
# Start vanilla Claude Code
ccraw
```

### ccw

Launch Claude Code with a writing-focused system prompt, optimized for documentation and content creation tasks.

```bash
# Start Claude in writing mode
ccw
```

### ccms — Session History Search

:::caution[Currently Disabled]
The `ccms` feature is currently commented out in `devcontainer.json`. It has been replaced by `codeforge session search` (part of the CodeForge CLI). The documentation below is preserved for reference.
:::

Search through your Claude Code session history (JSONL files) with boolean queries, role filtering, and time scoping. Built in Rust for fast searching across large session archives.

```bash
# Basic search across all sessions
ccms "authentication flow"

# Search within the current project only
ccms --project "$(pwd)" "query"

# Filter by role — find Claude's past decisions
ccms -r assistant "what was decided about the database schema"

# Filter by role — find what you previously asked
ccms -r user "auth approach"

# Boolean queries
ccms "(auth OR authentication) AND NOT test"

# Time-scoped search
ccms --since "1 day ago" "recent work"
ccms --since "1 week ago" "architecture decisions"

# JSON output for structured parsing
ccms -f json "query" -n 10

# Statistics about your session history
ccms --stats ""

# Interactive TUI mode (not available from within Claude)
ccms
```

:::tip[Project scoping]
Always pass `--project "$(pwd)"` when searching from within a project to avoid results from unrelated projects leaking into your search.
:::

### ccusage — Usage Statistics

View your Claude API usage statistics, including token counts, costs, and session summaries. Installed via npm from the [ccusage](https://github.com/ryoppippi/ccusage) project.

```bash
# View usage statistics
ccusage
```

### ccusage-codex — Codex Usage Statistics

View your OpenAI Codex CLI token usage statistics, including daily and monthly breakdowns. Companion to `ccusage` from the same [ccusage project](https://github.com/ryoppippi/ccusage), reading session data from `~/.codex/`.

```bash
# Daily Codex usage
ccusage-codex daily

# Monthly Codex usage
ccusage-codex monthly
```

### ccburn — Token Burn Analysis

Analyze token consumption patterns across sessions to understand usage efficiency and identify sessions with unusually high token burn.

```bash
# Analyze token burn rate
ccburn
```

### claude-monitor

Real-time terminal-based Claude session monitor. Shows active sessions and their current status.

```bash
# Start the session monitor
claude-monitor
```

### agent-browser

A headless Chromium browser (Playwright-based) available for agents that need to inspect web content or take screenshots.

```bash
# Launch the agent browser
agent-browser
```

### codex — Codex CLI

OpenAI's open-source terminal coding agent, analogous to Claude Code. A self-contained Rust binary installed via npm that provides a full-screen TUI for reading, editing, and executing code. Requires an OpenAI account (ChatGPT Plus/Pro/Business/Edu/Enterprise for browser login, or an API key).

```bash
# Launch Codex CLI
codex

# Codex requires authentication on first run:
# Option 1: Browser login — select "Sign in with ChatGPT"
# Option 2: API key — set OPENAI_API_KEY in .devcontainer/.secrets
```

:::note[Separate from Claude Code]
Codex CLI is a separate tool from Claude Code. It uses OpenAI's models and requires separate authentication. Both tools coexist in the CodeForge container without conflict.
:::

### check-setup

Verify your CodeForge installation health — checks that all expected tools are installed, plugins are loaded, and configuration is valid.

```bash
# Run the setup health check
check-setup
```

### cc-tools

List all available CodeForge CLI tools with their installation status and versions.

```bash
# Show all tools and their status
cc-tools
```

This displays a formatted table showing every tool, whether it is installed, and its version number.

### codeforge — CodeForge CLI (Experimental)

:::caution[Experimental]
The CodeForge CLI is under active development. Commands and interfaces may change between releases.
:::

Multi-command CLI for development workflows — session search, plugin management, configuration, codebase indexing, and devcontainer management.

```bash
# Search session history
codeforge session search "authentication approach"

# List plugins and their status
codeforge plugin list

# Build a codebase symbol index
codeforge index build

# Manage devcontainers
codeforge container ls
```

When run outside the container, commands auto-proxy into the running devcontainer. Use `--local` to run against the host filesystem.

### codeforge proxy — API Traffic Inspection

Launch Claude Code through mitmproxy to inspect API traffic between Claude and the Anthropic API. Useful for debugging prompt construction, token usage, and request/response payloads.

```bash
# Launch Claude Code with traffic inspection on port 8081
codeforge proxy
```

The proxy runs on port 8081. Open the mitmproxy web interface to view, filter, and inspect all API calls in real time.

### dbr — Devcontainer Bridge

Dynamic port forwarding bridge for the devcontainer. Forwards ports between the host and the running devcontainer, enabling access to services running inside the container from the host machine.

```bash
# Start the devcontainer bridge
dbr
```

### ccstatusline — Terminal Status Bar

A status bar widget for your terminal prompt that displays contextual information about your current Claude Code session — active agent, model, token usage, and session status. Integrates with your shell prompt to provide at-a-glance session awareness.

```bash
# Configure the statusline
ccstatusline
```

## Code Quality Tools

These tools are used both manually and automatically by the [Auto Code Quality Plugin](/extend/plugins/auto-code-quality/) to maintain code standards.

| Command | Languages | Purpose | Example |
|---------|-----------|---------|---------|
| `ruff` | Python | Linting and formatting | `ruff check src/ && ruff format src/` |
| `biome` | JS/TS/JSON | Linting and formatting | `biome check src/` |
| `shellcheck` | Shell | Script linting | `shellcheck scripts/*.sh` |
| `shfmt` | Shell | Script formatting | `shfmt -w scripts/*.sh` |
| `dprint` | MD/TOML/JSON | Formatting | `dprint fmt` |
| `hadolint` | Dockerfile | Linting | `hadolint Dockerfile` |

:::tip[Automatic quality]
You rarely need to run these tools manually. The Auto Code Quality plugin runs the appropriate linter and formatter automatically when Claude edits files. See [Auto Code Quality](/extend/plugins/auto-code-quality/) for details.
:::

## Code Intelligence Tools

| Command | Purpose | Details |
|---------|---------|---------|
| `sg` / `ast-grep` | Structural code search using AST patterns | [Full documentation](/use/code-intelligence/) |
| `tree-sitter` | Syntax tree parsing and symbol extraction | [Full documentation](/use/code-intelligence/) |

These tools are covered in depth on the [Code Intelligence](/use/code-intelligence/) page.

## Language Runtimes & Package Managers

CodeForge includes modern language runtimes and fast package managers so you can work with multiple languages out of the box.

| Tool | Version | Purpose | Example |
|------|---------|---------|---------|
| **Node.js** | via nvm | JavaScript runtime | `node --version` |
| **Python** | 3.14 via uv | Python runtime | `python --version` |
| **Rust** | via rustup | Rust toolchain _(opt-in — commented out by default)_ | `cargo --version` |
| **Bun** | latest | Fast JS runtime and package manager | `bun install` |
| **uv** | latest | Fast Python package manager | `uv pip install requests` |
| **Go** | via feature | Go toolchain | `go version` |
| **GitHub CLI** (`gh`) | latest | GitHub operations from the terminal | `gh pr create` |

:::note[uv for Python]
CodeForge uses `uv` as the default Python package manager. It is significantly faster than pip for dependency resolution and installation. Use `uv pip install` instead of `pip install` for the best experience.
:::

## Development Utilities

| Tool | Purpose | Example |
|------|---------|---------|
| **tmux** | Terminal multiplexer for session management | `tmux new -s work` |
| **jq** | JSON processor for command-line data manipulation | `cat data.json \| jq '.results[]'` |
| **git** | Version control (pre-configured) | `git log --oneline -10` |
| **docker** | Container management (host Docker socket mounted) | `docker ps` |
| **LSP servers** | Language servers for code intelligence | See [Code Intelligence](/use/code-intelligence/) |

## Expanded Command Inventory

The table below is broader than the canonical 25-tool inventory because it also includes language servers that are useful to discover alongside the CLI tools.

| # | Command | Category | Description |
|---|---------|----------|-------------|
| 1 | `cc` / `claude` | Session | Claude Code with CodeForge config |
| 2 | `cc-orc` | Session | Claude Code in orchestrator mode (delegation-first) |
| 3 | `ccraw` | Session | Vanilla Claude Code |
| 4 | `ccw` | Session | Claude Code in writing mode |
| 5 | `ccms` | Session | Session history search _(currently disabled)_ |
| 6 | `ccusage` | Session | API usage statistics |
| 7 | `ccburn` | Session | Token burn analysis |
| 8 | `ccstatusline` | Session | Terminal status bar widget |
| 9 | `claude-monitor` | Session | Real-time session monitor |
| 10 | `agent-browser` | Session | Headless browser for agents |
| 11 | `check-setup` | Session | Installation health check |
| 12 | `cc-tools` | Session | List all available tools |
| 13 | `codeforge` | Session | CodeForge CLI — session search, plugins, indexing _(experimental)_ |
| 14 | `codeforge proxy` | Session | Launch Claude Code through mitmproxy for API traffic inspection |
| 15 | `codex` | Session | OpenAI Codex CLI terminal coding agent |
| 16 | `ccusage-codex` | Session | Codex token usage statistics |
| 17 | `dbr` | Infrastructure | Devcontainer bridge for dynamic port forwarding |
| 18 | `ruff` | Quality | Python linting and formatting |
| 19 | `biome` | Quality | JS/TS/JSON linting and formatting |
| 20 | `shellcheck` | Quality | Shell script linting |
| 21 | `shfmt` | Quality | Shell script formatting |
| 22 | `dprint` | Quality | Markdown/TOML/JSON formatting |
| 23 | `hadolint` | Quality | Dockerfile linting |
| 24 | `sg` / `ast-grep` | Intelligence | Structural code search |
| 25 | `tree-sitter` | Intelligence | Syntax tree parsing |
| 26 | `pyright` | Intelligence | Python LSP server |
| 27 | `typescript-language-server` | Intelligence | TypeScript/JS LSP server |

## Related

- [Code Intelligence](/use/code-intelligence/) — ast-grep, tree-sitter, and LSP details
- [Commands Reference](./commands/) — complete command table
- [Auto Code Quality](/extend/plugins/auto-code-quality/) — how quality tools are automated
- [What’s Included](./whats-included/) — canonical counts and status labels
