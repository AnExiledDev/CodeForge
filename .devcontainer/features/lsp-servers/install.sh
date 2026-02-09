#!/bin/bash
# LSP Servers for Claude Code
# Installs pyright, typescript-language-server, and gopls binaries

set -euo pipefail

VERSION="${VERSION:-latest}"
PYRIGHT_VERSION="${PYRIGHTVERSION:-latest}"
TSLSP_VERSION="${TYPESCRIPTLSPVERSION:-latest}"
TS_VERSION="${TYPESCRIPTVERSION:-latest}"
GOPLS_VERSION="${GOPLSVERSION:-latest}"
USERNAME="${USERNAME:-automatic}"

# Skip installation if version is "none"
if [ "${VERSION}" = "none" ]; then
    echo "[lsp-servers] Skipping installation (version=none)"
    exit 0
fi

echo "[lsp-servers] Starting installation..."
echo "[lsp-servers] Pyright version: ${PYRIGHT_VERSION}"
echo "[lsp-servers] TypeScript LSP version: ${TSLSP_VERSION}"
echo "[lsp-servers] TypeScript version: ${TS_VERSION}"
echo "[lsp-servers] gopls version: ${GOPLS_VERSION}"

# Source nvm if available
if [ -f /usr/local/share/nvm/nvm.sh ]; then
    source /usr/local/share/nvm/nvm.sh
fi

# Validate npm is available
if ! command -v npm &>/dev/null; then
    echo "[lsp-servers] ERROR: npm not available"
    echo "  Ensure node feature is installed first"
    exit 1
fi

# Detect user
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

echo "[lsp-servers] Installing for user: ${USERNAME}"

install_npm_package() {
    local name="$1"
    local package="$2"
    local version="$3"

    if [ "${version}" = "latest" ]; then
        NPM_PACKAGE="${package}"
    else
        NPM_PACKAGE="${package}@${version}"
    fi

    echo "[lsp-servers] Installing ${name}..."
    npm install -g "${NPM_PACKAGE}" 2>/dev/null || {
        echo "[lsp-servers] WARNING: Global install failed for ${name}, trying user install"
        su - "${USERNAME}" -c "npm install -g ${NPM_PACKAGE}" 2>/dev/null || {
            echo "[lsp-servers] ERROR: Failed to install ${name}"
            return 1
        }
    }
}

# Install Pyright (Python LSP)
install_npm_package "pyright" "pyright" "${PYRIGHT_VERSION}"

# Install TypeScript (required by typescript-language-server)
install_npm_package "typescript" "typescript" "${TS_VERSION}"

# Install TypeScript Language Server
install_npm_package "typescript-language-server" "typescript-language-server" "${TSLSP_VERSION}"

# Install gopls (Go LSP) - uses go install since it's a Go package
echo "[lsp-servers] Installing gopls..."
if command -v go &>/dev/null; then
    if [ "${GOPLS_VERSION}" = "latest" ]; then
        go install "golang.org/x/tools/gopls@latest" || {
            echo "[lsp-servers] WARNING: Failed to install gopls"
        }
    else
        go install "golang.org/x/tools/gopls@${GOPLS_VERSION}" || {
            echo "[lsp-servers] WARNING: Failed to install gopls"
        }
    fi
else
    echo "[lsp-servers] WARNING: Go not available, skipping gopls"
fi

# Verify installations
echo ""
echo "[lsp-servers] Verifying installations..."

if command -v pyright-langserver &>/dev/null; then
    echo "[lsp-servers] pyright-langserver: $(pyright-langserver --version 2>/dev/null || echo 'installed')"
else
    echo "[lsp-servers] WARNING: pyright-langserver not found in PATH"
fi

if command -v typescript-language-server &>/dev/null; then
    echo "[lsp-servers] typescript-language-server: $(typescript-language-server --version 2>/dev/null || echo 'installed')"
else
    echo "[lsp-servers] WARNING: typescript-language-server not found in PATH"
fi

if command -v gopls &>/dev/null; then
    echo "[lsp-servers] gopls: $(gopls version 2>/dev/null | head -1 || echo 'installed')"
else
    echo "[lsp-servers] WARNING: gopls not found in PATH (Go may not be installed)"
fi

echo "[lsp-servers] Installation complete"
