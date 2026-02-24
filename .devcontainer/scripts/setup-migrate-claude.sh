#!/bin/bash
# One-time migration: /workspaces/.claude → $HOME/.claude
# Migrates config, credentials, and rules from the old bind-mount location
# to the new home directory (Docker named volume).
#
# Safety: uses cp -rn --no-dereference to avoid following symlinks and
# prevent overwriting files already in the destination.

OLD_DIR="/workspaces/.claude"
NEW_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

# Nothing to migrate if old directory doesn't exist
if [ ! -d "$OLD_DIR" ]; then
    exit 0
fi

# Skip if old directory is empty (nothing worth migrating)
if [ -z "$(ls -A "$OLD_DIR" 2>/dev/null)" ]; then
    exit 0
fi

# Idempotency: skip if destination already has content (migration already done)
if [ -d "$NEW_DIR" ] && [ -n "$(ls -A "$NEW_DIR" 2>/dev/null)" ]; then
    exit 0
fi

# Symlink protection: verify OLD_DIR itself is a real directory, not a symlink
if [ -L "$OLD_DIR" ]; then
    echo "[setup-migrate] WARNING: /workspaces/.claude is a symlink, skipping migration for safety"
    exit 0
fi

echo "[setup-migrate] Migrating /workspaces/.claude → $NEW_DIR ..."
mkdir -p "$NEW_DIR"

# --no-dereference: copy symlinks as symlinks (don't follow them)
# -n: no-clobber (don't overwrite existing files)
# -r: recursive
if cp -rn --no-dereference "$OLD_DIR/." "$NEW_DIR/" 2>/dev/null; then
    echo "[setup-migrate] Migration complete. You can safely remove /workspaces/.claude/"
else
    echo "[setup-migrate] WARNING: Some files may not have been copied — verify $NEW_DIR before removing /workspaces/.claude/"
fi
