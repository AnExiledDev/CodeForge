#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
# Browser opener for devcontainer environments.
#
# Set as $BROWSER so tools (gh, npm, etc.) can open URLs on the host.
# Detection order:
#   1. VS Code remote CLI (code --open-url) — works in VS Code terminals
#   2. Friendly fallback — prints the URL for manual copy
#
# Always exits 0 so the calling tool continues normally.

url="${1:?Usage: open-browser.sh <url>}"

# --- VS Code remote CLI ---
# Available when VS Code Server is running and the IPC socket is connected.
# Only works in VS Code's integrated terminal, not external terminals.
if [ -n "$VSCODE_IPC_HOOK_CLI" ] && command -v code >/dev/null 2>&1; then
    code --open-url "$url" 2>/dev/null && exit 0
fi

# --- Friendly fallback ---
# No browser available — print the URL clearly for manual copy.
echo ""
echo "  Open this URL in your browser:"
echo ""
echo "  $url"
echo ""

exit 0
