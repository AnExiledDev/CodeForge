#!/bin/bash
# One-time migration: /workspaces/.claude → $HOME/.claude
# Only migrates if old location has .credentials.json (real auth data).

OLD_DIR="/workspaces/.claude"
NEW_DIR="$HOME/.claude"

if [ ! -d "$OLD_DIR" ]; then
    exit 0
fi

if [ ! -f "$OLD_DIR/.credentials.json" ]; then
    echo "[setup-migrate] /workspaces/.claude exists but has no .credentials.json, skipping migration"
    exit 0
fi

echo "[setup-migrate] Migrating /workspaces/.claude → $HOME/.claude ..."
mkdir -p "$NEW_DIR"
cp -rn "$OLD_DIR/." "$NEW_DIR/" 2>/dev/null || true
echo "[setup-migrate] Migration complete. You can safely remove /workspaces/.claude/"
