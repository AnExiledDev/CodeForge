# Filesystem Reference

## Directory Tree

```
/workspaces/                          # Bind mount from host
└── projects/
    └── <project>/                    # Working project directory
        ├── .codeforge/               # Project-level overrides (user-owned)
        │   ├── container.json        # Setup flags, identity, timezone, version lock
        │   ├── secrets/              # Docker Compose secrets (gitignored)
        │   ├── mounts.json           # Volume mount configuration
        │   └── file-manifest.json    # Override manifest entries by id
        └── .devcontainer/            # Container definition (repo-owned)
            ├── devcontainer.json     # Features, compose config
            ├── docker-compose.yml    # Image, volumes, resource limits
            ├── defaults/codeforge/   # Packaged config defaults
            │   ├── file-manifest.json
            │   ├── claude/           # Claude Code configs
            │   │   ├── settings/     # Generated settings profiles
            │   │   ├── system-prompts/
            │   │   ├── rules/
            │   │   ├── hooks/
            │   │   ├── statusline/
            │   │   └── router/
            │   ├── codex/            # Codex CLI config
            │   └── rtk/              # RTK config
            ├── plugins/              # Claude Code plugins
            ├── scripts/              # Setup and lifecycle scripts
            └── features/             # Devcontainer features

~/.claude/                            # Claude Code home (named volume)
├── settings.json                     # Symlink to active profile
├── settings-*.json                   # Model/context profiles
├── rules/                            # Auto-loaded rules (.md files)
├── hooks/                            # Hook scripts
├── projects/                         # Session data per project
└── disabled-hooks.json               # Disable specific hooks by name

~/.config/gh/                         # GitHub CLI credentials (named volume)
~/.codex/                             # Codex CLI config (named volume)
~/.claude-mem/                        # Claude-Mem data (named volume)
~/.cache/                             # Package manager caches (named volume)
```

## Volume Mounts

| Mount | Type | Survives Rebuild | Purpose |
|-------|------|-----------------|---------|
| `/workspaces` | Bind mount | Yes (host) | Source code, project configs |
| `~/.claude` | Named volume | Yes | Claude Code config, sessions, credentials |
| `~/.config/gh` | Named volume | Yes | GitHub CLI auth state |
| `~/.bun/install/cache` | Named volume | Yes | Bun package cache |
| `~/.cache` | Named volume | Yes | npm, pip, uv caches |
| `~/.codex` | Named volume | Yes | Codex CLI config |
| `~/.claude-mem` | Named volume | Yes | Claude-Mem persistent memory |

## Config Resolution Order

1. **Project overrides** — `.codeforge/<path>` (user-created, gitignored)
2. **Generated configs** — `.devcontainer/.generated/codeforge/` (auto-generated from defaults + profiles)
3. **Packaged defaults** — `.devcontainer/defaults/codeforge/` (repo-owned, version-controlled)

Config deployment happens via `file-manifest.json` on every container start. Each entry has:
- `id` — stable identifier (used by override manifests)
- `src` — source path relative to defaults directory
- `dest` — deployment target (supports `${HOME}`, `${WORKSPACE_ROOT}`, `${CODEFORGE_DIR}`)
- `overwrite` — `"if-changed"` (sha256), `"always"`, or `"never"`

## File-Manifest System

The manifest controls which config files deploy and when. Override entries by matching `id` in `.codeforge/file-manifest.json`. Set `"enabled": false` to suppress a default, or change `"src"` to deploy a different file.

## Writable vs Read-Only

| Location | Writable | Notes |
|----------|----------|-------|
| Project directory | Yes | Scope-guarded to current project |
| `.codeforge/` | Yes | User overrides |
| `/tmp/` | Yes | Ephemeral |
| `.devcontainer/defaults/` | Avoid | Use `.codeforge/` overrides instead |
| `~/.claude/settings*.json` | Avoid | Managed by manifest; changes overwritten on restart |
| `~/.claude/rules/` | Avoid | Managed by manifest |
