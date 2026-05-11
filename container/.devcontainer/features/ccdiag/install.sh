#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
set -euo pipefail

# === IMPORT OPTIONS ===
CCDIAG_VERSION="${VERSION:-latest}"
USERNAME="${USERNAME:-automatic}"

# Skip installation if version is "none"
if [ "${CCDIAG_VERSION}" = "none" ]; then
    echo "[ccdiag] Skipping installation (version=none)"
    exit 0
fi

echo "[ccdiag] Starting ccdiag installation..."

# === SOURCE NVM ===
if [ -f /usr/local/share/nvm/nvm.sh ]; then
    source /usr/local/share/nvm/nvm.sh
fi

# === VALIDATE DEPENDENCIES ===
if ! go version &>/dev/null; then
    echo "[ccdiag] ERROR: Go is not available"
    echo "  Ensure the Go feature is installed first"
    echo "  (ghcr.io/devcontainers/features/go)"
    exit 1
fi

# === DETECT USER ===
if [ "${USERNAME}" = "auto" ] || [ "${USERNAME}" = "automatic" ]; then
    USERNAME=""
    for CURRENT_USER in vscode node codespace; do
        if id -u "${CURRENT_USER}" >/dev/null 2>&1; then
            USERNAME=${CURRENT_USER}
            break
        fi
    done
    [ -z "${USERNAME}" ] && USERNAME=root
elif [ "${USERNAME}" = "none" ] || ! id -u "${USERNAME}" >/dev/null 2>&1; then
    USERNAME=root
fi

echo "[ccdiag] Installing for user: ${USERNAME}"

# === GET USER HOME ===
USER_HOME=$(getent passwd "${USERNAME}" | cut -d: -f6)
if [ ! -d "${USER_HOME}" ]; then
    echo "[ccdiag] ERROR: Home directory not found for user ${USERNAME}"
    exit 1
fi

# === INSTALL VIA GO ===
export GOPATH=/tmp/go-install

echo "[ccdiag] Installing ccdiag via go install..."
INSTALL_SUCCESS=false

# Try @latest first (tagged release)
if [ "${CCDIAG_VERSION}" = "latest" ]; then
    if GOPATH=/tmp/go-install go install github.com/kolkov/ccdiag/cmd/ccdiag@latest 2>/dev/null; then
        INSTALL_SUCCESS=true
        echo "[ccdiag] Installed via @latest"
    elif GOPATH=/tmp/go-install go install github.com/kolkov/ccdiag/cmd/ccdiag@main 2>/dev/null; then
        INSTALL_SUCCESS=true
        echo "[ccdiag] Installed via @main (fallback)"
    fi
else
    if GOPATH=/tmp/go-install go install "github.com/kolkov/ccdiag/cmd/ccdiag@${CCDIAG_VERSION}" 2>/dev/null; then
        INSTALL_SUCCESS=true
        echo "[ccdiag] Installed via @${CCDIAG_VERSION}"
    elif GOPATH=/tmp/go-install go install github.com/kolkov/ccdiag/cmd/ccdiag@main 2>/dev/null; then
        INSTALL_SUCCESS=true
        echo "[ccdiag] Installed via @main (fallback)"
    fi
fi

if [ "${INSTALL_SUCCESS}" = "false" ]; then
    echo "[ccdiag] WARNING: Could not install ccdiag"
    echo "  go install failed for both @latest and @main"
    echo "  The container build will continue without ccdiag"
    rm -rf /tmp/go-install
    exit 0
fi

# === DEPLOY BINARY ===
cp /tmp/go-install/bin/ccdiag /usr/local/bin/ccdiag
chmod +x /usr/local/bin/ccdiag
chown "${USERNAME}:${USERNAME}" /usr/local/bin/ccdiag

# === CLEANUP ===
rm -rf /tmp/go-install

# === VERIFICATION ===
echo "[ccdiag] Verifying installation..."
if ccdiag --help &>/dev/null; then
    echo "[ccdiag] ✓ ccdiag is available"
else
    echo "[ccdiag] WARNING: ccdiag binary installed but --help failed"
    echo "  The binary may require runtime dependencies"
fi

# === SUMMARY ===
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ccdiag Installation Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Configuration:"
echo "  • User: ${USERNAME}"
echo "  • Version: ${CCDIAG_VERSION}"
echo "  • Binary: /usr/local/bin/ccdiag"
echo ""
echo "Usage:"
echo "  ccdiag orphans     # Find orphaned tool calls"
echo "  ccdiag errors      # Analyze session errors"
echo "  ccdiag tokens      # Token usage breakdown"
echo "  ccdiag proxy       # Launch API proxy"
echo "  ccdiag --help      # Full options"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
