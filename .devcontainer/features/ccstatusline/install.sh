#!/bin/bash
set -euo pipefail

# Cleanup on exit
cleanup() {
    rm -f "${TMPDIR:-/tmp}"/ccstatusline-*.json 2>/dev/null || true
}
trap cleanup EXIT

# Import options from devcontainer-feature.json
# NOTE: DevContainer converts camelCase options to UPPERCASE without underscores
VERSION="${VERSION:-latest}"
USERNAME="${USERNAME:-automatic}"

# Skip installation if version is "none"
if [ "${VERSION}" = "none" ]; then
    echo "[ccstatusline] Skipping installation (version=none)"
    exit 0
fi

echo "[ccstatusline] Starting installation..."

# Source NVM (Node is installed via NVM by the node feature)
if [ -f /usr/local/share/nvm/nvm.sh ]; then
    source /usr/local/share/nvm/nvm.sh
fi

# Validate jq is available (required for JSON generation)
if ! command -v jq &>/dev/null; then
    echo "[ccstatusline] ERROR: jq is not available"
    echo "  Install common-utils feature first"
    exit 1
fi

# Validate npm/npx is available
if ! command -v npm &>/dev/null && ! command -v npx &>/dev/null; then
    echo "[ccstatusline] ERROR: npm/npx is not available"
    echo "  Install node feature first"
    echo "  NVM path: /usr/local/share/nvm/nvm.sh"
    exit 1
fi

# Determine the user
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

echo "[ccstatusline] Installing for user: ${USERNAME}"

# Get user's home directory
USER_HOME=$(eval echo ~${USERNAME})

# Check if ccstatusline is available
if sudo -u "${USERNAME}" bash -c 'npx -y ccstatusline@latest --version' &>/dev/null 2>&1; then
    echo "[ccstatusline] ccstatusline already available via npx"
else
    echo "[ccstatusline] ccstatusline will be cached on first use via npx"
fi

# Widget config is managed by file-manifest.json (deployed by setup-config.sh)
# Source: .devcontainer/config/defaults/ccstatusline-settings.json
# Deployed to: ~/.config/ccstatusline/settings.json (if-changed)
# Template:    /usr/local/share/ccstatusline/settings.template.json (always)
echo "[ccstatusline] Widget config managed by file-manifest.json"

# Create directories so wrapper doesn't fail before first post-start
mkdir -p "${USER_HOME}/.config/ccstatusline"
mkdir -p /usr/local/share/ccstatusline
chown "${USERNAME}:${USERNAME}" "${USER_HOME}/.config/ccstatusline" 2>/dev/null || true

# Create session resume helper script for custom-command widget
# Reads Claude Code JSON from stdin, outputs the session ID
echo "[ccstatusline] Creating session resume helper..."
cat > /usr/local/bin/ccstatusline-session-resume <<'SESSION_EOF'
#!/bin/bash
# Reads Claude Code JSON from stdin, outputs just the session ID
# Used by ccstatusline custom-command widget on line 6
SESSION_ID=$(jq -r '.session_id // empty' 2>/dev/null)
if [ -n "$SESSION_ID" ]; then
    echo "$SESSION_ID"
else
    echo "..."
fi
SESSION_EOF

chmod +x /usr/local/bin/ccstatusline-session-resume
echo "[ccstatusline] ✓ Session resume helper installed at /usr/local/bin/ccstatusline-session-resume"

# Create CWD helper script for custom-command widget
# Reads Claude Code JSON from stdin, outputs the last path segment of cwd
echo "[ccstatusline] Creating CWD helper..."
cat > /usr/local/bin/ccstatusline-cwd <<'CWD_EOF'
#!/bin/bash
# Reads Claude Code JSON from stdin, outputs basename of cwd
# Used by ccstatusline custom-command widget
CWD=$(jq -r '.cwd // empty' 2>/dev/null)
if [ -n "$CWD" ]; then
    basename "$CWD"
else
    echo "..."
fi
CWD_EOF

chmod +x /usr/local/bin/ccstatusline-cwd
echo "[ccstatusline] ✓ CWD helper installed at /usr/local/bin/ccstatusline-cwd"

# Create wrapper script to protect configuration
echo "[ccstatusline] Creating wrapper script..."
cat > /usr/local/bin/ccstatusline-wrapper <<'WRAPPER_EOF'
#!/bin/bash
# ccstatusline wrapper script
# Ensures custom powerline configuration is valid before running ccstatusline

set -euo pipefail

CONFIG_FILE="$HOME/.config/ccstatusline/settings.json"
TEMPLATE_FILE="/usr/local/share/ccstatusline/settings.template.json"

# Ensure config directory exists
mkdir -p "$HOME/.config/ccstatusline"

