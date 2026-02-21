# Claude Session Dashboard (devcontainer feature)

Installs [claude-session-dashboard](https://github.com/dlupiak/claude-session-dashboard) — a local analytics dashboard for Claude Code sessions.

## What it provides

- `claude-dashboard` command to launch the web UI
- Session browsing with full-text search and filtering
- Token usage breakdown, cost estimates, and activity heatmaps
- Tool call timeline visualization
- Per-project aggregated analytics
- Settings persisted across container rebuilds via symlink to `/workspaces/.claude-dashboard/`

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `version` | `latest` | npm package version (`latest`, `1.0.0`, or `none` to skip) |
| `port` | `3000` | Default port for the dashboard server |
| `shells` | `both` | Shell configs to add alias to (`bash`, `zsh`, `both`) |
| `username` | `automatic` | Container user to install for |

## Usage

```bash
# Start the dashboard (default port 3000)
claude-dashboard

# Start on a custom port
claude-dashboard -p 8080

# Show help
claude-dashboard --help
```

The dashboard reads session data from `~/.claude/projects/` (symlinked to `/workspaces/.claude/projects/` in this devcontainer).

## How persistence works

Dashboard settings and cache are stored at `~/.claude-dashboard/`. Since the home directory is ephemeral in devcontainers, a poststart hook symlinks `~/.claude-dashboard` → `/workspaces/.claude-dashboard/`, which is bind-mounted and survives rebuilds.
