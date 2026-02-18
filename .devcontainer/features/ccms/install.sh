#!/bin/bash
set -euo pipefail

# === SETUP ===
cleanup() {
    :
}
trap cleanup EXIT

# === IMPORT OPTIONS ===
CCMS_VERSION="${VERSION:-latest}"
USERNAME="${USERNAME:-automatic}"

# Skip installation if version is "none"
if [ "${CCMS_VERSION}" = "none" ]; then
    echo "[ccms] Skipping installation (version=none)"
    exit 0
fi

echo "[ccms] Starting ccms installation..."

# === VALIDATE DEPENDENCIES ===
# Source cargo env if available (Rust feature installs via rustup)
if [ -f /usr/local/cargo/env ]; then
    source /usr/local/cargo/env
elif [ -f "${HOME}/.cargo/env" ]; then
    source "${HOME}/.cargo/env"
fi

if ! command -v cargo &>/dev/null; then
    echo "[ccms] ERROR: cargo is not available"
    echo "  Ensure the Rust devcontainer feature is installed first:"
    echo "  \"ghcr.io/devcontainers/features/rust:1\": {}"
    exit 1
fi

echo "[ccms] Using cargo: $(cargo --version)"

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

echo "[ccms] Installing for user: ${USERNAME}"

# === BUILD CACHE ===
CACHE_DIR="/workspaces/.devcontainer/.build-cache/bin"

# === INSTALL ===
REPO_URL="https://github.com/mkusaka/ccms"

if [ -x "${CACHE_DIR}/ccms" ]; then
    echo "[ccms] Using cached binary from ${CACHE_DIR}/ccms"
    cp "${CACHE_DIR}/ccms" /usr/local/bin/ccms
    chmod +x /usr/local/bin/ccms
else
    if [ "${CCMS_VERSION}" = "latest" ]; then
        echo "[ccms] Building from main branch..."
        cargo install --git "${REPO_URL}" --rev f90d259a4476 2>&1 | tail -5
    else
        echo "[ccms] Building from ref: ${CCMS_VERSION}..."
        cargo install --git "${REPO_URL}" --rev "${CCMS_VERSION}" 2>&1 | tail -5
    fi

    # === ENSURE BINARY IS ON PATH ===
    # cargo install puts binaries in $CARGO_HOME/bin or ~/.cargo/bin
    # Symlink to /usr/local/bin so it's available to all users
    CARGO_BIN="${CARGO_HOME:-$HOME/.cargo}/bin/ccms"
    if [ -f "${CARGO_BIN}" ] && [ ! -f /usr/local/bin/ccms ]; then
        ln -s "${CARGO_BIN}" /usr/local/bin/ccms
        echo "[ccms] Symlinked ${CARGO_BIN} → /usr/local/bin/ccms"
    fi

    # Cache the binary for future rebuilds
    mkdir -p "${CACHE_DIR}"
    CARGO_BIN="${CARGO_HOME:-$HOME/.cargo}/bin/ccms"
    if [ -f "${CARGO_BIN}" ]; then
        cp "${CARGO_BIN}" "${CACHE_DIR}/ccms"
        echo "[ccms] Cached binary to ${CACHE_DIR}/ccms"
    fi
fi

# === VERIFICATION ===
echo "[ccms] Verifying installation..."
if command -v ccms &>/dev/null; then
    INSTALLED_VERSION=$(ccms --version 2>/dev/null || echo "unknown")
    echo "[ccms] ✓ ccms installed: ${INSTALLED_VERSION}"
else
    echo "[ccms] WARNING: ccms not found on PATH after installation"
    echo "  Binary location: ${CARGO_BIN}"
    echo "  You may need to add cargo bin to PATH"
fi

# === SUMMARY ===
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ccms Installation Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Configuration:"
echo "  • User: ${USERNAME}"
echo "  • Version: ${CCMS_VERSION}"
echo "  • Binary: $(which ccms 2>/dev/null || echo "${CARGO_BIN}")"
echo ""
echo "Usage:"
echo "  ccms \"query\"                    # Search all sessions"
echo "  ccms --project \$(pwd) \"query\"   # Search current project"
echo "  ccms -r user \"query\"            # Filter by role"
echo "  ccms -f json \"query\" -n 10      # JSON output, limited"
echo "  ccms --since \"1 day ago\" \"q\"    # Time-scoped search"
echo "  ccms                            # Interactive TUI mode"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
