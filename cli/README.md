# CodeForge CLI

CLI for CodeForge development workflows. Manages sessions, plugins, configuration, codebase indexing, and devcontainers.

> **Experimental** — v0.1.0. Ships with CodeForge v2.1.0.

## Install

```bash
npm install -g codeforge-dev-cli
```

Requires [Bun](https://bun.sh) runtime.

## Usage

```bash
codeforge <command> [options]
```

### Global Options

| Flag | Description |
|------|-------------|
| `--local` | Run against the host filesystem (skip container proxy) |
| `--container <name>` | Target a specific container by name |

When run outside a devcontainer, commands auto-proxy into the running CodeForge container. Use `--local` to bypass.

## Commands

### `codeforge session` — Session History

```bash
codeforge session search "query"       # Search session history
codeforge session list                  # List recent sessions
codeforge session show <id>             # Show session details
```

### `codeforge task` — Task Management

```bash
codeforge task search "query"           # Search tasks across sessions
codeforge task list                     # List tasks
codeforge task show <id>                # Show task details
```

### `codeforge plan` — Plan Search

```bash
codeforge plan search "query"           # Search plans across sessions
```

### `codeforge plugin` — Plugin Management

```bash
codeforge plugin list                   # List installed plugins
codeforge plugin show <name>            # Show plugin details
codeforge plugin enable <name>          # Enable a plugin
codeforge plugin disable <name>         # Disable a plugin
codeforge plugin hooks [name]           # Show hooks (all or per-plugin)
codeforge plugin agents [name]          # Show agents (all or per-plugin)
codeforge plugin skills [name]          # Show skills (all or per-plugin)
```

### `codeforge config` — Configuration

```bash
codeforge config show                   # Show current configuration
codeforge config apply                  # Deploy config files to ~/.claude/
```

### `codeforge index` — Codebase Index

```bash
codeforge index build                   # Build symbol index for current project
codeforge index search "query"          # Search the symbol index
codeforge index show <symbol>           # Show symbol details
codeforge index stats                   # Index statistics
codeforge index tree                    # Symbol tree view
codeforge index clean                   # Remove index data
```

### `codeforge container` — Devcontainer Management

These commands always run on the host (never proxied).

```bash
codeforge container up                  # Start the devcontainer
codeforge container down                # Stop the devcontainer
codeforge container rebuild             # Rebuild the devcontainer
codeforge container exec <cmd>          # Execute a command in the container
codeforge container ls                  # List running containers
codeforge container shell               # Open a shell in the container
```

## License

GPL-3.0 — see [LICENSE](../LICENSE.txt).
