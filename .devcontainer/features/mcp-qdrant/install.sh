#!/bin/bash
set -euo pipefail

# Import options from devcontainer-feature.json
# NOTE: DevContainer converts camelCase options to UPPERCASE without underscores
# Example: "qdrantUrl" becomes $QDRANTURL (not $QDRANT_URL)
VERSION="${VERSION:-latest}"

# Skip installation if version is "none"
if [ "${VERSION}" = "none" ]; then
    echo "[mcp-qdrant] Skipping installation (version=none)"
    exit 0
fi

QDRANT_URL="${QDRANTURL:-}"
QDRANT_API_KEY="${QDRANTAPIKEY:-}"
QDRANT_LOCAL_PATH="${QDRANTLOCALPATH:-/workspaces/.qdrant/storage}"
COLLECTION_NAME="${COLLECTIONNAME:-agent-memory}"
EMBEDDING_MODEL="${EMBEDDINGMODEL:-all-MiniLM-L6-v2}"
USERNAME="${USERNAME:-automatic}"

echo "[mcp-qdrant] Starting Qdrant MCP Server installation..."

# Validate input parameters
if [ -n "${QDRANT_URL}" ]; then
    # Basic URL validation
    if [[ ! "${QDRANT_URL}" =~ ^https?:// ]]; then
        echo "[mcp-qdrant] ERROR: qdrantUrl must start with http:// or https://"
        echo "  Provided: ${QDRANT_URL}"
        exit 1
    fi
fi

if [ -n "${QDRANT_LOCAL_PATH}" ]; then
    # Validate it's an absolute path
    if [[ ! "${QDRANT_LOCAL_PATH}" =~ ^/ ]]; then
        echo "[mcp-qdrant] ERROR: qdrantLocalPath must be an absolute path"
        echo "  Provided: ${QDRANT_LOCAL_PATH}"
        exit 1
    fi
fi

# Validate embedding model is one of the supported models
VALID_MODELS=("all-MiniLM-L6-v2" "BAAI/bge-small-en-v1.5" "sentence-transformers/all-mpnet-base-v2" "BAAI/bge-base-en-v1.5")
MODEL_VALID=false
for model in "${VALID_MODELS[@]}"; do
    if [ "${EMBEDDING_MODEL}" = "${model}" ]; then
        MODEL_VALID=true
        break
    fi
done
if [ "${MODEL_VALID}" = "false" ]; then
    echo "[mcp-qdrant] WARNING: Embedding model '${EMBEDDING_MODEL}' is not in the recommended list."
    echo "  Continuing anyway, but this may cause issues."
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

echo "[mcp-qdrant] Installing for user: ${USERNAME}"

# Check if uvx is available
if ! command -v uvx &>/dev/null; then
    echo "[mcp-qdrant] ERROR: uvx is not available. Please ensure Python feature is installed first."
    exit 1
fi

# Remove hf-xet package which causes hangs in huggingface_hub downloads
# This is a known issue in containerized environments
echo "[mcp-qdrant] Removing hf-xet to prevent huggingface_hub download hangs..."
pip uninstall hf-xet -y 2>/dev/null || true

# Pre-download the embedding model from GCS (more reliable than HuggingFace Hub in containers)
# This is critical to avoid network timeouts from huggingface_hub
echo "[mcp-qdrant] Pre-downloading embedding model from GCS..."
FASTEMBED_CACHE="/workspaces/.qdrant/fastembed_cache"
mkdir -p "${FASTEMBED_CACHE}"

# Map embedding model names to GCS URLs and legacy cache directory names
case "${EMBEDDING_MODEL}" in
    "all-MiniLM-L6-v2"|"sentence-transformers/all-MiniLM-L6-v2")
        MODEL_URL="https://storage.googleapis.com/qdrant-fastembed/sentence-transformers-all-MiniLM-L6-v2.tar.gz"
        MODEL_DIR="fast-all-MiniLM-L6-v2"
        HF_MODEL_NAME="sentence-transformers/all-MiniLM-L6-v2"
        ;;
    "BAAI/bge-small-en-v1.5")
        MODEL_URL="https://storage.googleapis.com/qdrant-fastembed/fast-bge-small-en-v1.5.tar.gz"
        MODEL_DIR="fast-bge-small-en-v1.5"
        HF_MODEL_NAME="BAAI/bge-small-en-v1.5"
        ;;
    "BAAI/bge-base-en-v1.5")
        MODEL_URL="https://storage.googleapis.com/qdrant-fastembed/fast-bge-base-en-v1.5.tar.gz"
        MODEL_DIR="fast-bge-base-en-v1.5"
        HF_MODEL_NAME="BAAI/bge-base-en-v1.5"
        ;;
    "sentence-transformers/all-mpnet-base-v2")
        MODEL_URL="https://storage.googleapis.com/qdrant-fastembed/sentence-transformers-all-mpnet-base-v2.tar.gz"
        MODEL_DIR="fast-all-mpnet-base-v2"
        HF_MODEL_NAME="sentence-transformers/all-mpnet-base-v2"
        ;;
    *)
        echo "[mcp-qdrant] WARNING: No GCS URL for model ${EMBEDDING_MODEL}"
        MODEL_URL=""
        HF_MODEL_NAME=""
        ;;
