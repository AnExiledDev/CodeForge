#!/bin/bash
set -euo pipefail

# === SETUP ===
cleanup() {
    # No temp files needed for this simple feature
    :
}
trap cleanup EXIT

# === IMPORT OPTIONS ===
# NOTE: DevContainer converts camelCase options to UPPERCASE without underscores
# "version" → VERSION, "shells" → SHELLS, "username" → USERNAME
CCUSAGE_VERSION="${VERSION:-latest}"
SHELLS="${SHELLS:-both}"
USERNAME="${USERNAME:-automatic}"

# Skip installation if version is "none"
if [ "${CCUSAGE_VERSION}" = "none" ]; then
    echo "[ccusage] Skipping installation (version=none)"
    exit 0
fi

echo "[ccusage] Starting ccusage installation..."

# === SOURCE NVM ===
# Node is installed via NVM by the node feature
if [ -f /usr/local/share/nvm/nvm.sh ]; then
    source /usr/local/share/nvm/nvm.sh
fi

# === VALIDATE DEPENDENCIES ===
if ! command -v npx &>/dev/null; then
    echo "[ccusage] ERROR: npx is not available"
    echo "  Ensure node feature is installed first"
    echo "  NVM path: /usr/local/share/nvm/nvm.sh"
    exit 1
fi

# === VALIDATE INPUT ===
# Validate shells parameter
if [[ ! "${SHELLS}" =~ ^(bash|zsh|both)$ ]]; then
    echo "[ccusage] ERROR: shells must be 'bash', 'zsh', or 'both'"
    echo "  Provided: ${SHELLS}"
    exit 1
fi

# Validate version format (basic check)
if [[ ! "${CCUSAGE_VERSION}" =~ ^[a-zA-Z0-9.-]+$ ]]; then
    echo "[ccusage] ERROR: version contains invalid characters"
    echo "  Provided: ${CCUSAGE_VERSION}"
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

echo "[ccusage] Installing for user: ${USERNAME}"

# === GET USER HOME ===
USER_HOME=$(eval echo "~${USERNAME}")
if [ ! -d "${USER_HOME}" ]; then
    echo "[ccusage] ERROR: Home directory not found for user ${USERNAME}"
    exit 1
fi

# === INSTALL (CREATE ALIASES) ===
ALIAS_CMD="alias ccusage=\"npx -y ccusage@${CCUSAGE_VERSION}\""

configure_shell() {
    local shell_rc="$1"
    local shell_name="$2"

    if [ ! -f "${shell_rc}" ]; then
        echo "[ccusage] Creating ${shell_name} config file: ${shell_rc}"
        sudo -u "${USERNAME}" touch "${shell_rc}"
    fi

    if grep -q "alias ccusage=" "${shell_rc}"; then
        echo "[ccusage] ${shell_name} alias already configured. Skipping..."
    else
        echo "[ccusage] Adding ccusage alias to ${shell_name}"
        echo "${ALIAS_CMD}" >> "${shell_rc}"
        if ! chown "${USERNAME}:${USERNAME}" "${shell_rc}" 2>/dev/null; then
            echo "[ccusage] WARNING: Could not set ownership on ${shell_rc}"
            echo "  Fix: sudo chown ${USERNAME}:${USERNAME} ${shell_rc}"
        fi
    fi
}

# Configure requested shells
if [ "${SHELLS}" = "bash" ] || [ "${SHELLS}" = "both" ]; then
    configure_shell "${USER_HOME}/.bashrc" "bash"
fi

if [ "${SHELLS}" = "zsh" ] || [ "${SHELLS}" = "both" ]; then
    configure_shell "${USER_HOME}/.zshrc" "zsh"
fi

# === VERIFICATION ===
echo "[ccusage] Verifying npx can access ccusage..."
if sudo -u "${USERNAME}" bash -c "npx -y ccusage@${CCUSAGE_VERSION} --version" &>/dev/null; then
    echo "[ccusage] ✓ ccusage is accessible"
else
    echo "[ccusage] WARNING: Could not verify ccusage installation"
    echo "  This may be due to network connectivity"
    echo "  The alias will still work once ccusage is available"
fi

# === SUMMARY ===
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ccusage Installation Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Configuration:"
echo "  • User: ${USERNAME}"
echo "  • Version: ${CCUSAGE_VERSION}"
echo "  • Shells: ${SHELLS}"
echo ""
echo "Usage:"
echo "  ccusage --daily      # Daily usage report"
echo "  ccusage --monthly    # Monthly report"
echo "  ccusage --live       # Live monitoring"
echo "  ccusage --help       # Full options"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
