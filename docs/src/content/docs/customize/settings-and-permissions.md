---
title: Settings and Permissions
description: Configure session behavior in settings.json, including model defaults, permissions, plugin toggles, and status line settings.
sidebar:
  order: 1
---

Claude settings are generated, not hand-authored as a full `settings.json`.

Packaged inputs live under `.devcontainer/defaults/codeforge/claude/settings/`:

- `base.json` for shared settings, permissions, hooks, plugin toggles, and status line wiring
- `profiles/*.json` for model-specific overlays

Project overrides live under `.codeforge/claude/settings/` using the same logical paths. For example, create `.codeforge/claude/settings/base.json` to replace the packaged base, or `.codeforge/claude/settings/profiles/opus-46-200k.json` to replace one model overlay.

The generator writes final files to `.devcontainer/.generated/codeforge/claude/settings/`, and setup deploys them to `~/.claude/settings*.json`.

## Core Settings

Common fields include:

```json
{
  "model": "opus[1m]",
  "effortLevel": "high",
  "cleanupPeriodDays": 90,
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

Generated `settings.json` can also set environment variables that influence Claude Code internals:

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

## Karma Settings Boundary

Claude Code Karma is installed by default and can display the active Claude settings. CodeForge patches Karma so the Settings page and Settings API are read-only.

Persistent setting changes belong in `.codeforge/claude/settings/base.json` or a profile override under `.codeforge/claude/settings/profiles/`. Shipped defaults live in `.devcontainer/defaults/codeforge/claude/settings/`. Do not rely on Karma to modify `~/.claude/settings.json`.

## Model Profiles

The default profile is `opus-46-200k`. Generated `settings.json` is intentionally identical to `settings-opus-46-200k.json`.

Aliases map to generated files:

- `cc`, `ccw`, `cc-orc`: `settings.json`
- `cc6`, `ccw6`, `cc-orc6`: `settings-opus-46-200k.json`
- `cc61`, `ccw61`, `cc-orc61`: `settings-opus-46-1m-400k.json`
- `cc7`, `ccw7`, `cc-orc7`: `settings-opus-47-200k.json`
- `cc71`, `ccw71`, `cc-orc71`: `settings-opus-47-1m-400k.json`
- `cc5`, `ccw5`, `cc-orc5`: `settings-opus-45-200k.json`

Non-1M profiles set `CLAUDE_CODE_DISABLE_1M_CONTEXT=1`; 1M profiles do not set that flag.

## Configuration Precedence

When the same setting exists in more than one place, precedence is:

1. environment variables
2. project overrides in `.codeforge/claude/settings/`
3. generated settings in `.devcontainer/.generated/codeforge/claude/settings/`
4. shipped defaults in `.devcontainer/defaults/codeforge/claude/settings/`

CodeForge writes `.codeforge/.markers/settings-generated-v3` after generation. Alias launch performs a fast mtime check against that marker and regenerates settings before launching Claude if sources are stale.

## Related

- [Container Configuration](./container-configuration/)
- [Secrets and Auth](./secrets-and-auth/)
- [Optional Components](./optional-components/)
