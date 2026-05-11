# claude-code-karma

Installs [Claude Code Karma](https://github.com/JayantDevkar/claude-code-karma), a local-first web dashboard for Claude Code sessions, analytics, hooks, plugins, tools, live sessions, and generated titles.

## CodeForge Boundaries

CodeForge owns `~/.claude/settings.json`. This feature patches Karma so its Settings API is read-only and cannot write Claude settings.

The only Karma-related Claude settings are baked into CodeForge's generated settings profiles:

- live session tracking hooks
- session title generation hook on `SessionEnd`
- `cleanupPeriodDays: 90`
- `alwaysThinkingEnabled: true`

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `version` | string | `4067d87ee5c85eb7d2877890ba6174115f0bee2e` | Upstream git ref to install, or `none` to skip |
| `apiPort` | string | `7848` | FastAPI backend port |
| `frontendPort` | string | `7847` | Dashboard frontend port |
| `autostart` | string | `true` | Start API and frontend on container start |
| `username` | string | `automatic` | Container user for runtime ownership |

## Usage

After container start, open the dashboard at:

```text
http://localhost:7847
```

The API runs at:

```text
http://localhost:7848
```

Useful checks:

```bash
karma-status
curl http://localhost:${CODEFORGE_KARMA_API_PORT:-7848}/health
```

## Commands

| Command | Purpose |
|---------|---------|
| `karma-status` | Show API/frontend process status and recent logs |
| `karma-live-session-tracker` | Hook wrapper for live session tracking |
| `karma-title-generator` | Hook wrapper for session title generation |

## Runtime Environment Overrides

The post-start service reads these environment variables if set:

| Variable | Default | Description |
|----------|---------|-------------|
| `CODEFORGE_KARMA_API_PORT` | `7848` | API service port |
| `CODEFORGE_KARMA_FRONTEND_PORT` | `7847` | Frontend service port |
| `CLAUDE_KARMA_API` | `http://localhost:$CODEFORGE_KARMA_API_PORT` | Title hook API URL |

If you change ports after build, rebuild the container so the frontend bundle uses the same API port.

## Data

Karma reads Claude Code data from `~/.claude/` and writes its own metadata under `~/.claude_karma/`.

Karma must not write `~/.claude/settings.json`; CodeForge's installer patches both backend and UI to keep settings read-only.
