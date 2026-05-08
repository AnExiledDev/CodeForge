# Constraints Reference

## Safety Plugins

### dangerous-command-blocker

Blocks destructive bash commands via PreToolUse hook.

**Blocked patterns include:**
- `rm -rf /`, `sudo rm`, `rm -rf *`
- `chmod 777`
- `git push --force` to main/master
- `mkfs`, `dd if=`, `:(){ :|:& };:`
- Other destructive system commands

**Behavior:** Hook returns `{"decision": "block"}` — command is rejected before execution.

### protected-files-guard

Blocks edits to sensitive files via PreToolUse hook.

**Protected patterns:**
- `.git/` directory contents
- Lock files (`package-lock.json`, `bun.lock`, `yarn.lock`, `poetry.lock`, `Cargo.lock`, `uv.lock`)
- Credential files (`.env`, `secrets/`, `credentials`)
- Generated settings (`~/.claude/settings*.json`)

**Behavior:** Edit/Write tool calls targeting protected files are blocked.

### workspace-scope-guard

Confines file operations to the current project directory.

**Behavior:**
- Write/Edit operations outside the project directory are blocked
- Read operations outside the project directory generate warnings
- Bash commands are annotated with working directory context

## Resource Limits

| Resource | Limit | Notes |
|----------|-------|-------|
| Memory | 6 GB | Hard limit set in docker-compose.yml |
| Swap | 0 | No swap available |
| Disk | Host filesystem | Bound by host disk space |

**Implications:**
- Avoid loading large files entirely into memory
- Avoid running multiple memory-intensive processes simultaneously
- Language server processes (Pyright, TSServer) consume significant memory
- Large `npm install` or `cargo build` can hit the memory ceiling

## Authentication Model

### Secrets

Secrets are individual files in `.codeforge/secrets/` (gitignored). Docker Compose mounts them at `/run/secrets/<name>`.

**Resolution order:**
1. Environment variables (e.g., Codespaces secrets)
2. Docker secrets (`.codeforge/secrets/` files)
3. Interactive login (e.g., `gh auth login`)

**Supported secrets:** `gh_token`, `npm_token`, `claude_code_oauth_token`, `openai_api_key`, `anthropic_api_key`, `deepseek_api_key`, `gemini_api_key`, `openrouter_api_key`

### Known Auth Caveat

`CLAUDE_CODE_OAUTH_TOKEN` does not work when `ANTHROPIC_API_KEY` is also set. Use one or the other.

## Container Lifecycle

### Rebuild

- Named volumes survive (credentials, config, caches)
- Container filesystem is replaced (installed packages, /tmp)
- Config re-deploys from manifest on start
- Features re-install from devcontainer.json

### Restart

- Everything survives (volumes + container filesystem)
- Config re-deploys from manifest
- Background services restart (claude-mem-worker, karma, etc.)

### What to Expect

- `apt install` packages are lost on rebuild — use devcontainer features instead
- Manual changes to `~/.claude/settings*.json` are overwritten on restart (use `.codeforge/` overrides)
- Manual changes to `~/.claude/rules/` are overwritten on restart (use manifest overrides)

## Known Limitations

- **No GUI**: Headless container — use `agent-browser` for web interaction
- **Docker-in-Docker**: Docker available but runs inside the container
- **WSL networking**: In WSL mirrored mode, Docker ports bind to all interfaces via `127.0.0.1` mapping in docker-compose.yml
- **tmux required for teams**: Agent team split panes only work inside tmux sessions
- **RTK is transparent**: Command output is automatically compressed by RTK — the AI sees compressed output, not raw. Use `command <cmd>` to bypass if raw output is needed.
