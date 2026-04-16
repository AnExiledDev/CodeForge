#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
set -euo pipefail

# === SETUP ===
cleanup() {
    :
}
trap cleanup EXIT

# === IMPORT OPTIONS ===
CCR_VERSION="${VERSION:-latest}"
SHELLS="${SHELLS:-both}"
USERNAME="${USERNAME:-automatic}"
AUTOSTART="${AUTOSTART:-true}"

# Skip installation if version is "none"
if [ "${CCR_VERSION}" = "none" ]; then
    echo "[claude-code-router] Skipping installation (version=none)"
    exit 0
fi

echo "[claude-code-router] Starting installation..."

# === SOURCE NVM ===
if [ -f /usr/local/share/nvm/nvm.sh ]; then
    source /usr/local/share/nvm/nvm.sh
fi

# === VALIDATE DEPENDENCIES ===
if ! command -v npm &>/dev/null; then
    echo "[claude-code-router] ERROR: npm is not available"
    echo "  Ensure node feature is installed first"
    exit 1
fi

# === VALIDATE INPUT ===
if [[ ! "${SHELLS}" =~ ^(bash|zsh|both)$ ]]; then
    echo "[claude-code-router] ERROR: shells must be 'bash', 'zsh', or 'both'"
    exit 1
fi

if [[ ! "${CCR_VERSION}" =~ ^[a-zA-Z0-9.-]+$ ]]; then
    echo "[claude-code-router] ERROR: version contains invalid characters"
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

echo "[claude-code-router] Installing for user: ${USERNAME}"

# === GET USER HOME ===
USER_HOME=$(getent passwd "${USERNAME}" | cut -d: -f6)
if [ ! -d "${USER_HOME}" ]; then
    echo "[claude-code-router] ERROR: Home directory not found for user ${USERNAME}"
    exit 1
fi

# === INSTALL ===
echo "[claude-code-router] Installing @musistudio/claude-code-router@${CCR_VERSION} globally..."
npm install -g "@musistudio/claude-code-router@${CCR_VERSION}"

# === SHELL ACTIVATION ===
# Add ccr activate to shell rc files using marker blocks.
# This sets ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN, and other env vars
# that redirect Claude Code through the router.
CCR_BLOCK_START="# === claude-code-router activation START (managed by install.sh — do not edit) ==="
CCR_BLOCK_END="# === claude-code-router activation END ==="

configure_shell() {
    local shell_rc="$1"
    local shell_name="$2"

    if [ ! -f "${shell_rc}" ]; then
        echo "[claude-code-router] Creating ${shell_name} config: ${shell_rc}"
        sudo -u "${USERNAME}" touch "${shell_rc}"
    fi

    # Remove existing block if present
    if grep -q "claude-code-router activation START" "${shell_rc}"; then
        sed -i '/claude-code-router activation START/,/claude-code-router activation END/d' "${shell_rc}"
    fi

    # Write activation block
    cat >> "${shell_rc}" <<CCRBLOCK
${CCR_BLOCK_START}
if command -v ccr >/dev/null 2>&1; then
    eval "\$(ccr activate 2>/dev/null)" || true
fi
${CCR_BLOCK_END}
CCRBLOCK

    if ! chown "${USERNAME}:${USERNAME}" "${shell_rc}" 2>/dev/null; then
        echo "[claude-code-router] WARNING: Could not set ownership on ${shell_rc}"
    fi
    echo "[claude-code-router] Added activation to ${shell_name}"
}

if [ "${SHELLS}" = "bash" ] || [ "${SHELLS}" = "both" ]; then
    configure_shell "${USER_HOME}/.bashrc" "bash"
fi

if [ "${SHELLS}" = "zsh" ] || [ "${SHELLS}" = "both" ]; then
    configure_shell "${USER_HOME}/.zshrc" "zsh"
fi

# === AUTOSTART HOOK ===
if [ "${AUTOSTART}" = "true" ]; then
    HOOK_DIR="/usr/local/devcontainer-poststart.d"
    mkdir -p "$HOOK_DIR"

    cat > "${HOOK_DIR}/45-claude-code-router.sh" <<'HOOK'
#!/bin/bash
# Auto-start Claude Code Router daemon with supervision

# Source NVM for ccr access
if [ -f /usr/local/share/nvm/nvm.sh ]; then
    source /usr/local/share/nvm/nvm.sh
fi

if ! command -v ccr &>/dev/null; then
    echo "[claude-code-router] ccr not found in PATH, skipping auto-start"
    exit 0
fi

# Check if already running
if ccr status &>/dev/null; then
    echo "[claude-code-router] Router already running"
    exit 0
fi

# Health gate: check if config exists
CCR_CONFIG="${HOME}/.claude-code-router/config.json"
if [ ! -f "$CCR_CONFIG" ]; then
    echo "[claude-code-router] No config at ${CCR_CONFIG} — skipping auto-start"
    echo "[claude-code-router] Run 'codeforge config apply' to deploy config, then 'ccr start'"
    exit 0
fi

# Check if at least one provider API key is set
_HAS_KEY=false
for _VAR in ANTHROPIC_API_KEY DEEPSEEK_API_KEY GEMINI_API_KEY OPENROUTER_API_KEY; do
    if [ -n "${!_VAR:-}" ]; then
        _HAS_KEY=true
        break
    fi
done

if [ "$_HAS_KEY" = "false" ]; then
    echo "[claude-code-router] No provider API keys configured — skipping auto-start"
    echo "[claude-code-router] Set provider keys in .devcontainer/.secrets and rebuild"
    exit 0
fi

# Start with supervisor wrapper for restart-on-crash
(
    while true; do
        ccr start 2>&1 | tee -a /tmp/claude-code-router.log
        echo "[claude-code-router] Daemon exited, restarting in 2s..."
        sleep 2
    done
) &
SUPERVISOR_PID=$!
echo $SUPERVISOR_PID > /tmp/claude-code-router-supervisor.pid
echo "[claude-code-router] Router started with supervisor (PID: $SUPERVISOR_PID)"
HOOK

    chmod +x "${HOOK_DIR}/45-claude-code-router.sh"
    echo "[claude-code-router] Poststart hook installed (auto-launch with supervision)"
else
    echo "[claude-code-router] Autostart disabled — run manually: ccr start"
fi

# === VERIFICATION ===
echo "[claude-code-router] Verifying installation..."
if command -v ccr &>/dev/null; then
    CCR_INSTALLED_VERSION=$(ccr --version 2>/dev/null || echo "unknown")
    echo "[claude-code-router] ✓ ccr is installed (${CCR_INSTALLED_VERSION})"
else
    echo "[claude-code-router] WARNING: ccr command not found after install"
    echo "  This may resolve after shell restart"
fi

# === SUMMARY ===
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Claude Code Router Installation Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Configuration:"
echo "  • User: ${USERNAME}"
echo "  • Version: ${CCR_VERSION}"
echo "  • Shells: ${SHELLS}"
echo "  • Autostart: ${AUTOSTART}"
echo ""
echo "Usage:"
echo "  ccr start              # Start the router daemon"
echo "  ccr stop               # Stop the router"
echo "  ccr restart            # Restart with new config"
echo "  ccr status             # Check daemon status"
echo "  ccr-apply              # Redeploy config + restart"
echo ""
echo "Config: .codeforge/config/claude-code-router.json"
echo "Docs:   https://github.com/musistudio/claude-code-router"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
