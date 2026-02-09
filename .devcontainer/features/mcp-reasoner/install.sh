#!/bin/bash
set -euo pipefail

# No cleanup needed - using CLI instead of temp files

# Import options
VERSION="${VERSION:-latest}"
USERNAME="${USERNAME:-automatic}"

# Skip installation if version is "none"
if [ "${VERSION}" = "none" ]; then
    echo "[mcp-reasoner] Skipping installation (version=none)"
    exit 0
fi

echo "[mcp-reasoner] Starting MCP Reasoner installation..."

# Source NVM (Node is installed via NVM by the node feature)
if [ -f /usr/local/share/nvm/nvm.sh ]; then
    source /usr/local/share/nvm/nvm.sh
fi

# Validate node is available
if ! command -v node &>/dev/null; then
    echo "[mcp-reasoner] ERROR: node is not available. Please ensure node feature is installed first."
    echo "  NVM path: /usr/local/share/nvm/nvm.sh"
    exit 1
fi

# Validate npm is available
if ! command -v npm &>/dev/null; then
    echo "[mcp-reasoner] ERROR: npm is not available. Please ensure node feature is installed first."
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

echo "[mcp-reasoner] Installing for user: ${USERNAME}"

INSTALL_DIR="/home/${USERNAME}/mcp-reasoner"
DIST_FILE="${INSTALL_DIR}/dist/index.js"

if [[ -f "$DIST_FILE" ]]; then
    echo "[mcp-reasoner] MCP-reasoner installation already present. Skipping..."
else
    echo "[mcp-reasoner] Installing MCP-reasoner to ${INSTALL_DIR}"

    # Clone and build as detected user with NVM environment
    sudo -u "${USERNAME}" bash -c "
        source /usr/local/share/nvm/nvm.sh
        cd /home/${USERNAME}

        # Remove existing directory if present (handles failed previous runs)
        rm -rf mcp-reasoner

        # Clone the repository
        git clone https://github.com/Jacck/mcp-reasoner.git
        cd mcp-reasoner

        # Install dependencies and build
        npm install
        npm run build
    "

    # Verify installation
    if [[ ! -f "$DIST_FILE" ]]; then
        echo "[mcp-reasoner] ERROR: MCP-reasoner installation failed - dist/index.js not found"
        exit 1
    fi

    echo "[mcp-reasoner] MCP-reasoner installed successfully"
fi

# Create post-start hook for Claude Code registration
echo "[mcp-reasoner] Creating post-start hook for Claude Code registration..."
mkdir -p /usr/local/devcontainer-poststart.d

cat > /usr/local/devcontainer-poststart.d/51-mcp-reasoner.sh <<'HOOK_EOF'
#!/bin/bash
set -euo pipefail

echo "[mcp-reasoner] Registering Reasoner MCP server with Claude Code..."

# Determine user
USERNAME="${USERNAME:-vscode}"
if [ "${USERNAME}" = "auto" ] || [ "${USERNAME}" = "automatic" ]; then
    for CURRENT_USER in vscode node codespace; do
        if id -u "${CURRENT_USER}" >/dev/null 2>&1; then
            USERNAME=${CURRENT_USER}
            break
        fi
    done
fi

# Check if reasoner is installed
REASONER_PATH="/home/${USERNAME}/mcp-reasoner/dist/index.js"
if [ ! -f "$REASONER_PATH" ]; then
    echo "[mcp-reasoner] WARNING: Reasoner not found at $REASONER_PATH, skipping registration"
    exit 0
fi

# Ensure settings.json exists
SETTINGS_FILE="/workspaces/.claude/settings.json"
if [ ! -f "$SETTINGS_FILE" ]; then
    echo "[mcp-reasoner] ERROR: $SETTINGS_FILE not found"
    exit 1
fi

# Check if jq is available
if ! command -v jq &>/dev/null; then
    echo "[mcp-reasoner] ERROR: jq not available"
    exit 1
fi

# Build the server configuration
SERVER_CONFIG=$(jq -n \
    --arg cmd "node" \
    --arg path "$REASONER_PATH" \
    '{
        command: $cmd,
        args: [$path]
    }')

# Update settings.json - add or update reasoner server
# Create temporary file for atomic update
TEMP_FILE=$(mktemp)
jq --argjson server "$SERVER_CONFIG" \
    '.mcpServers.reasoner = $server' \
    "$SETTINGS_FILE" > "$TEMP_FILE"

# Verify the JSON is valid
if jq empty "$TEMP_FILE" 2>/dev/null; then
    mv "$TEMP_FILE" "$SETTINGS_FILE"
    echo "[mcp-reasoner] ✓ Reasoner MCP server registered in Claude Code settings"
else
    echo "[mcp-reasoner] ERROR: Generated invalid JSON"
    rm -f "$TEMP_FILE"
    exit 1
fi

# Set proper permissions
chmod 644 "$SETTINGS_FILE"
chown "$(id -un):$(id -gn)" "$SETTINGS_FILE" 2>/dev/null || true

echo "[mcp-reasoner] ✓ Configuration complete"
HOOK_EOF

chmod +x /usr/local/devcontainer-poststart.d/51-mcp-reasoner.sh
echo "[mcp-reasoner] ✓ Post-start hook created at /usr/local/devcontainer-poststart.d/51-mcp-reasoner.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  MCP Reasoner Installation Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Configuration:"
echo "  • Install Path: ${INSTALL_DIR}"
echo "  • User: ${USERNAME}"
echo "  • MCP Server: reasoner (native devcontainer support)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Next Steps"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. MCP server will auto-register with Claude Code on container start"
echo ""
echo "2. Test the server directly:"
echo "   node ${DIST_FILE}"
echo ""
echo "3. Verify available MCP servers in your AI agent"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
