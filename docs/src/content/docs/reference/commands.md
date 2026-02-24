---
title: Commands
description: Complete reference table of all CLI commands, aliases, and slash commands available in CodeForge.
sidebar:
  order: 2
---

All CLI commands and slash commands available in the CodeForge DevContainer. Commands are shell aliases and functions defined in `setup-aliases.sh` and deployed to `.bashrc` and `.zshrc` on container start.

## Session Commands

Commands for launching and managing Claude Code sessions.

| Command | Description | Example |
|---------|-------------|---------|
| `cc` | Launch Claude Code with the main system prompt, plugins, and plan mode | `cc` |
| `claude` | Identical to `cc` | `claude` |
| `ccw` | Launch Claude Code with the writing system prompt (for docs and prose) | `ccw` |
| `ccraw` | Launch vanilla Claude Code with no custom config, prompts, or plugins | `ccraw` |

All session commands auto-detect the Claude binary location: `~/.local/bin/claude` (native install) is preferred, then `/usr/local/bin/claude`, then PATH lookup. If ChromaTerm (`ct`) is installed, output is wrapped through it for color highlighting.

:::caution[Permissions Flag]
The `cc`, `claude`, and `ccw` aliases include the `--allow-dangerously-skip-permissions` flag, which enables non-interactive permission handling. The aliases also set `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1` so Claude reads CLAUDE.md files from parent directories. Use `ccraw` if you need a session without these flags or env vars.
:::

:::tip[Resuming Sessions]
Use `cc --resume <session-id>` to resume a previous session. The session ID is displayed in the status line during active sessions.
:::

## Analysis and Monitoring Commands

Commands for session analysis, usage tracking, and system monitoring.

| Command | Description | Example |
|---------|-------------|---------|
| `ccms` | Search Claude Code session history. Supports boolean queries, role filtering, time scoping, and project isolation. | `ccms --project "$(pwd)" "auth approach"` |
| `ccusage` | View Claude API usage statistics | `ccusage` |
| `ccburn` | Analyze token burn rate and consumption patterns with pace indicators | `ccburn` |
| `ccstatusline` | Terminal status line displaying session metrics, git state, token usage, and burn rate | (runs automatically) |
| `claude-dashboard` | Web-based session monitoring dashboard on port 7847 with cost estimates and activity heatmaps | `claude-dashboard` |
| `claude-monitor` | Real-time Claude session activity monitor | `claude-monitor` |
| `agent-browser` | Headless Chromium browser for agent automation with accessibility tree snapshots | `agent-browser` |
| `check-setup` | Verify CodeForge installation health -- checks tools, config, and aliases | `check-setup` |
| `cc-tools` | List all installed CodeForge CLI tools with version info | `cc-tools` |

### ccms Usage

`ccms` is the most feature-rich analysis command. Key flags:

```bash
# Basic search
ccms "error handling"

# Project-scoped (recommended)
ccms --project "$(pwd)" "auth approach"

# Filter by role
ccms -r assistant "what was decided"
ccms -r user "please fix"

# Boolean queries
ccms "error AND connection"
ccms "(auth OR authentication) AND NOT test"

# Time-scoped
ccms --since "1 day ago" "recent work"

# JSON output
ccms -f json "query" -n 10
```

## Code Quality Commands

Pre-installed tools for linting, formatting, and code analysis.

| Command | Languages | Purpose | Example |
|---------|-----------|---------|---------|
| `ruff` | Python | Fast linting and formatting (replaces Black + Flake8) | `ruff check . --fix` |
| `biome` | JS/TS/JSON/CSS | Unified linting and formatting | `biome check .` |
| `shellcheck` | Shell | Script linting with structured diagnostics | `shellcheck script.sh` |
| `shfmt` | Shell | Script formatting | `shfmt -w script.sh` |
| `dprint` | MD/TOML/YAML | Pluggable multi-language formatter | `dprint fmt` |
| `hadolint` | Dockerfile | Dockerfile best practice linting | `hadolint Dockerfile` |

:::note[Optional Tools]
Some code quality tools ship with `"version": "none"` in `devcontainer.json` (disabled by default). To enable them, set a specific version or `"latest"` in the feature configuration and rebuild the container.
:::

## Code Intelligence Commands

Commands for structural code search and syntax analysis. These tools understand code structure (AST) rather than treating source files as plain text.

