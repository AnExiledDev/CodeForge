# Configuration Reference

Quick reference for all CodeForge configuration options.

## Which File to Edit

| Task | File to Edit |
|------|-------------|
| Change default model | `config/defaults/settings.json` |
| Change system prompt | `config/defaults/main-system-prompt.md` |
| Customize keybindings | `config/defaults/keybindings.json` |
| Control setup steps | `.env` |
| Add custom config file | `config/file-manifest.json` |
| Disable a feature | `devcontainer.json` (set `"version": "none"`) |
| Disable a plugin | `config/defaults/settings.json` (remove from `enabledPlugins`) |
| Skip a plugin install | `.env` (`PLUGIN_BLACKLIST`) |
| Change container memory | `devcontainer.json` (`runArgs`) |
| Add VS Code extension | `devcontainer.json` (`customizations.vscode.extensions`) |

## `.env` Variables (Setup Behavior)

These control what `setup.sh` does on each container start. Copy `.env.example` to `.env` and customize.

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_CONFIG_DIR` | `/workspaces/.claude` | Where Claude Code config files are stored |
| `CONFIG_SOURCE_DIR` | `(auto-detected)` | Source directory for config defaults |
| `SETUP_CONFIG` | `true` | Copy config files per `file-manifest.json` |
| `SETUP_ALIASES` | `true` | Add cc/claude/ccraw/cc-tools aliases to shell |
| `SETUP_AUTH` | `true` | Configure Git/NPM auth from `.secrets` file |
| `SETUP_PLUGINS` | `true` | Install Anthropic plugins + register local marketplace |
| `SETUP_UPDATE_CLAUDE` | `true` | Background-update Claude Code CLI binary |
| `SETUP_PROJECTS` | `true` | Auto-detect projects for VS Code Project Manager |
| `PLUGIN_BLACKLIST` | `""` | Comma-separated plugin names to skip during installation |

## `devcontainer.json` `remoteEnv` (Container Runtime)

These environment variables are set in every terminal session inside the container.

| Variable | Value | Description |
|----------|-------|-------------|
| `WORKSPACE_ROOT` | `/workspaces` | Workspace root directory |
| `CLAUDE_CONFIG_DIR` | `/workspaces/.claude` | Claude Code config directory |
| `GH_CONFIG_DIR` | `/workspaces/.gh` | GitHub CLI config directory |
| `TMPDIR` | `/workspaces/.tmp` | Temporary files directory |

## `config/file-manifest.json` (File Copy Rules)

Each entry in the manifest array controls how a config file is deployed:

```json
{
  "src": "defaults/settings.json",
  "dest": "${CLAUDE_CONFIG_DIR}",
  "destFilename": "settings.json",
  "overwrite": "if-changed",
  "enabled": true
}
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `src` | Yes | — | Source file path relative to `config/` |
| `dest` | Yes | — | Destination directory (supports `${CLAUDE_CONFIG_DIR}`, `${WORKSPACE_ROOT}`) |
| `destFilename` | No | basename of `src` | Override the destination filename |
| `overwrite` | No | `"if-changed"` | `"always"`, `"never"`, or `"if-changed"` (sha256 comparison) |
| `enabled` | No | `true` | Set `false` to skip this entry |

## Feature Options

Each feature in `devcontainer.json` supports options defined in its `devcontainer-feature.json`. Common options:

| Option | Description | Used By |
|--------|-------------|---------|
| `version` | Tool version to install. `"none"` skips installation. | All local features |
| `username` | Container user to install for. `"automatic"` auto-detects. | dprint, ruff, ccusage, ccburn, etc. |
| `shells` | Which shell rc files to modify (`"both"`, `"bash"`, `"zsh"`). | ccusage, ccburn |

## `.secrets` File (Authentication)

Create `.devcontainer/.secrets` with tokens for automatic authentication:

```bash
GH_TOKEN=ghp_your_token_here
GH_USERNAME=your-github-username
GH_EMAIL=your-email@example.com
NPM_TOKEN=npm_your_token_here
```

Environment variables with the same names take precedence over `.secrets` file values (useful for Codespaces).
