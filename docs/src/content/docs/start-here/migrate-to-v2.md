---
title: Migrate to v2
description: What changed in CodeForge v2 and how to upgrade from v1.x — configuration externalization, new file paths, and automatic migration.
sidebar:
  order: 8
---

CodeForge v2 externalizes user configuration from `.devcontainer/config/defaults/` to a new top-level `.codeforge/` directory. This separates your customizations from the DevContainer infrastructure, making updates cleaner and reducing merge conflicts.

## What Changed

In v1.x, user-customizable files lived inside `.devcontainer/config/defaults/`. This meant every CodeForge update touched the same directory as your customizations, making it hard to tell what changed and what you'd modified.

v2 moves all user config to `.codeforge/` — a directory you own. CodeForge updates modify `.devcontainer/` (infrastructure) while `.codeforge/` (your customizations) stays untouched unless you change it.

## Key Path Changes

| v1.x Path | v2 Path |
|-----------|---------|
| `.devcontainer/config/defaults/settings.json` | `.codeforge/config/settings.json` |
| `.devcontainer/config/defaults/main-system-prompt.md` | `.codeforge/config/main-system-prompt.md` |
| `.devcontainer/config/defaults/rules/` | `.codeforge/config/rules/` |
| `.devcontainer/config/file-manifest.json` | `.codeforge/file-manifest.json` |
| `.devcontainer/connect-external-terminal.sh` | `.codeforge/scripts/connect-external-terminal.sh` |
| `.devcontainer/connect-external-terminal.ps1` | `.codeforge/scripts/connect-external-terminal.ps1` |
| `CONFIG_SOURCE_DIR` env var | `CODEFORGE_DIR` env var |

## Automatic Migration

On first container start after updating to v2, the migration script (`setup-migrate-codeforge.sh`) runs automatically:

1. Detects the legacy `.devcontainer/config/defaults/` directory
2. Creates the `.codeforge/` directory structure
3. Copies all config files from `defaults/` to `.codeforge/config/`
4. Copies and rewrites `file-manifest.json` (updates internal paths)
5. Moves terminal scripts to `.codeforge/scripts/`
6. Writes a migration marker at `.codeforge/.markers/v2-migrated`

The migration is **idempotent** — if `.codeforge/` already exists, the script skips entirely. It never overwrites existing files.

## Manual Migration

If you prefer to migrate by hand:

1. **Update CodeForge:**
   ```bash
   npx @coredirective/cf-container@latest
   ```

2. **Review the new `.codeforge/` directory** created by the installer. It contains default versions of all config files.

3. **Move your customizations** from the old paths to the new paths. Only copy files you've actually modified — the installer provides fresh defaults for everything else.

4. **Update `.env`** if you set `CONFIG_SOURCE_DIR`:
   ```bash
   # Old (v1.x)
   CONFIG_SOURCE_DIR=/custom/path

   # New (v2)
   CODEFORGE_DIR=/custom/path
   ```

5. **Rebuild the container:**
   - **VS Code:** `Ctrl+Shift+P` → **Dev Containers: Rebuild Container**
   - **CLI:** `devcontainer up --workspace-folder . --remove-existing-container`

6. **Verify the migration:**
   ```bash
   check-setup
   ```

## How Updates Work in v2

CodeForge v2 uses **checksum-based modification detection** to protect your customizations during updates:

- When you run `npx @coredirective/cf-container@latest`, the installer compares each `.codeforge/` file's SHA-256 checksum against the known default.
- **Unmodified files** are updated in place with the new default.
- **Modified files** are preserved. The new default is written as a `.default` file (e.g., `settings.json.default`) for you to review and merge manually.

The `--force` flag triggers this smart sync. The `--reset` flag wipes `.devcontainer/` but preserves `.codeforge/` — your customizations are always safe.

## Breaking Changes

### `CONFIG_SOURCE_DIR` Deprecated

The `CONFIG_SOURCE_DIR` environment variable is replaced by `CODEFORGE_DIR`. If your `.env` file still sets `CONFIG_SOURCE_DIR`, the startup script:

1. Detects the stale variable
2. Overrides it internally to use the correct path
3. Auto-comments the line in `.env` with a deprecation warning

No action is required — it's handled automatically. But you should update `.env` to use `CODEFORGE_DIR` to avoid the warning.

## New Capabilities

v2 introduces several features alongside the directory restructure:

- **`codeforge config apply`** — CLI command to deploy config files to `~/.claude/` on demand (same operation that runs on container start)
- **`.codeforge-preserve`** — list additional files in `.codeforge/` that should be preserved during updates, beyond the defaults
- **Checksum tracking** — `.codeforge/.checksums/` stores SHA-256 hashes so the system knows which files you've modified

## Troubleshooting

**Migration didn't run automatically:**
- Check if `.codeforge/` already exists (the script skips if it does)
- Verify `WORKSPACE_ROOT` is set correctly (defaults to `/workspaces`)
- Run the migration script manually: `bash .devcontainer/scripts/setup-migrate-codeforge.sh`

**Config files not deploying after migration:**
- Run `codeforge config apply` to trigger a manual deployment
- Check `.codeforge/file-manifest.json` — paths should reference `config/` (not `defaults/`)

**Old `CONFIG_SOURCE_DIR` in `.env` causing issues:**
- Remove or comment the line — `CODEFORGE_DIR` is the v2 equivalent
- The startup script handles this automatically, but manual cleanup avoids the deprecation warning

## Related

- [Settings and Permissions](/customize/settings-and-permissions/) — full settings reference
- [Environment Variables](/reference/environment-variables/) — all environment variables including `CODEFORGE_DIR`
- [Changelog](/reference/changelog/) — v2.0.0 release notes
- [Architecture](/reference/architecture/) — system design and component relationships
