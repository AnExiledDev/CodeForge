# ccms - Claude Code Message Searcher

Installs [ccms](https://github.com/mkusaka/ccms), a high-performance CLI for searching Claude Code session JSONL files.

## Features

- SIMD-accelerated JSON parsing with parallel file processing
- Boolean query syntax: AND, OR, NOT, regex, quoted literals
- Filter by role (user/assistant/system), session ID, timestamp ranges, project paths
- Interactive fzf-like TUI mode (when run without arguments)
- Multiple output formats: text, JSON, JSONL
- Shell completion for bash, zsh, fish

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `version` | string | `latest` | `latest` builds from main, `none` skips, or a git commit hash |
| `username` | string | `automatic` | Container user to install for |

## Dependencies

Requires the Rust devcontainer feature:
```json
"ghcr.io/devcontainers/features/rust:1": {}
```

## Usage

```bash
# Search current project (recommended)
ccms --project $(pwd) "query"

# Filter by who said it
ccms -r assistant "architecture decision"
ccms -r user "auth approach"

# Boolean queries
ccms "error AND connection"
ccms "(auth OR authentication) AND NOT test"

# Time-scoped
ccms --since "1 day ago" "recent work"

# JSON output for scripting
ccms -f json "query" -n 10

# Interactive TUI
ccms
```
