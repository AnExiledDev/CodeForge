#!/bin/bash
# One-time migration: /workspaces/.claude → $HOME/.claude
# Migrates config, credentials, and rules from the old bind-mount location
# to the new home directory (Docker named volume).
#
# Uses cp -a (archive) for a faithful copy that preserves permissions,
# timestamps, symlinks, and directory structure. Migration is one-time
# (marker-gated), so overwrite is safe — the old directory is authoritative.

OLD_DIR="/workspaces/.claude"
_USERNAME="${SUDO_USER:-${USER:-vscode}}"
_USER_HOME=$(getent passwd "$_USERNAME" 2>/dev/null | cut -d: -f6)
_USER_HOME="${_USER_HOME:-/home/$_USERNAME}"
NEW_DIR="${CLAUDE_CONFIG_DIR:-${_USER_HOME}/.claude}"
MARKER="$NEW_DIR/.migrated-from-workspaces"

# Nothing to migrate if old directory doesn't exist
if [ ! -d "$OLD_DIR" ]; then
    exit 0
fi

# Skip if old directory is empty (nothing worth migrating)
if [ -z "$(ls -A "$OLD_DIR" 2>/dev/null)" ]; then
    exit 0
fi

# Idempotency: skip if migration already completed
if [ -f "$MARKER" ]; then
    exit 0
fi

# Symlink protection: verify OLD_DIR itself is a real directory, not a symlink
if [ -L "$OLD_DIR" ]; then
    echo "[setup-migrate] WARNING: /workspaces/.claude is a symlink, skipping migration for safety"
    exit 0
fi

echo "[setup-migrate] Migrating /workspaces/.claude → $NEW_DIR ..."
mkdir -p "$NEW_DIR"

# -a: archive mode (-dR --preserve=all) — preserves permissions, timestamps,
#     symlinks, ownership, and directory structure faithfully.
# Errors logged explicitly (no 2>/dev/null) so failures are visible.
if cp -a "$OLD_DIR/." "$NEW_DIR/"; then
    # Fix ownership — source files may be owned by a different uid from a
    # previous container lifecycle. chown everything to the current user.
    chown -R "$(id -un):$(id -gn)" "$NEW_DIR/" 2>/dev/null || true

    # Verify critical files arrived
    MISSING=""
    [ ! -f "$NEW_DIR/.claude.json" ] && [ -f "$OLD_DIR/.claude.json" ] && MISSING="$MISSING .claude.json"
    [ ! -d "$NEW_DIR/plugins" ] && [ -d "$OLD_DIR/plugins" ] && MISSING="$MISSING plugins/"
    [ ! -f "$NEW_DIR/.credentials.json" ] && [ -f "$OLD_DIR/.credentials.json" ] && MISSING="$MISSING .credentials.json"
    if [ -n "$MISSING" ]; then
        echo "[setup-migrate] WARNING: Migration incomplete — missing:$MISSING"
        echo "[setup-migrate] Old directory preserved at $OLD_DIR for manual recovery"
        exit 1
    fi

    # Mark migration complete
    date -Iseconds > "$MARKER"

    # Rename old directory to .bak
    if mv "$OLD_DIR" "${OLD_DIR}.bak" 2>/dev/null; then
        echo "[setup-migrate] Migration complete. Old directory moved to ${OLD_DIR}.bak"
    else
        echo "[setup-migrate] Migration complete. Could not rename old directory — remove /workspaces/.claude/ manually"
    fi
else
    echo "[setup-migrate] ERROR: cp failed — check output above for details"
    echo "[setup-migrate] Old directory preserved at $OLD_DIR"
    exit 1
fi