| Command | Purpose | Example |
|---------|---------|---------|
| `ag` / `sg` | ast-grep -- structural code search using AST patterns. Find code by structure, not text. | `sg -p 'console.log($$$)' -l js` |
| `tree-sitter` | Tree-sitter CLI -- parsing, syntax tree operations, and grammar development | `tree-sitter parse file.py` |

### ast-grep Examples

```bash
# Find all console.log statements in JavaScript
sg -p 'console.log($$$)' -l js

# Find functions with more than 3 parameters in Python
sg -p 'def $FUNC($A, $B, $C, $D, $$$)' -l python

# Find unused imports in TypeScript
sg -p 'import { $NAME } from $_' -l ts
```

### tree-sitter Examples

```bash
# Parse a file and show the syntax tree
tree-sitter parse file.py

# Highlight a file with syntax colors
tree-sitter highlight file.py
```

## Spec Workflow Slash Commands

Slash commands for specification-driven development. These are used within Claude Code sessions (type them in the chat, not the shell).

| Command | Purpose | Example |
|---------|---------|---------|
| `/spec-init` | Bootstrap the `.specs/` directory with templates | `/spec-init` |
| `/spec-new <feature>` | Create a new feature specification from the standard template | `/spec-new user-signup` |
| `/spec-refine <feature>` | Validate assumptions, get user approval before implementation | `/spec-refine user-signup` |
| `/spec-build <feature>` | Orchestrate full implementation: plan, build, review, and close | `/spec-build user-signup` |
| `/spec-review <feature>` | Verify implementation against spec requirements | `/spec-review user-signup` |
| `/spec-update` | As-built spec closure after implementation | `/spec-update` |
| `/spec-check` | Audit spec health -- find stale, incomplete, or unapproved specs | `/spec-check` |

## Ticket Workflow Slash Commands

Slash commands for issue and ticket management within Claude Code sessions.

| Command | Purpose |
|---------|---------|
| `/ticket:new` | Create a new GitHub issue in EARS format |
| `/ticket:work` | Start working on a ticket with a technical implementation plan |
| `/ticket:create-pr` | Generate a PR from ticket context with security review |
| `/ticket:review-commit` | Review commits against ticket requirements |

## GitHub CLI

The GitHub CLI (`gh`) is pre-installed for repository operations.

| Command | Purpose | Example |
|---------|---------|---------|
| `gh issue list` | List repository issues | `gh issue list --state open` |
| `gh issue view` | View issue details | `gh issue view 42` |
| `gh pr create` | Create a pull request | `gh pr create --title "Add feature"` |
| `gh pr view` | View pull request details | `gh pr view 15` |
| `gh api` | Make authenticated GitHub API requests | `gh api repos/owner/repo/pulls` |

## Other Useful Commands

These additional commands are available in the container environment:

| Command | Purpose |
|---------|---------|
| `git` | Version control (pre-configured with worktree support) |
| `docker` | Container management via Docker-outside-of-Docker |
| `jq` | JSON processing and filtering |
| `tmux` | Terminal multiplexer for Agent Teams split-pane sessions |
| `bun` | Fast JavaScript runtime and package manager |
| `cargo` | Rust package manager (used by ccms) |
| `uv` | Fast Python package installer |

## Command Sources

Commands come from different sources in the CodeForge setup:

| Source | Commands | How Defined |
|--------|----------|-------------|
| Shell aliases | `cc`, `claude`, `ccw`, `ccraw`, `check-setup` | `setup-aliases.sh` writes to `.bashrc`/`.zshrc` |
| Shell functions | `cc-tools` | `setup-aliases.sh` writes to `.bashrc`/`.zshrc` |
| DevContainer features | `ccms`, `ccusage`, `ccburn`, `ruff`, `biome`, `sg`, etc. | `install.sh` in each feature directory |
| Slash commands | `/spec-new`, `/ticket:new`, etc. | Skill SKILL.md files in plugin directories |
| External features | `gh`, `docker`, `node`, `bun`, `cargo` | Installed via `devcontainer.json` features |

:::tip[Listing All Tools]
Run `cc-tools` to see every installed tool and its version. This is the quickest way to verify what is available in your container.
:::

## Related

- [CLI Tools](../features/tools/) -- detailed tool descriptions and usage examples
- [Spec Workflow](../plugins/spec-workflow/) -- specification command details and lifecycle
- [Environment Variables](./environment/) -- env vars that affect command behavior
