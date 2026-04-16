#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
set -euo pipefail

# Options
OMC_VERSION="${VERSION:-latest}"
USERNAME="${USERNAME:-automatic}"
AUTOSTART="${AUTOSTART:-true}"
PROVIDER_AGENTS_ONLY="${PROVIDERAGENTSONLY:-true}"

# Skip if version=none
if [ "${OMC_VERSION}" = "none" ]; then
    echo "[oh-my-claude] Skipping installation (version=none)"
    exit 0
fi

echo "[oh-my-claude] Starting installation..."

# Source NVM
if [ -f /usr/local/share/nvm/nvm.sh ]; then
    source /usr/local/share/nvm/nvm.sh
fi

# Validate npm
if ! command -v npm &>/dev/null; then
    echo "[oh-my-claude] ERROR: npm is not available"
    exit 1
fi

# Detect user (same pattern as ccr)
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

USER_HOME=$(getent passwd "${USERNAME}" | cut -d: -f6)

# Install npm package
echo "[oh-my-claude] Installing @lgcyaxi/oh-my-claude@${OMC_VERSION} globally..."
npm install -g "@lgcyaxi/oh-my-claude@${OMC_VERSION}"

# Backup settings.json before omc install (it modifies settings.json despite --skip-* flags)
SETTINGS_JSON="${USER_HOME}/.claude/settings.json"
SETTINGS_BACKUP=""
if [ -f "${SETTINGS_JSON}" ]; then
    SETTINGS_BACKUP="${SETTINGS_JSON}.omc-backup.$$"
    cp "${SETTINGS_JSON}" "${SETTINGS_BACKUP}"
    echo "[oh-my-claude] Backed up settings.json"
fi

# Run omc install to generate agents (--skip-* flags don't fully work, so we restore settings.json after)
echo "[oh-my-claude] Running omc install (agents only)..."
sudo -u "${USERNAME}" HOME="${USER_HOME}" omc install --skip-agents=false --force 2>&1 || {
    echo "[oh-my-claude] WARNING: omc install had errors (commands directory missing is expected)"
}

# Restore settings.json to undo any changes made by omc install
if [ -n "${SETTINGS_BACKUP}" ] && [ -f "${SETTINGS_BACKUP}" ]; then
    mv "${SETTINGS_BACKUP}" "${SETTINGS_JSON}"
    chown "${USERNAME}:${USERNAME}" "${SETTINGS_JSON}" 2>/dev/null || true
    echo "[oh-my-claude] Restored settings.json (omc changes reverted)"
fi

# Clean up oh-my-claude data directory (we don't need its hooks/MCP/statusline)
rm -rf "${USER_HOME}/.claude/oh-my-claude" 2>/dev/null || true
rm -rf "${USER_HOME}/.config/oh-my-claude" 2>/dev/null || true
echo "[oh-my-claude] Cleaned up oh-my-claude data directories"

# Filter agents (delete role agents, keep provider agents)
if [ "${PROVIDER_AGENTS_ONLY}" = "true" ]; then
    echo "[oh-my-claude] Filtering agents (provider-only mode)..."
    AGENTS_DIR="${USER_HOME}/.claude/agents"
    if [ -d "$AGENTS_DIR" ]; then
        for agent in sisyphus prometheus claude-reviewer claude-scout oracle \
                     ui-designer analyst librarian document-writer navigator hephaestus; do
            if [ -f "$AGENTS_DIR/${agent}.md" ]; then
                rm -f "$AGENTS_DIR/${agent}.md"
                echo "[oh-my-claude] Deleted agent: ${agent}"
            fi
        done
    fi
fi

# Note: oh-my-claude doesn't install skills/commands in current version (2.2.x)
# The commands directory doesn't exist in the npm package

# Shell activation block
OMC_BLOCK_START="# === oh-my-claude activation START (managed by install.sh — do not edit) ==="
OMC_BLOCK_END="# === oh-my-claude activation END ==="

configure_shell() {
    local shell_rc="$1"
    local shell_name="$2"

    if [ ! -f "${shell_rc}" ]; then
        sudo -u "${USERNAME}" touch "${shell_rc}"
    fi

    # Remove existing block
    if grep -q "oh-my-claude activation START" "${shell_rc}"; then
        sed -i '/oh-my-claude activation START/,/oh-my-claude activation END/d' "${shell_rc}"
    fi

    # Write activation block
    cat >> "${shell_rc}" <<OMCBLOCK
${OMC_BLOCK_START}
if command -v omc >/dev/null 2>&1; then
    eval "\$(omc activate 2>/dev/null)" || true
fi
${OMC_BLOCK_END}
OMCBLOCK

    chown "${USERNAME}:${USERNAME}" "${shell_rc}" 2>/dev/null || true
    echo "[oh-my-claude] Added activation to ${shell_name}"
}

configure_shell "${USER_HOME}/.bashrc" "bash"
configure_shell "${USER_HOME}/.zshrc" "zsh"

# Autostart hook
if [ "${AUTOSTART}" = "true" ]; then
    HOOK_DIR="/usr/local/devcontainer-poststart.d"
    mkdir -p "$HOOK_DIR"

    # Copy poststart hook
    FEATURE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [ -f "${FEATURE_DIR}/poststart-hook.sh" ]; then
        cp "${FEATURE_DIR}/poststart-hook.sh" "${HOOK_DIR}/46-oh-my-claude.sh"
        chmod +x "${HOOK_DIR}/46-oh-my-claude.sh"
        echo "[oh-my-claude] Poststart hook installed"
    fi
fi

# Verification
echo "[oh-my-claude] Verifying installation..."
if command -v omc &>/dev/null; then
    OMC_VERSION_INSTALLED=$(omc --version 2>/dev/null || echo "unknown")
    echo "[oh-my-claude] ✓ omc is installed (${OMC_VERSION_INSTALLED})"
else
    echo "[oh-my-claude] WARNING: omc command not found after install"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  oh-my-claude Installation Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Configuration:"
echo "  • User: ${USERNAME}"
echo "  • Version: ${OMC_VERSION}"
echo "  • Provider agents only: ${PROVIDER_AGENTS_ONLY}"
echo "  • Autostart: ${AUTOSTART}"
echo ""
echo "Note: Hooks and MCP server skipped during install."
echo "      CodeForge manages settings.json separately."
echo ""
echo "Usage:"
echo "  omc proxy start        # Start the proxy"
echo "  omc proxy stop         # Stop the proxy"
echo "  omc proxy status       # Check proxy status"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
