# Claude Code CLI (Native Binary)

Installs [Claude Code](https://docs.anthropic.com/en/docs/claude-code) as a native binary using Anthropic's official installer.

Unlike the npm-based installation (`ghcr.io/anthropics/devcontainer-features/claude-code`), this feature installs the native binary directly to `~/.local/bin/claude`. The binary is owned by the container user, so the in-session auto-updater works without permission issues.

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `version` | `latest` | `latest`, `stable`, or a specific semver (e.g., `2.1.52`). Set to `none` to skip. |
| `username` | `automatic` | Container user to install for. `automatic` detects from `$_REMOTE_USER`. |

## How it works

1. Downloads the official installer from `https://claude.ai/install.sh`
2. Runs it as the target user (not root)
3. The installer handles platform detection, checksum verification, and binary placement
4. Binary is installed to `~/.local/bin/claude` with versions stored in `~/.local/share/claude/versions/`

## Usage

```json
{
    "features": {
        "./features/claude-code-native": {}
    }
}
```

With version pinning:

```json
{
    "features": {
        "./features/claude-code-native": {
            "version": "2.1.52"
        }
    }
}
```

## Why native over npm?

The npm installation (`npm install -g @anthropic-ai/claude-code`) runs as root during the Docker build, creating a package owned by `root`. When the container user tries to auto-update Claude Code in-session, it fails with `EACCES` because it can't write to the root-owned package directory.

The native binary installs to `~/.local/` under the container user's ownership, so `claude update` works without elevated permissions.