esac

if [ -n "${MODEL_URL}" ]; then
    if [ ! -d "${FASTEMBED_CACHE}/${MODEL_DIR}" ]; then
        echo "[mcp-qdrant] Downloading ${EMBEDDING_MODEL} from GCS..."
        TEMP_TAR=$(mktemp)
        if curl -L "${MODEL_URL}" -o "${TEMP_TAR}" 2>/dev/null; then
            tar -xzf "${TEMP_TAR}" -C "${FASTEMBED_CACHE}/" 2>/dev/null || true
            # Remove macOS extended attribute files
            find "${FASTEMBED_CACHE}" -name "._*" -delete 2>/dev/null || true
            rm -f "${TEMP_TAR}"
            chmod -R 755 "${FASTEMBED_CACHE}" 2>/dev/null || true
            echo "[mcp-qdrant] ✓ Embedding model pre-downloaded to ${FASTEMBED_CACHE}/${MODEL_DIR}"
        else
            echo "[mcp-qdrant] WARNING: Failed to download model from GCS"
            rm -f "${TEMP_TAR}"
        fi
    else
        echo "[mcp-qdrant] ✓ Embedding model already cached at ${FASTEMBED_CACHE}/${MODEL_DIR}"
    fi
fi

# Check if mcp-server-qdrant is already available via uvx
# NOTE: Correct uvx syntax is: uvx COMMAND [ARGS], not uvx [FLAGS] COMMAND
# uvx auto-installs packages on first run, so we just verify it works
if sudo -u "${USERNAME}" bash -c 'uvx mcp-server-qdrant --help' &>/dev/null; then
    echo "[mcp-qdrant] mcp-server-qdrant already available. Skipping..."
else
    echo "[mcp-qdrant] mcp-server-qdrant will be cached on first use via uvx"
fi

# Prepare local storage directory if needed
if [ -z "${QDRANT_URL}" ]; then
    mkdir -p "${QDRANT_LOCAL_PATH}"
    if ! chown -R "${USERNAME}:${USERNAME}" "${QDRANT_LOCAL_PATH}"; then
        echo "[mcp-qdrant] WARNING: Failed to set ownership on ${QDRANT_LOCAL_PATH}"
    fi
fi

# Create MCP environment file for VS Code devcontainer mcpServers support
cat > /workspaces/.qdrant-mcp.env <<EOF
COLLECTION_NAME=${COLLECTION_NAME}
EMBEDDING_MODEL=${EMBEDDING_MODEL}
QDRANT_URL=${QDRANT_URL}
QDRANT_API_KEY=${QDRANT_API_KEY}
QDRANT_LOCAL_PATH=${QDRANT_LOCAL_PATH}
EOF

# Set proper permissions (secure API keys, readable by user)
chmod 600 /workspaces/.qdrant-mcp.env
echo "[mcp-qdrant] ✓ Environment file created at /workspaces/.qdrant-mcp.env"

# Create post-start hook for Claude Code registration
echo "[mcp-qdrant] Creating post-start hook for Claude Code registration..."
mkdir -p /usr/local/devcontainer-poststart.d

cat > /usr/local/devcontainer-poststart.d/50-mcp-qdrant.sh <<'HOOK_EOF'
#!/bin/bash
set -euo pipefail

echo "[mcp-qdrant] Registering Qdrant MCP server with Claude Code..."

# Load environment from .qdrant-mcp.env if it exists
if [ -f /workspaces/.qdrant-mcp.env ]; then
    source /workspaces/.qdrant-mcp.env
