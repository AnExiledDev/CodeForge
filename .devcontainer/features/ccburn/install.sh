#!/bin/bash
set -euo pipefail

# === SETUP ===
cleanup() {
    :
}
trap cleanup EXIT

# === IMPORT OPTIONS ===
# NOTE: DevContainer converts camelCase options to UPPERCASE without underscores
CCBURN_VERSION="${VERSION:-latest}"
SHELLS="${SHELLS:-both}"
USERNAME="${USERNAME:-automatic}"

# Skip installation if version is "none"
if [ "${CCBURN_VERSION}" = "none" ]; then
    echo "[ccburn] Skipping installation (version=none)"
    exit 0
fi

echo "[ccburn] Starting ccburn installation..."

# === SOURCE NVM ===
if [ -f /usr/local/share/nvm/nvm.sh ]; then
    source /usr/local/share/nvm/nvm.sh
fi

# === VALIDATE DEPENDENCIES ===
if ! command -v npx &>/dev/null; then
    echo "[ccburn] ERROR: npx is not available"
    echo "  Ensure node feature is installed first"
    echo "  NVM path: /usr/local/share/nvm/nvm.sh"
    exit 1
fi

# === VALIDATE INPUT ===
if [[ ! "${SHELLS}" =~ ^(bash|zsh|both)$ ]]; then
    echo "[ccburn] ERROR: shells must be 'bash', 'zsh', or 'both'"
    echo "  Provided: ${SHELLS}"
    exit 1
fi

if [[ ! "${CCBURN_VERSION}" =~ ^[a-zA-Z0-9.-]+$ ]]; then
    echo "[ccburn] ERROR: version contains invalid characters"
    echo "  Provided: ${CCBURN_VERSION}"
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

echo "[ccburn] Installing for user: ${USERNAME}"

# === GET USER HOME ===
USER_HOME=$(eval echo "~${USERNAME}")
if [ ! -d "${USER_HOME}" ]; then
    echo "[ccburn] ERROR: Home directory not found for user ${USERNAME}"
    exit 1
fi

# === INSTALL (CREATE ALIASES) ===
ALIAS_CMD="alias ccburn=\"npx -y ccburn@${CCBURN_VERSION}\""

configure_shell() {
    local shell_rc="$1"
    local shell_name="$2"

    if [ ! -f "${shell_rc}" ]; then
        echo "[ccburn] Creating ${shell_name} config file: ${shell_rc}"
        sudo -u "${USERNAME}" touch "${shell_rc}"
    fi

    if grep -q "alias ccburn=" "${shell_rc}"; then
        echo "[ccburn] ${shell_name} alias already configured. Skipping..."
    else
        echo "[ccburn] Adding ccburn alias to ${shell_name}"
        echo "${ALIAS_CMD}" >> "${shell_rc}"
        if ! chown "${USERNAME}:${USERNAME}" "${shell_rc}" 2>/dev/null; then
            echo "[ccburn] WARNING: Could not set ownership on ${shell_rc}"
            echo "  Fix: sudo chown ${USERNAME}:${USERNAME} ${shell_rc}"
        fi
    fi
}

if [ "${SHELLS}" = "bash" ] || [ "${SHELLS}" = "both" ]; then
    configure_shell "${USER_HOME}/.bashrc" "bash"
fi

if [ "${SHELLS}" = "zsh" ] || [ "${SHELLS}" = "both" ]; then
    configure_shell "${USER_HOME}/.zshrc" "zsh"
fi

# === INSTALL STATUSLINE WRAPPER ===
# Creates a wrapper script for embedding ccburn compact output in ccstatusline
# Handles missing credentials, npx availability, and first-run caching gracefully
echo "[ccburn] Creating statusline wrapper script..."

cat > /usr/local/bin/ccburn-statusline <<'WRAPPER_EOF'
#!/bin/bash
# ccburn-statusline: Compact output wrapper for ccstatusline custom-command widget
# Handles missing credentials, first-run npx cache, and errors gracefully
# Always outputs something useful — never errors in the statusline

# Source NVM if available (npx may not be on PATH without it)
if [ -f /usr/local/share/nvm/nvm.sh ]; then
    source /usr/local/share/nvm/nvm.sh 2>/dev/null
fi

if ! command -v npx &>/dev/null; then
    echo "ccburn: npx unavailable"
    exit 0
fi

# Check if credentials exist (ccburn needs OAuth token)
CRED_FILE="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.credentials.json"
if [ ! -f "$CRED_FILE" ]; then
    echo "ccburn: awaiting auth"
    exit 0
fi

# Run ccburn compact (suppress stderr, capture output)
OUTPUT=$(npx -y ccburn --compact --once 2>/dev/null)
if [ $? -eq 0 ] && [ -n "$OUTPUT" ]; then
    echo "$OUTPUT"
else
    echo "ccburn: unavailable"
fi
WRAPPER_EOF

chmod +x /usr/local/bin/ccburn-statusline
echo "[ccburn] ✓ Statusline wrapper installed at /usr/local/bin/ccburn-statusline"

# === VERIFICATION ===
echo "[ccburn] Verifying npx can access ccburn..."
if sudo -u "${USERNAME}" bash -c "npx -y ccburn@${CCBURN_VERSION} --version" &>/dev/null; then
    echo "[ccburn] ✓ ccburn is accessible"
else
    echo "[ccburn] WARNING: Could not verify ccburn installation"
    echo "  This may be due to network connectivity"
    echo "  The alias will still work once ccburn is available"
fi

# === SUMMARY ===
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ccburn Installation Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Configuration:"
echo "  • User: ${USERNAME}"
echo "  • Version: ${CCBURN_VERSION}"
echo "  • Shells: ${SHELLS}"
echo ""
echo "Usage:"
echo "  ccburn                # Full TUI dashboard (auto-detect limit)"
echo "  ccburn session        # 5-hour rolling session limit"
echo "  ccburn weekly         # 7-day limit (all models)"
echo "  ccburn weekly-sonnet  # 7-day Sonnet-only limit"
echo "  ccburn --compact      # Single-line for status bars"
echo "  ccburn --json         # JSON output for scripting"
echo "  ccburn --help         # Full options"
echo ""
echo "Statusline Integration:"
echo "  • Wrapper: /usr/local/bin/ccburn-statusline"
echo "  • Used by ccstatusline custom-command widget"
echo "  • Shows: Session 🧊/🔥/🚨 % | Weekly % | Sonnet %"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
