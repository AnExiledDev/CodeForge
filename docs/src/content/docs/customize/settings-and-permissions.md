---
title: Settings and Permissions
description: Configure session behavior in settings.json, including model defaults, permissions, plugin toggles, and status line settings.
sidebar:
  order: 1
---

The main runtime configuration file is `.codeforge/config/settings.json`.

Use it to control how Claude Code behaves inside CodeForge.

## Core Settings

Common fields include:

```json
{
  "model": "opus[1m]",
  "effortLevel": "high",
  "cleanupPeriodDays": 60,
  "autoCompact": true,
  "alwaysThinkingEnabled": true,
  "teammateMode": "auto",
  "includeCoAuthoredBy": false
}
```

## Permissions

The `permissions` block controls what Claude can do without asking:

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

Key fields:

- `allow` for automatically allowed operations
- `deny` for always-blocked operations
- `ask` for confirmation-required operations
- `defaultMode` for the session's default approval mode

## Plugin Toggles

Enable or disable plugins in `enabledPlugins`:

```json
{
  "enabledPlugins": {
    "agent-system@devs-marketplace": true,
    "skill-engine@devs-marketplace": true,
    "auto-code-quality@devs-marketplace": true
  }
}
```

Set any entry to `false` to disable it without uninstalling it.

## Environment Block

`settings.json` can also set environment variables that influence Claude Code internals:

```json
{
  "env": {
    "ANTHROPIC_MODEL": "claude-opus-4-6[1m]",
    "BASH_DEFAULT_TIMEOUT_MS": "120000",
    "CLAUDE_CODE_ENABLE_TASKS": "true"
  }
}
```

For the full list, use [Environment Variables](/reference/environment-variables/).

## Status Line

Status line behavior is also configured in `settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "/usr/local/bin/ccstatusline-wrapper"
  }
}
```

## Configuration Precedence

When the same setting exists in more than one place, precedence is:

1. environment variables
2. project config in `.codeforge/config/`
3. shipped defaults

## Related

- [Container Configuration](./container-configuration/)
- [Secrets and Auth](./secrets-and-auth/)
- [Optional Components](./optional-components/)
