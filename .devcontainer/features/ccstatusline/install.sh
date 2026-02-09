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

echo "[ccstatusline] Generating powerline configuration..."

# Generate powerline configuration using jq (ANSI colors - same as module)
# 6-line layout with session resume command and ccburn burn rate tracking
CONFIG_JSON=$(jq -n '{
    version: 3,
    lines: [
        [
            {id: "1", type: "context-length", color: "cyan"},
            {id: "db519d5a-80a7-4b44-8a9c-2c7d8c0a7176", type: "context-percentage-usable", backgroundColor: "bgRed"},
            {id: "d904cca6-ade8-41c1-a4f5-ddea30607a5e", type: "model", backgroundColor: "bgMagenta"}
        ],
        [
            {id: "5", type: "tokens-input", color: "magenta"},
            {id: "ac094d46-3673-4d41-84e3-dc8c5bcf639f", type: "tokens-output", backgroundColor: "bgMagenta"},
            {id: "2ad12147-05fd-45fb-8336-53ba2e7df56c", type: "tokens-cached", backgroundColor: "bgBrightRed"}
        ],
        [
            {id: "3", type: "git-branch", color: "brightBlack"},
            {id: "a529e50e-b9f3-4150-a812-937ab81545e8", type: "git-changes", backgroundColor: "bgBrightBlue"},
            {id: "a9eaae3f-7f91-459c-833a-fbc9f01a09ae", type: "git-worktree", backgroundColor: "bgBrightBlue"}
        ],
        [
            {id: "7", type: "session-clock", color: "yellow"},
            {id: "a4fe7f75-2f6c-49c7-88f6-ac7381142c2c", type: "session-cost", backgroundColor: "bgBrightWhite"},
            {id: "90aae111-3d3f-4bb0-8336-230f322cc2e8", type: "block-timer", backgroundColor: "bgYellow"}
        ],
        [
            {id: "9bacbdb4-2e01-45de-a0c0-ee6ec30fa3c2", type: "tokens-total", backgroundColor: "bgGreen"},
            {id: "2cdff909-8297-44a1-83f9-ad4bf024391e", type: "version", backgroundColor: "bgRed"}
        ],
        [
            {id: "cc-resume-session", type: "custom-command", commandPath: "/usr/local/bin/ccstatusline-session-resume", timeout: 500, preserveColors: false, maxWidth: 50, color: "cyan", backgroundColor: "bgBrightBlack"}
        ],
        [
            {id: "ccburn-compact", type: "custom-command", commandPath: "/usr/local/bin/ccburn-statusline", timeout: 8000, preserveColors: true, maxWidth: 80, color: "green", backgroundColor: "bgBlack"}
        ]
    ],
    flexMode: "full-minus-40",
    compactThreshold: 60,
    colorLevel: 2,
    inheritSeparatorColors: false,
    globalBold: false,
    powerline: {
        enabled: true,
        separators: ["\ue0b0"],
        separatorInvertBackground: [false],
        startCaps: ["\ue0b6"],
        endCaps: ["\ue0b4"],
        autoAlign: false,
        theme: "monokai"
    },
    defaultPadding: " "
}')

# Validate generated config
if ! echo "${CONFIG_JSON}" | jq empty 2>/dev/null; then
    echo "[ccstatusline] ERROR: Generated configuration is invalid JSON"
    exit 1
fi

echo "[ccstatusline] Writing configuration..."

CONFIG_DIR="${USER_HOME}/.config/ccstatusline"
CONFIG_FILE="${CONFIG_DIR}/settings.json"

# Create directory
mkdir -p "${CONFIG_DIR}"

# Write config using secure temp file
TEMP_CONFIG=$(mktemp)
chmod 644 "${TEMP_CONFIG}"
echo "${CONFIG_JSON}" | jq . > "${TEMP_CONFIG}"

# Move to final location
mv "${TEMP_CONFIG}" "${CONFIG_FILE}"

# Set ownership
if ! chown "${USERNAME}:${USERNAME}" "${CONFIG_FILE}" 2>/dev/null; then
    echo "[ccstatusline] WARNING: Could not set ownership on ${CONFIG_FILE}"
    echo "  Fix: sudo chown ${USERNAME}:${USERNAME} ${CONFIG_FILE}"
fi

if ! chown "${USERNAME}:${USERNAME}" "${CONFIG_DIR}" 2>/dev/null; then
    echo "[ccstatusline] WARNING: Could not set ownership on ${CONFIG_DIR}"
fi

echo "[ccstatusline] ✓ Configuration written to ${CONFIG_FILE}"

# Create template directory and save config template
echo "[ccstatusline] Creating configuration template..."
mkdir -p /usr/local/share/ccstatusline
TEMPLATE_FILE=/usr/local/share/ccstatusline/settings.template.json
echo "${CONFIG_JSON}" | jq . > "${TEMPLATE_FILE}"
chmod 644 "${TEMPLATE_FILE}"
echo "[ccstatusline] ✓ Template saved to ${TEMPLATE_FILE}"

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
echo "  • Config file: ${CONFIG_FILE}"
echo "  • User: ${USERNAME}"
echo "  • Theme: Powerline (7 lines, 16 widgets, ANSI colors)"
echo "  • Protected by: /usr/local/bin/ccstatusline-wrapper"
echo ""
echo "Display:"
echo "  Line 1: Context Length | Context % | Model"
echo "  Line 2: Tokens In | Tokens Out | Tokens Cached"
echo "  Line 3: Git Branch | Git Changes | Git Worktree"
echo "  Line 4: Session Clock | Session Cost | Block Timer"
echo "  Line 5: Tokens Total | Version"
echo "  Line 6: Session ID"
echo "  Line 7: Burn Rate (ccburn compact)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Next Steps"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Configuration will be applied automatically on container creation"
echo ""
echo "2. Test manually:"
echo "   echo '{\"model\":{\"display_name\":\"Test\"}}' | npx -y ccstatusline@latest"
echo ""
echo "3. View configuration:"
echo "   cat ${CONFIG_FILE} | jq ."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