# Function to check if config is valid
is_config_valid() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        return 1
    fi

    # Check if powerline is enabled (key indicator of custom config)
    if ! grep -q '"enabled"[[:space:]]*:[[:space:]]*true' "$CONFIG_FILE" 2>/dev/null; then
        return 1
    fi

    # Check if ANSI colors are present (backgroundColor with bg prefix)
    if ! grep -q 'bgRed\|bgMagenta\|bgGreen\|bgBrightBlue' "$CONFIG_FILE" 2>/dev/null; then
        return 1
    fi

    # Validate JSON syntax
    if ! jq empty "$CONFIG_FILE" 2>/dev/null; then
        return 1
    fi

    return 0
}

# Restore config from template if missing or invalid
if ! is_config_valid; then
    if [[ -f "$TEMPLATE_FILE" ]]; then
        cp "$TEMPLATE_FILE" "$CONFIG_FILE"
        chmod 644 "$CONFIG_FILE"
    else
        echo "[ccstatusline-wrapper] ERROR: Template file not found at $TEMPLATE_FILE" >&2
        exit 1
    fi
fi

# Run ccstatusline with all passed arguments
exec npx -y ccstatusline@latest "$@"
WRAPPER_EOF

chmod +x /usr/local/bin/ccstatusline-wrapper
echo "[ccstatusline] ✓ Wrapper installed at /usr/local/bin/ccstatusline-wrapper"

# Create post-start hook directory (standard pattern for DevContainer features)
mkdir -p /usr/local/devcontainer-poststart.d

# Create post-start hook script for Claude Code integration
# Runs on EVERY container start to ensure statusLine is always configured
# This handles cached images, config deletion, and corruption scenarios
# Note: Uses prefix 40 to run before MCP servers (50-51) to ensure settings.json exists first
cat > /usr/local/devcontainer-poststart.d/40-ccstatusline.sh <<'AUTOEOF'
#!/bin/bash
set -euo pipefail

echo "[ccstatusline] Auto-configuring Claude Code integration..."

# Validate prerequisites
if ! command -v jq &>/dev/null; then
    echo "[ccstatusline] ERROR: jq is not available"
    echo "  Ensure common-utils feature is installed"
    exit 1
fi

SETTINGS_FILE="${WORKSPACE_ROOT:-/workspaces}/.claude/settings.json"
# Use SUDO_USER since _REMOTE_USER isn't set in post-start hooks
USERNAME="${SUDO_USER:-vscode}"

# Ensure directory exists
mkdir -p "$(dirname "${SETTINGS_FILE}")"

# Initialize settings.json if missing
if [ ! -f "${SETTINGS_FILE}" ]; then
    echo '{}' > "${SETTINGS_FILE}"
fi

# Add statusLine configuration (atomic) - use wrapper to protect config
jq '.statusLine //= {}' "${SETTINGS_FILE}" | \
jq '.statusLine = {
    type: "command",
    command: "/usr/local/bin/ccstatusline-wrapper"
}' > "${SETTINGS_FILE}.tmp"

# Atomic move (only if jq succeeded)
if [ $? -eq 0 ]; then
    mv "${SETTINGS_FILE}.tmp" "${SETTINGS_FILE}"
    if ! chown "${USERNAME}:${USERNAME}" "${SETTINGS_FILE}" 2>/dev/null; then
        echo "[ccstatusline] WARNING: Could not set ownership on ${SETTINGS_FILE}"
    fi
    echo "[ccstatusline] ✓ Configured in ${SETTINGS_FILE}"
    echo "[ccstatusline] Verify: cat ${SETTINGS_FILE} | jq '.statusLine'"
else
    rm -f "${SETTINGS_FILE}.tmp"
    echo "[ccstatusline] ERROR: Configuration failed"
    exit 1
fi
AUTOEOF

chmod +x /usr/local/devcontainer-poststart.d/40-ccstatusline.sh
echo "[ccstatusline] ✓ Post-start hook created at /usr/local/devcontainer-poststart.d/40-ccstatusline.sh"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ccstatusline Installation Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Configuration:"
echo "  • Source: .devcontainer/config/defaults/ccstatusline-settings.json"
echo "  • Deployed to: ~/.config/ccstatusline/settings.json (by file-manifest)"
echo "  • Template: /usr/local/share/ccstatusline/settings.template.json"
echo "  • User: ${USERNAME}"
echo "  • Protected by: /usr/local/bin/ccstatusline-wrapper"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Next Steps"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Widget config is deployed automatically on container start"
echo ""
echo "2. To customize: edit .devcontainer/config/defaults/ccstatusline-settings.json"
echo "   Changes deploy on next container start (if-changed)"
echo ""
echo "3. Test manually:"
echo "   echo '{\"model\":{\"display_name\":\"Test\"}}' | npx -y ccstatusline@latest"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
