#!/bin/bash
set -euo pipefail

# === IMPORT OPTIONS ===
# DevContainer converts camelCase to UPPERCASE without underscores
VERSION="${VERSION:-latest}"
BINDINGS="${BINDINGS:-both}"
INSTALL_CLI="${INSTALLCLI:-true}"
GRAMMARS="${GRAMMARS:-}"
USERNAME="${USERNAME:-automatic}"

# Skip installation if version is "none"
if [ "${VERSION}" = "none" ]; then
    echo "[tree-sitter] Skipping installation (version=none)"
    exit 0
fi

echo "[tree-sitter] Starting tree-sitter installation..."
echo "[tree-sitter] Options: version=${VERSION}, bindings=${BINDINGS}, cli=${INSTALL_CLI}"

# === SOURCE NVM ===
if [ -f /usr/local/share/nvm/nvm.sh ]; then
    source /usr/local/share/nvm/nvm.sh
fi

# === VALIDATE BINDINGS OPTION ===
if [[ ! "${BINDINGS}" =~ ^(node|python|both|none)$ ]]; then
    echo "[tree-sitter] ERROR: bindings must be 'node', 'python', 'both', or 'none'"
    echo "  Provided: ${BINDINGS}"
    exit 1
fi

# === VALIDATE DEPENDENCIES ===
NEED_NODE=false
NEED_PYTHON=false

if [ "${BINDINGS}" = "node" ] || [ "${BINDINGS}" = "both" ]; then
    NEED_NODE=true
fi
if [ "${BINDINGS}" = "python" ] || [ "${BINDINGS}" = "both" ]; then
    NEED_PYTHON=true
fi

# CLI installation requires npm
if [ "${INSTALL_CLI}" = "true" ]; then
    NEED_NODE=true
fi

if [ "${NEED_NODE}" = "true" ]; then
    if ! command -v npm &>/dev/null; then
        echo "[tree-sitter] ERROR: npm not available but required for CLI or node bindings"
        echo "  Ensure node feature is installed first"
        exit 1
    fi
    echo "[tree-sitter] Node.js: $(node --version)"
fi

if [ "${NEED_PYTHON}" = "true" ]; then
    if ! command -v pip &>/dev/null && ! command -v pip3 &>/dev/null; then
        echo "[tree-sitter] ERROR: pip not available but python bindings requested"
        echo "  Ensure python feature is installed first"
        exit 1
    fi
    echo "[tree-sitter] Python: $(python3 --version)"
fi

# === DETECT USER ===
if [ "${USERNAME}" = "auto" ] || [ "${USERNAME}" = "automatic" ]; then
    if [ -n "${_REMOTE_USER:-}" ]; then
        USERNAME="${_REMOTE_USER}"
    elif getent passwd vscode >/dev/null 2>&1; then
        USERNAME="vscode"
    elif getent passwd node >/dev/null 2>&1; then
        USERNAME="node"
    elif getent passwd codespace >/dev/null 2>&1; then
        USERNAME="codespace"
    else
        USERNAME="root"
    fi
fi

if [ "${USERNAME}" = "root" ]; then
    USER_HOME="/root"
else
    USER_HOME=$(getent passwd "${USERNAME}" | cut -d: -f6)
fi

echo "[tree-sitter] Installing for user: ${USERNAME} (home: ${USER_HOME})"

# === INSTALL CLI VIA NPM ===
if [ "${INSTALL_CLI}" = "true" ]; then
    echo "[tree-sitter] Installing tree-sitter CLI via npm..."

    # Build version specifier
    if [ "${VERSION}" = "latest" ]; then
        NPM_PACKAGE="tree-sitter-cli"
    else
        NPM_PACKAGE="tree-sitter-cli@${VERSION}"
    fi

    npm install -g "${NPM_PACKAGE}" 2>/dev/null || {
        echo "[tree-sitter] WARNING: Global npm install failed, trying user install"
        su - "${USERNAME}" -c "npm install -g ${NPM_PACKAGE}" 2>/dev/null || true
    }

    echo "[tree-sitter] CLI installed: $(tree-sitter --version 2>/dev/null || echo 'unknown')"
fi

# === INSTALL NODE BINDINGS ===
if [ "${BINDINGS}" = "node" ] || [ "${BINDINGS}" = "both" ]; then
    echo "[tree-sitter] Installing Node.js bindings..."

    # Install web-tree-sitter for runtime parsing
    npm install -g web-tree-sitter 2>/dev/null || {
        echo "[tree-sitter] WARNING: Global npm install failed, trying user install"
        su - "${USERNAME}" -c "npm install -g web-tree-sitter" 2>/dev/null || true
    }

    # Install grammars if specified
    if [ -n "${GRAMMARS}" ]; then
        echo "[tree-sitter] Installing Node.js grammars: ${GRAMMARS}"
        IFS=',' read -ra GRAMMAR_LIST <<< "${GRAMMARS}"
        for grammar in "${GRAMMAR_LIST[@]}"; do
            grammar=$(echo "${grammar}" | xargs)  # trim whitespace
            if [ -n "${grammar}" ]; then
                npm install -g "tree-sitter-${grammar}" 2>/dev/null || {
                    echo "[tree-sitter] WARNING: Failed to install grammar: ${grammar}"
                }
            fi
        done
    fi

    echo "[tree-sitter] Node.js bindings installed"
fi

# === INSTALL PYTHON BINDINGS ===
if [ "${NEED_PYTHON}" = "true" ]; then
    echo "[tree-sitter] Installing Python bindings..."

    # Use pip3 with --break-system-packages for system python
    PIP_CMD="pip3"
    if command -v pip &>/dev/null; then
        PIP_CMD="pip"
    fi

    # Install tree-sitter python package
    ${PIP_CMD} install --break-system-packages tree-sitter 2>/dev/null || \
    ${PIP_CMD} install tree-sitter 2>/dev/null || {
        echo "[tree-sitter] WARNING: System pip install failed, trying user install"
        su - "${USERNAME}" -c "${PIP_CMD} install --user tree-sitter" 2>/dev/null || true
    }

    # Install grammars if specified
    if [ -n "${GRAMMARS}" ]; then
        echo "[tree-sitter] Installing Python grammars: ${GRAMMARS}"
        IFS=',' read -ra GRAMMAR_LIST <<< "${GRAMMARS}"
        for grammar in "${GRAMMAR_LIST[@]}"; do
            grammar=$(echo "${grammar}" | xargs)  # trim whitespace
            if [ -n "${grammar}" ]; then
                ${PIP_CMD} install --break-system-packages "tree-sitter-${grammar}" 2>/dev/null || \
                ${PIP_CMD} install "tree-sitter-${grammar}" 2>/dev/null || {
                    echo "[tree-sitter] WARNING: Failed to install grammar: ${grammar}"
                }
            fi
        done
    fi

    echo "[tree-sitter] Python bindings installed"
fi

# === SUMMARY ===
echo ""
echo "[tree-sitter] Installation complete!"
echo "  CLI:     $(command -v tree-sitter &>/dev/null && echo "installed ($(tree-sitter --version 2>/dev/null || echo 'unknown'))" || echo "not installed")"
echo "  Node.js: $([ "${NEED_NODE}" = "true" ] && echo "installed" || echo "skipped")"
echo "  Python:  $([ "${NEED_PYTHON}" = "true" ] && echo "installed" || echo "skipped")"
if [ -n "${GRAMMARS}" ]; then
    echo "  Grammars: ${GRAMMARS}"
fi
