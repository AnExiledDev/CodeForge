#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
set -euo pipefail

# ==============================
# Claude Session Dashboard
# DevContainer Feature Installer
# ==============================

# === IMPORT OPTIONS ===
DASHBOARD_VERSION="${VERSION:-latest}"
PORT="${PORT:-7847}"
SHELLS="${SHELLS:-both}"
USERNAME="${USERNAME:-automatic}"

# === SKIP IF DISABLED ===
if [ "${DASHBOARD_VERSION}" = "none" ]; then
    echo "[claude-session-dashboard] Skipping installation (version=none)"
    exit 0
fi

echo "[claude-session-dashboard] Starting installation..."

# === SOURCE NVM ===
if [ -f /usr/local/share/nvm/nvm.sh ]; then
    source /usr/local/share/nvm/nvm.sh
fi

# === VALIDATE DEPENDENCIES ===
if ! command -v npm &>/dev/null; then
    echo "[claude-session-dashboard] ERROR: npm is not available"
    echo "  Ensure the node feature is installed first"
    exit 1
fi

NODE_MAJOR="$(node --version 2>/dev/null | sed 's/v\([0-9]*\).*/\1/' || echo 0)"
if [ "${NODE_MAJOR}" -lt 18 ]; then
    echo "[claude-session-dashboard] ERROR: Node.js >= 18 required (found v${NODE_MAJOR})"
    exit 1
fi

# === VALIDATE INPUT ===
if [[ ! "${SHELLS}" =~ ^(bash|zsh|both)$ ]]; then
    echo "[claude-session-dashboard] ERROR: shells must be 'bash', 'zsh', or 'both'"
    exit 1
fi

if [[ ! "${DASHBOARD_VERSION}" =~ ^[a-zA-Z0-9._-]+$ ]]; then
    echo "[claude-session-dashboard] ERROR: version contains invalid characters"
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

USER_HOME=$(eval echo "~${USERNAME}")
if [ ! -d "${USER_HOME}" ]; then
    echo "[claude-session-dashboard] ERROR: Home directory not found for user ${USERNAME}"
    exit 1
fi

echo "[claude-session-dashboard] Installing for user: ${USERNAME}"

# === INSTALL VIA NPM ===
echo "[claude-session-dashboard] Installing claude-session-dashboard@${DASHBOARD_VERSION} globally..."
npm install -g "claude-session-dashboard@${DASHBOARD_VERSION}"

# === PERSISTENCE SYMLINK (POSTSTART HOOK) ===
# Settings/cache live at ~/.claude-dashboard, which is ephemeral (/home/vscode).
# Create a poststart hook to symlink it to /workspaces/.claude-dashboard for persistence.
POSTSTART_DIR="/usr/local/devcontainer-poststart.d"
HOOK_SCRIPT="${POSTSTART_DIR}/claude-dashboard-symlink.sh"

mkdir -p "${POSTSTART_DIR}"
cat > "${HOOK_SCRIPT}" << 'HOOKEOF'
#!/bin/bash
# Symlink ~/.claude-dashboard → /workspaces/.claude-dashboard for persistence
DASHBOARD_DATA="/workspaces/.claude-dashboard"
USER_HOME="${HOME:-/home/vscode}"
LINK_PATH="${USER_HOME}/.claude-dashboard"

mkdir -p "${DASHBOARD_DATA}"

# Already correct symlink — nothing to do
if [ -L "${LINK_PATH}" ]; then
    CURRENT_TARGET="$(readlink "${LINK_PATH}")"
    if [ "${CURRENT_TARGET}" = "${DASHBOARD_DATA}" ]; then
        exit 0
    fi
    rm "${LINK_PATH}"
fi

# Real directory exists — merge contents, then replace with symlink
if [ -d "${LINK_PATH}" ]; then
    cp -rn "${LINK_PATH}/." "${DASHBOARD_DATA}/" 2>/dev/null || true
    rm -rf "${LINK_PATH}"
fi

ln -s "${DASHBOARD_DATA}" "${LINK_PATH}"
HOOKEOF
chmod +x "${HOOK_SCRIPT}"
echo "[claude-session-dashboard] Created poststart hook for settings persistence"

# === SHELL ALIASES ===
ALIAS_CMD="alias claude-dashboard=\"claude-dashboard --host 0.0.0.0 --port ${PORT}\""

configure_shell() {
    local shell_rc="$1"
    local shell_name="$2"

    if [ ! -f "${shell_rc}" ]; then
        echo "[claude-session-dashboard] Creating ${shell_name} config: ${shell_rc}"
        sudo -u "${USERNAME}" touch "${shell_rc}"
    fi

    if grep -q "alias claude-dashboard=" "${shell_rc}"; then
        echo "[claude-session-dashboard] ${shell_name} alias already configured. Skipping..."
    else
        echo "[claude-session-dashboard] Adding alias to ${shell_name}"
        echo "${ALIAS_CMD}" >> "${shell_rc}"
        chown "${USERNAME}:${USERNAME}" "${shell_rc}" 2>/dev/null || true
    fi
}

if [ "${SHELLS}" = "bash" ] || [ "${SHELLS}" = "both" ]; then
    configure_shell "${USER_HOME}/.bashrc" "bash"
fi

if [ "${SHELLS}" = "zsh" ] || [ "${SHELLS}" = "both" ]; then
    configure_shell "${USER_HOME}/.zshrc" "zsh"
fi

# === VERIFICATION ===
echo "[claude-session-dashboard] Verifying installation..."
if command -v claude-dashboard &>/dev/null; then
    INSTALLED_VERSION="$(claude-dashboard --version 2>/dev/null || echo "unknown")"
    echo "[claude-session-dashboard] ✓ claude-dashboard installed (${INSTALLED_VERSION})"
else
    echo "[claude-session-dashboard] WARNING: claude-dashboard not found in PATH"
    echo "  The global npm install may need PATH adjustment"
    echo "  Try: npx claude-session-dashboard --version"
fi

# === SUMMARY ===
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Claude Session Dashboard Installation Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Configuration:"
echo "  • User: ${USERNAME}"
echo "  • Version: ${DASHBOARD_VERSION}"
echo "  • Default port: ${PORT}"
echo "  • Shells: ${SHELLS}"
echo "  • Settings persist to: /workspaces/.claude-dashboard/"
echo ""
echo "Usage:"
echo "  claude-dashboard           # Start on port ${PORT}"
echo "  claude-dashboard -p 8080   # Start on custom port"
echo "  claude-dashboard --help    # Full options"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
