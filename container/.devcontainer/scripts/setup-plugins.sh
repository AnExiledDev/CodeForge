#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
# Install plugins: official Anthropic + local devs-marketplace registration
#
# Individual marketplace plugins are enabled via enabledPlugins in settings.json.
# This script only handles:
# 1. Official Anthropic plugin installs (not managed by enabledPlugins)
# 2. Local marketplace registration (so Claude Code can discover devs-marketplace)

# Source .env for PLUGIN_BLACKLIST if not already set (e.g., standalone invocation)
if [ -z "${PLUGIN_BLACKLIST+x}" ]; then
    SCRIPT_DIR_INIT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    ENV_FILE="${SCRIPT_DIR_INIT}/../.env"
    if [ -f "$ENV_FILE" ]; then
        set -a
        source "$ENV_FILE"
        set +a
    fi
fi

echo "[setup-plugins] Installing plugins..."

# --- Official Anthropic Plugins ---
DEFAULT_OFFICIAL_PLUGINS="frontend-design@anthropics/claude-code code-review@anthropics/claude-code feature-dev@anthropics/claude-code pr-review-toolkit@anthropics/claude-code svelte@sveltejs/mcp"
IFS=' ' read -ra OFFICIAL_PLUGINS <<< "${OFFICIAL_PLUGINS:-$DEFAULT_OFFICIAL_PLUGINS}"

for plugin in "${OFFICIAL_PLUGINS[@]}"; do
    echo "[setup-plugins] Installing $plugin..."
    if claude plugin install "$plugin" 2>/dev/null; then
        echo "[setup-plugins] Installed: $plugin"
    else
        echo "[setup-plugins] Warning: Failed to install $plugin (may already exist)"
    fi
done

# --- Local Marketplace Registration ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETPLACE_PATH="${SCRIPT_DIR}/../plugins/devs-marketplace"

# Add local marketplace (if not already added)
# This is still needed so Claude Code can discover devs-marketplace plugins
# listed in enabledPlugins in settings.json
if ! claude plugin marketplace list 2>/dev/null | grep -q "devs-marketplace"; then
    echo "[setup-plugins] Adding devs-marketplace..."
    claude plugin marketplace add "$MARKETPLACE_PATH" 2>/dev/null || {
        echo "[setup-plugins] WARNING: Failed to add marketplace"
    }
fi

# --- Install/Update devs-marketplace plugins (syncs cache from source) ---
# enabledPlugins in settings.json controls enabled/disabled state, but plugins
# must be explicitly installed to populate the cache. This loop ensures the
# cache stays in sync with the source directory on every container start.
if [ -d "$MARKETPLACE_PATH/plugins" ]; then
    for plugin_dir in "$MARKETPLACE_PATH"/plugins/*/; do
        plugin_name=$(basename "$plugin_dir")

        # Skip blacklisted plugins
        if echo ",${PLUGIN_BLACKLIST}," | grep -q ",$plugin_name,"; then
            echo "[setup-plugins] Skipping $plugin_name (blacklisted)"
            continue
        fi

        echo "[setup-plugins] Installing $plugin_name@devs-marketplace..."
        claude plugin install "$plugin_name@devs-marketplace" 2>/dev/null || {
            echo "[setup-plugins] Warning: Failed to install $plugin_name"
        }
    done
fi

echo "[setup-plugins] Plugin installation complete"
