#!/bin/bash
set -euo pipefail

VERSION="${VERSION:-latest}"
USERNAME="${USERNAME:-automatic}"

# Skip installation if version is "none"
if [ "${VERSION}" = "none" ]; then
    echo "[agent-browser] Skipping installation (version=none)"
    exit 0
fi

# Set headless as default for containers (bundled Chromium, no display needed)
export AGENT_BROWSER_HEADLESS=true

echo "[agent-browser] Starting installation..."
echo "[agent-browser] Version: ${VERSION}"

# Source nvm if available
if [ -f /usr/local/share/nvm/nvm.sh ]; then
    source /usr/local/share/nvm/nvm.sh
fi

# Validate npm is available
if ! command -v npm &>/dev/null; then
    echo "[agent-browser] ERROR: npm not available"
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

echo "[agent-browser] Installing for user: ${USERNAME}"

# Install via npm
if [ "${VERSION}" = "latest" ]; then
    NPM_PACKAGE="agent-browser"
else
    NPM_PACKAGE="agent-browser@${VERSION}"
fi

npm install -g "${NPM_PACKAGE}" 2>/dev/null || {
    echo "[agent-browser] WARNING: Global install failed, trying user install"
    su - "${USERNAME}" -c "npm install -g ${NPM_PACKAGE}" 2>/dev/null || true
}

# Download Chromium and install system dependencies
echo "[agent-browser] Installing Chromium and system dependencies..."
agent-browser install --with-deps 2>/dev/null || {
    echo "[agent-browser] WARNING: Chromium install with deps failed, trying without --with-deps"
    agent-browser install 2>/dev/null || true
}

# Install Playwright Chromium only (not all browsers)
echo "[agent-browser] Installing Playwright Chromium..."
npx playwright install chromium --with-deps 2>/dev/null || {
    echo "[agent-browser] WARNING: Playwright chromium install with deps failed, trying without --with-deps"
    npx playwright install chromium 2>/dev/null || true
}

echo "[agent-browser] Installed: $(agent-browser --version 2>/dev/null || echo 'unknown')"
echo "[agent-browser] Installation complete"
echo ""
echo "Usage:"
echo "  agent-browser open <url>     # Open a page"
echo "  agent-browser snapshot       # Get accessibility tree"
echo "  agent-browser screenshot     # Capture screenshot"
echo "  agent-browser close          # Close browser"
echo ""
echo "Host Chrome connection (if container browser insufficient):"
echo "  # Start Chrome on host with: chrome --remote-debugging-port=9222"
echo "  agent-browser connect 9222"
