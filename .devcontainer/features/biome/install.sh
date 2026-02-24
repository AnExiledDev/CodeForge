#!/bin/bash
set -euo pipefail

VERSION="${VERSION:-latest}"

# Skip installation if version is "none"
if [ "${VERSION}" = "none" ]; then
    echo "[biome] Skipping installation (version=none)"
    exit 0
fi

echo "[biome] Starting installation..."
echo "[biome] Version: ${VERSION}"

# Source NVM if available
if [ -f /usr/local/share/nvm/nvm.sh ]; then
    set +u
    source /usr/local/share/nvm/nvm.sh
    set -u
fi

# Validate npm is available
if ! command -v npm &>/dev/null; then
    echo "[biome] ERROR: npm not found. Ensure Node.js is installed." >&2
    exit 1
fi

# Install Biome globally via npm
if [ "${VERSION}" = "latest" ]; then
    npm install -g @biomejs/biome
else
    npm install -g "@biomejs/biome@${VERSION}"
fi

# Verify installation
biome --version

echo "[biome] Installation complete"
