---
title: Migrate to v2/v3
description: What changed in CodeForge configuration layout and how to upgrade safely.
sidebar:
  order: 8
---

CodeForge now uses a defaults-plus-overrides model.

- Packaged defaults live in `.devcontainer/defaults/codeforge/`
- Generated Claude settings live in `.devcontainer/.generated/codeforge/claude/settings/`
- `.codeforge/` is a minimal user-owned overrides/state directory with `README.md`, `.markers/`, `.checksums/`, and `data/`

`.codeforge/` is no longer a copied defaults tree.

## Key Path Changes

| Old Path | New Path |
|----------|----------|
| `.codeforge/config/settings.base.json` | `.codeforge/claude/settings/base.json` |
| `.codeforge/config/settings-profiles/*.json` | `.codeforge/claude/settings/profiles/*.json` |
| `.codeforge/config/main-system-prompt.md` | `.codeforge/claude/system-prompts/main.md` |
| `.codeforge/config/writing-system-prompt.md` | `.codeforge/claude/system-prompts/writing.md` |
| `.codeforge/config/orchestrator-system-prompt.md` | `.codeforge/claude/system-prompts/orchestrator.md` |
| `.codeforge/config/rules/` | `.codeforge/claude/rules/` |
| `.codeforge/config/hooks/` | `.codeforge/claude/hooks/` |
| `.codeforge/config/ccstatusline-settings.json` | `.codeforge/claude/statusline/settings.json` |
| `.codeforge/config/claude-code-router.json` | `.codeforge/claude/router/config.json` |
| `.codeforge/config/codex-config.toml` | `.codeforge/codex/config.toml` |
| `.codeforge/config/codex-rtk-awareness.md` | `.codeforge/codex/AGENTS.md` |
| `.codeforge/config/rtk-config.toml` | `.codeforge/rtk/config.toml` |

## Automatic Migration

On container start, setup runs two migration steps:

1. `setup-migrate-codeforge.sh` ensures the minimal `.codeforge/` scaffold exists.
2. `setup-migrate-codeforge-v3.sh` moves known old override files into the new layout.

The v3 migration writes:

- marker: `.codeforge/.markers/config-layout-v3`
- report: `.codeforge/.markers/config-layout-v3-report.md`
- backup: `.codeforge/backups/config-layout-v3-<timestamp>/`

If the marker already exists, the v3 migration skips. Generated full settings files such as old `settings.json` and `settings-opus-*.json` are not treated as source of truth; they are reported for audit instead.

## Settings Generation

Settings are generated from:

- `.devcontainer/defaults/codeforge/claude/settings/base.json`
- `.devcontainer/defaults/codeforge/claude/settings/profiles/*.json`
- optional matching overrides under `.codeforge/claude/settings/`

Generated files are written to `.devcontainer/.generated/codeforge/claude/settings/` and deployed to `~/.claude/settings*.json`.

The default profile is `opus-46-200k`; generated `settings.json` matches `settings-opus-46-200k.json`. Alias launch checks `.codeforge/.markers/settings-generated-v3` and regenerates settings if sources are stale.

## Manifest Overrides

The default manifest lives at `.devcontainer/defaults/codeforge/file-manifest.json`. A project may add `.codeforge/file-manifest.json` to override manifest entries by stable `id`.

Examples:

```json
[
  {
    "id": "claude.system-prompts.main",
    "src": "claude/system-prompts/main.md",
    "overwrite": "never"
  },
  {
    "id": "claude.rule.session-search",
    "disabled": true
  }
]
```

Source resolution checks `.codeforge/<src>` first, then generated output, then packaged defaults.

## Troubleshooting

**Settings are stale:** run `bash .devcontainer/scripts/ensure-settings-generated.sh --force`.

**Config did not deploy:** run `codeforge config apply` or `bash .devcontainer/scripts/setup-config.sh`.

**Migration did not run:** check for `.codeforge/.markers/config-layout-v3`. Remove only if you intentionally want to re-run migration after restoring the old layout from backup.

## Related

- [Settings and Permissions](/customize/settings-and-permissions/)
- [System Prompts](/customize/system-prompts/)
- [Environment Variables](/reference/environment-variables/)
- [Changelog](/reference/changelog/)
