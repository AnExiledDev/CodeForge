---
title: CLI Tools
description: Reference for all CLI tools and utilities installed in the CodeForge DevContainer.
sidebar:
  order: 4
---

CodeForge installs 23 tools and utilities in your DevContainer, covering session management, code quality, language runtimes, and development infrastructure. Every tool is on your `PATH` from the first terminal session — no manual installation required.

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

### ccburn — Token Burn Analysis

Analyze token consumption patterns across sessions to understand usage efficiency and identify sessions with unusually high token burn.

```bash
# Analyze token burn rate
ccburn
```

### codeforge-dashboard

A web-based session monitoring dashboard that provides real-time visibility into active Claude sessions, resource usage, and session history. Runs on port 7847.

```bash
# Launch the dashboard
codeforge-dashboard
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

These tools are used both manually and automatically by the [Auto Code Quality Plugin](../plugins/auto-code-quality/) to maintain code standards.

| Command | Languages | Purpose | Example |
|---------|-----------|---------|---------|
| `ruff` | Python | Linting and formatting | `ruff check src/ && ruff format src/` |
| `biome` | JS/TS/JSON | Linting and formatting | `biome check src/` |
| `shellcheck` | Shell | Script linting | `shellcheck scripts/*.sh` |
| `shfmt` | Shell | Script formatting | `shfmt -w scripts/*.sh` |
| `dprint` | MD/TOML/JSON | Formatting | `dprint fmt` |
| `hadolint` | Dockerfile | Linting | `hadolint Dockerfile` |

:::tip[Automatic quality]
You rarely need to run these tools manually. The Auto Code Quality plugin runs the appropriate linter and formatter automatically when Claude edits files. See [Auto Code Quality](../plugins/auto-code-quality/) for details.
:::

## Code Intelligence Tools

| Command | Purpose | Details |
|---------|---------|---------|
| `sg` / `ast-grep` | Structural code search using AST patterns | [Full documentation](./code-intelligence/) |
| `tree-sitter` | Syntax tree parsing and symbol extraction | [Full documentation](./code-intelligence/) |

These tools are covered in depth on the [Code Intelligence](./code-intelligence/) page.

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
| **LSP servers** | Language servers for code intelligence | See [Code Intelligence](./code-intelligence/) |

## Complete Tool Reference

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
| 9 | `codeforge-dashboard` | Session | Web-based session dashboard |
| 10 | `claude-monitor` | Session | Real-time session monitor |
| 11 | `agent-browser` | Session | Headless browser for agents |
| 12 | `check-setup` | Session | Installation health check |
| 13 | `cc-tools` | Session | List all available tools |
| 14 | `codeforge` | Session | CodeForge CLI — session search, plugins, indexing _(experimental)_ |
| 15 | `codeforge proxy` | Session | Launch Claude Code through mitmproxy for API traffic inspection |
| 16 | `dbr` | Infrastructure | Devcontainer bridge for dynamic port forwarding |
| 17 | `ruff` | Quality | Python linting and formatting |
| 18 | `biome` | Quality | JS/TS/JSON linting and formatting |
| 19 | `shellcheck` | Quality | Shell script linting |
| 20 | `shfmt` | Quality | Shell script formatting |
| 21 | `dprint` | Quality | Markdown/TOML/JSON formatting |
| 22 | `hadolint` | Quality | Dockerfile linting |
| 23 | `sg` / `ast-grep` | Intelligence | Structural code search |
| 24 | `tree-sitter` | Intelligence | Syntax tree parsing |
| 25 | `pyright` | Intelligence | Python LSP server |
| 26 | `typescript-language-server` | Intelligence | TypeScript/JS LSP server |

## Related

- [Code Intelligence](./code-intelligence/) — ast-grep, tree-sitter, and LSP details
- [Commands Reference](../reference/commands/) — complete command table
- [Auto Code Quality](../plugins/auto-code-quality/) — how quality tools are automated
