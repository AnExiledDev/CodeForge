#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
set -euo pipefail

VERSION="${VERSION:-latest}"

# Skip installation if version is "none"
if [ "${VERSION}" = "none" ]; then
    echo "[codeforge-cli] Skipping installation (version=none)"
    exit 0
fi

echo "[codeforge-cli] Starting installation..."
echo "[codeforge-cli] Version: ${VERSION}"

# Source NVM if available
if [ -f /usr/local/share/nvm/nvm.sh ]; then
    set +u
    source /usr/local/share/nvm/nvm.sh
    set -u
fi

# Validate npm is available
if ! command -v npm &>/dev/null; then
    echo "[codeforge-cli] ERROR: npm not found. Ensure Node.js is installed." >&2
    exit 1
fi

# Install CodeForge CLI globally via npm
if [ "${VERSION}" = "latest" ]; then
    npm install -g codeforge-dev-cli
else
    npm install -g "codeforge-dev-cli@${VERSION}"
fi
npm cache clean --force 2>/dev/null || true

# Verify installation
codeforge --version

echo "[codeforge-cli] Installation complete"
