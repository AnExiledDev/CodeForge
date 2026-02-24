---
title: Configuration
description: CodeForge configuration through settings.json, environment variables, and feature flags.
sidebar:
  order: 2
---

CodeForge configuration is spread across three files that each control a different aspect of the environment: `settings.json` for Claude Code behavior, `devcontainer.json` for container setup, and `file-manifest.json` for config file deployment.

## settings.json

The primary configuration file lives at `.devcontainer/config/defaults/settings.json`. It is deployed to `.claude/settings.json` on every container start and controls Claude Code's runtime behavior.

### Core Settings

```json
{
  "model": "opus",
  "effortLevel": "high",
  "cleanupPeriodDays": 60,
  "autoCompact": true,
  "alwaysThinkingEnabled": true,
  "teammateMode": "auto",
  "includeCoAuthoredBy": false
}
```

| Setting | Purpose | Default |
|---------|---------|---------|
| `model` | Default Claude model (`opus`, `sonnet`, `haiku`) | `opus` |
| `effortLevel` | Response effort (`low`, `medium`, `high`) | `high` |
| `cleanupPeriodDays` | Days before old session data is cleaned up | `60` |
| `autoCompact` | Automatically compact context when it gets long | `true` |
| `alwaysThinkingEnabled` | Enable extended thinking for all responses | `true` |
| `teammateMode` | Agent Teams mode (`auto`, `manual`, `off`) | `auto` |

### Environment Variables Block

The `env` block sets environment variables that configure Claude Code internals:

```json
{
  "env": {
    "ANTHROPIC_MODEL": "claude-opus-4-6",
    "BASH_DEFAULT_TIMEOUT_MS": "240000",
    "CLAUDE_CODE_MAX_OUTPUT_TOKENS": "64000",
    "MAX_THINKING_TOKENS": "63999",
    "CLAUDE_CODE_SHELL": "zsh",
    "CLAUDE_CODE_EFFORT_LEVEL": "high",
    "CLAUDE_CODE_ENABLE_TASKS": "true",
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

See [Environment Variables](../reference/environment/) for the complete list of available variables and their effects.

### Permissions

The `permissions` block controls what Claude Code can do without asking:

```json
{
  "permissions": {
    "allow": ["Read(/workspaces/*)", "WebFetch(domain:*)"],
    "deny": [],
    "ask": [],
    "defaultMode": "plan",
    "additionalDirectories": []
  }
}
```

- **allow** -- Operations that proceed without user confirmation
- **deny** -- Operations that are always blocked
- **ask** -- Operations that prompt for confirmation each time
- **defaultMode** -- Starting permission mode (`plan` means Claude proposes before acting)

### Plugin Toggles

The `enabledPlugins` section controls which plugins are active:

```json
{
  "enabledPlugins": {
    "agent-system@devs-marketplace": true,
    "skill-engine@devs-marketplace": true,
    "spec-workflow@devs-marketplace": true,
    "session-context@devs-marketplace": true,
    "auto-code-quality@devs-marketplace": true,
    "dangerous-command-blocker@devs-marketplace": true,
    "protected-files-guard@devs-marketplace": true,
    "workspace-scope-guard@devs-marketplace": true,
    "notify-hook@devs-marketplace": true,
    "ticket-workflow@devs-marketplace": true,
    "codeforge-lsp@devs-marketplace": true,
    "frontend-design@claude-plugins-official": true
  }
}
```

Set any plugin to `false` to disable it. The plugin remains installed but its hooks will not fire.

### Status Line

The `statusLine` block configures the terminal status bar:

```json
{
  "statusLine": {
    "type": "command",
    "command": "/usr/local/bin/ccstatusline-wrapper"
  }
}
```

## file-manifest.json

The file manifest at `.devcontainer/config/file-manifest.json` controls which configuration files are deployed to `.claude/` and how they are updated. Each entry specifies a source file, a destination, and an overwrite strategy:

```json
[
  {
    "src": "defaults/settings.json",
    "dest": "${CLAUDE_CONFIG_DIR}",
    "enabled": true,
    "overwrite": "if-changed"
  },
  {
    "src": "defaults/main-system-prompt.md",
    "dest": "${CLAUDE_CONFIG_DIR}",
    "enabled": true,
    "overwrite": "if-changed"
  },
  {
    "src": "defaults/rules/spec-workflow.md",
    "dest": "${CLAUDE_CONFIG_DIR}/rules",
    "enabled": true,
    "overwrite": "if-changed"
  }
]
```

### Overwrite Modes

| Mode | Behavior |
|------|----------|
| `if-changed` | Overwrites only when the source file's SHA-256 hash differs from the deployed copy. This is the default and recommended mode. |
| `always` | Overwrites on every container start, regardless of changes |
| `never` | Copies only if the destination does not exist. User edits are always preserved. |

:::tip[Preserving Your Edits]
If you customize a deployed file (like `settings.json` or the system prompt) and want your changes to survive container rebuilds, change its overwrite mode to `"never"` in `file-manifest.json`.
:::

### Adding a New Config File

To deploy a new file to `.claude/` automatically:

1. Place the file in `.devcontainer/config/defaults/`
2. Add an entry to `file-manifest.json`
3. Rebuild the container

## devcontainer.json

The DevContainer configuration at `.devcontainer/devcontainer.json` defines the container itself: base image, installed features, VS Code settings, port forwarding, and resource limits.

### Base Image and Resources

```json
{
  "image": "mcr.microsoft.com/devcontainers/python:3.14",
  "runArgs": ["--memory=6g", "--memory-swap=12g"],
  "remoteUser": "vscode",
  "containerUser": "vscode"
}
```

### Feature Installation

DevContainer features install runtimes and tools. CodeForge pins external features to specific versions for reproducibility:

```json
{
  "features": {
    "ghcr.io/devcontainers/features/node:1.7.1": { "version": "lts" },
    "ghcr.io/devcontainers/features/rust:1.5.0": { "version": "latest" },
    "ghcr.io/anthropics/devcontainer-features/claude-code:1.0.5": {},
    "./features/ruff": { "version": "latest" },
    "./features/ccms": {}
  }
}
```

:::tip[Disabling a Feature]
Any local feature (those starting with `./features/`) can be disabled by setting `"version": "none"`. The feature's install script will skip entirely.
:::

### Secrets

Optional secrets can be declared for VS Code Codespaces or other DevContainer hosts:

```json
{
  "secrets": {
    "GH_TOKEN": {
      "description": "GitHub Personal Access Token (optional)",
      "documentationUrl": "https://github.com/settings/tokens"
    },
    "NPM_TOKEN": {
      "description": "NPM auth token (optional)"
    },
    "GH_USERNAME": {
      "description": "GitHub username for git config (optional)"
    },
    "GH_EMAIL": {
      "description": "GitHub email for git config (optional)"
    }
  }
}
```

## Configuration Precedence

When the same setting is defined at multiple levels, the most specific value wins:

1. **Environment variables** (per-session or shell profile) -- highest precedence
2. **Project settings** (`.devcontainer/config/` in the current project)
3. **Default settings** (shipped with CodeForge)

For example, setting `ANTHROPIC_MODEL=claude-sonnet-4-5-20250929` in your shell overrides whatever is configured in `settings.json`.

## Related

- [Environment Variables](../reference/environment/) -- complete env var reference
- [System Prompts](./system-prompts/) -- configure Claude's behavioral guidelines
- [Plugins](../plugins/) -- per-plugin configuration options
- [Architecture](../reference/architecture/) -- how configuration layers compose at runtime
