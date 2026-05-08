# CodeForge Container — AI Context

## Environment

- Debian-based devcontainer, `vscode` user, `bash` shell
- Memory: 6 GB hard limit, no swap
- Workspace: `/workspaces/` (bind mount from host)
- Projects: `/workspaces/projects/<name>/`

## Filesystem

| Path | Purpose | Persistence |
|------|---------|-------------|
| `/workspaces/` | Host-synced workspace (bind mount) | Host filesystem |
| `~/.claude/` | Claude Code config, sessions, rules | Named volume (survives rebuild) |
| `~/.config/gh/` | GitHub CLI credentials | Named volume |
| `~/.bun/` | Bun cache | Named volume |
| `~/.cache/` | General caches (uv, npm, pip) | Named volume |
| `~/.codex/` | Codex CLI config | Named volume |
| `~/.claude-mem/` | Claude-Mem persistent memory | Named volume |
| `.codeforge/` | Project-level config overrides | In workspace (host-synced) |
| `/tmp/` | Ephemeral scratch space | Lost on rebuild |

Config resolution: `.codeforge/` overrides → `.devcontainer/defaults/codeforge/` defaults.

## Toolchain

| Category | Tools |
|----------|-------|
| Languages | Python 3, Node.js (LTS), Go, Rust, Bun |
| Dev tools | gh, docker, git, jq, curl, tmux, uv, npm, pip |
| Formatters | biome, ruff, shfmt, dprint |
| Linters | shellcheck, hadolint, ruff, biome |
| Code intelligence | ast-grep, tree-sitter, Pyright |
| AI tools | claude (Claude Code), codeforge, codex, hermes, agent-browser |

## Constraints

- **Blocked commands**: Destructive bash blocked by `dangerous-command-blocker` plugin (rm -rf, sudo rm, chmod 777, force push, etc.)
- **Protected files**: `.git/`, lock files, credentials blocked by `protected-files-guard` plugin
- **Scope restriction**: Writes confined to project directory by `workspace-scope-guard` plugin
- **Memory**: 6 GB hard limit, no swap — avoid memory-intensive operations
- **No apt installs**: Use devcontainer features for system packages

## Authentication

- **GitHub**: `gh auth login` or `.codeforge/secrets/gh_token`
- **Claude Code**: `.codeforge/secrets/claude_code_oauth_token`
- **API keys**: Individual files in `.codeforge/secrets/` (gh_token, npm_token, claude_code_oauth_token, openai_api_key, anthropic_api_key, deepseek_api_key, gemini_api_key, openrouter_api_key)
- All credentials persist via Docker named volumes across rebuilds

## Persistence Model

| Layer | Survives rebuild | Examples |
|-------|-----------------|----------|
| Named volumes | Yes | ~/.claude, ~/.config/gh, caches |
| Bind mount | Yes (host-synced) | /workspaces |
| Container filesystem | No | /tmp, installed packages |

## Anti-Patterns

- Don't install packages with `apt` (use devcontainer features)
- Don't modify `.devcontainer/defaults/` (use `.codeforge/` overrides)
- Don't assume unlimited memory (6 GB, no swap)
- Don't write outside the project directory (scope guard blocks it)
- Don't hardcode tool versions (they update on rebuild)
