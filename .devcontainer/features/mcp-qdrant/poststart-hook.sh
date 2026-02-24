#!/bin/bash
set -euo pipefail

echo "[mcp-qdrant] Registering Qdrant MCP server with Claude Code..."

# Ensure embedding model is cached (may be lost after container restart if /tmp is cleared)
FASTEMBED_CACHE="/tmp/fastembed_cache"
EMBEDDING_MODEL="${EMBEDDING_MODEL:-all-MiniLM-L6-v2}"

# Map embedding model to GCS URL and directory name
case "${EMBEDDING_MODEL}" in
    "all-MiniLM-L6-v2"|"sentence-transformers/all-MiniLM-L6-v2")
        MODEL_URL="https://storage.googleapis.com/qdrant-fastembed/sentence-transformers-all-MiniLM-L6-v2.tar.gz"
        MODEL_DIR="fast-all-MiniLM-L6-v2"
        ;;
    "BAAI/bge-small-en-v1.5")
        MODEL_URL="https://storage.googleapis.com/qdrant-fastembed/fast-bge-small-en-v1.5.tar.gz"
        MODEL_DIR="fast-bge-small-en-v1.5"
        ;;
    "BAAI/bge-base-en-v1.5")
        MODEL_URL="https://storage.googleapis.com/qdrant-fastembed/fast-bge-base-en-v1.5.tar.gz"
        MODEL_DIR="fast-bge-base-en-v1.5"
        ;;
    *)
        MODEL_URL=""
        MODEL_DIR=""
        ;;
esac

if [ -n "${MODEL_URL}" ] && [ ! -d "${FASTEMBED_CACHE}/${MODEL_DIR}" ]; then
    echo "[mcp-qdrant] Embedding model cache not found, downloading from GCS..."
    mkdir -p "${FASTEMBED_CACHE}"
    TEMP_TAR=$(mktemp)
    if curl -sL "${MODEL_URL}" -o "${TEMP_TAR}"; then
        tar -xzf "${TEMP_TAR}" -C "${FASTEMBED_CACHE}/" 2>/dev/null || true
        find "${FASTEMBED_CACHE}" -name "._*" -delete 2>/dev/null || true
        rm -f "${TEMP_TAR}"
        chown -R "vscode:vscode" "${FASTEMBED_CACHE}" 2>/dev/null || true
        chmod -R 755 "${FASTEMBED_CACHE}" 2>/dev/null || true
        echo "[mcp-qdrant] ✓ Embedding model downloaded to ${FASTEMBED_CACHE}/${MODEL_DIR}"
    else
        echo "[mcp-qdrant] WARNING: Failed to download embedding model"
        rm -f "${TEMP_TAR}"
    fi
fi

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
SETTINGS_FILE="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json"
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
                FASTEMBED_CACHE_PATH: "/tmp/fastembed_cache",
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
                FASTEMBED_CACHE_PATH: "/tmp/fastembed_cache",
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
chown vscode:vscode "$SETTINGS_FILE" 2>/dev/null || true

echo "[mcp-qdrant] ✓ Configuration complete"