else
    echo "[mcp-qdrant] WARNING: /workspaces/.qdrant-mcp.env not found, using defaults"
    COLLECTION_NAME="${COLLECTION_NAME:-agent-memory}"
    EMBEDDING_MODEL="${EMBEDDING_MODEL:-all-MiniLM-L6-v2}"
    QDRANT_URL="${QDRANT_URL:-}"
    QDRANT_API_KEY="${QDRANT_API_KEY:-}"
    QDRANT_LOCAL_PATH="${QDRANT_LOCAL_PATH:-/workspaces/.qdrant/storage}"
fi

# Ensure settings.json exists
SETTINGS_FILE="/workspaces/.claude/settings.json"
if [ ! -f "$SETTINGS_FILE" ]; then
    echo "[mcp-qdrant] ERROR: $SETTINGS_FILE not found"
    exit 1
fi

# Check if jq is available
if ! command -v jq &>/dev/null; then
    echo "[mcp-qdrant] ERROR: jq not available"
    exit 1
fi

# Build the server configuration
# HF_HUB_OFFLINE=1 prevents huggingface_hub from making network calls
# FASTEMBED_CACHE_PATH points to pre-downloaded models
if [ -n "$QDRANT_URL" ]; then
    # Cloud mode with URL and API key
    SERVER_CONFIG=$(jq -n \
        --arg url "$QDRANT_URL" \
        --arg key "$QDRANT_API_KEY" \
        --arg collection "$COLLECTION_NAME" \
        '{
            command: "uvx",
            args: ["mcp-server-qdrant"],
            env: {
                HF_HUB_OFFLINE: "1",
                FASTEMBED_CACHE_PATH: "/workspaces/.qdrant/fastembed_cache",
                QDRANT_URL: $url,
                QDRANT_API_KEY: $key,
                COLLECTION_NAME: $collection
            }
        }')
else
    # Local mode with local path
    SERVER_CONFIG=$(jq -n \
        --arg path "$QDRANT_LOCAL_PATH" \
        --arg collection "$COLLECTION_NAME" \
        '{
            command: "uvx",
            args: ["mcp-server-qdrant"],
            env: {
                HF_HUB_OFFLINE: "1",
                FASTEMBED_CACHE_PATH: "/workspaces/.qdrant/fastembed_cache",
                QDRANT_LOCAL_PATH: $path,
                COLLECTION_NAME: $collection
            }
        }')
fi

# Update settings.json - add or update qdrant server
# Create temporary file for atomic update
TEMP_FILE=$(mktemp)
jq --argjson server "$SERVER_CONFIG" \
    '.mcpServers.qdrant = $server' \
    "$SETTINGS_FILE" > "$TEMP_FILE"

# Verify the JSON is valid
if jq empty "$TEMP_FILE" 2>/dev/null; then
    mv "$TEMP_FILE" "$SETTINGS_FILE"
    echo "[mcp-qdrant] ✓ Qdrant MCP server registered in Claude Code settings"
else
    echo "[mcp-qdrant] ERROR: Generated invalid JSON"
    rm -f "$TEMP_FILE"
    exit 1
fi

# Set proper permissions
chmod 644 "$SETTINGS_FILE"
chown "$(id -un):$(id -gn)" "$SETTINGS_FILE" 2>/dev/null || true

echo "[mcp-qdrant] ✓ Configuration complete"
HOOK_EOF

chmod +x /usr/local/devcontainer-poststart.d/50-mcp-qdrant.sh
echo "[mcp-qdrant] ✓ Post-start hook created at /usr/local/devcontainer-poststart.d/50-mcp-qdrant.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Qdrant MCP Server Installation Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Configuration:"
if [ -n "${QDRANT_URL}" ]; then
    echo "  • Mode: Qdrant Cloud"
    echo "  • URL: ${QDRANT_URL}"
    if [ -n "${QDRANT_API_KEY}" ]; then
        echo "  • API Key: [set]"
    else
        echo "  • API Key: [not set]"
    fi
else
    echo "  • Mode: Local Storage"
    echo "  • Path: ${QDRANT_LOCAL_PATH}"
fi
echo "  • Collection: ${COLLECTION_NAME}"
echo "  • Embedding Model: ${EMBEDDING_MODEL}"
echo "  • User: ${USERNAME}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Next Steps"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Verify installation:"
echo "   uvx mcp-server-qdrant --help"
echo ""
echo "2. MCP server will auto-register with Claude Code on container start"
echo ""
echo "3. Test with your AI agent:"
echo "   'Store this in my Qdrant collection: Hello World'"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
