#!/bin/bash
set -euo pipefail

VERSION="${VERSION:-latest}"
USERNAME="${USERNAME:-automatic}"

# Skip installation if version is "none"
if [ "${VERSION}" = "none" ]; then
    echo "[ast-grep] Skipping installation (version=none)"
    exit 0
fi

echo "[ast-grep] Starting installation..."
echo "[ast-grep] Version: ${VERSION}"

# Source nvm if available
if [ -f /usr/local/share/nvm/nvm.sh ]; then
    source /usr/local/share/nvm/nvm.sh
fi

# Validate npm is available
if ! command -v npm &>/dev/null; then
    echo "[ast-grep] ERROR: npm not available"
    echo "  Ensure node feature is installed first"
    exit 1
fi

# Detect user
if [ "${USERNAME}" = "auto" ] || [ "${USERNAME}" = "automatic" ]; then
    if [ -n "${_REMOTE_USER:-}" ]; then
        USERNAME="${_REMOTE_USER}"
    elif getent passwd vscode >/dev/null 2>&1; then
        USERNAME="vscode"
    elif getent passwd node >/dev/null 2>&1; then
        USERNAME="node"
    elif getent passwd codespace >/dev/null 2>&1; then
        USERNAME="codespace"
    else
        USERNAME="root"
    fi
fi

echo "[ast-grep] Installing for user: ${USERNAME}"

# Install via npm
if [ "${VERSION}" = "latest" ]; then
    NPM_PACKAGE="@ast-grep/cli"
else
    NPM_PACKAGE="@ast-grep/cli@${VERSION}"
fi

npm install -g "${NPM_PACKAGE}" 2>/dev/null || {
    echo "[ast-grep] WARNING: Global install failed, trying user install"
    su - "${USERNAME}" -c "npm install -g ${NPM_PACKAGE}" 2>/dev/null || true
}

echo "[ast-grep] Installed: $(ast-grep --version 2>/dev/null || echo 'unknown')"
