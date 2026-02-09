#!/bin/bash
set -euo pipefail

# Cleanup on exit
cleanup() {
    rm -f /tmp/splitrail-* 2>/dev/null || true
}
trap cleanup EXIT

# Import options
# NOTE: DevContainer converts camelCase to UPPERCASE without underscores
VERSION="${VERSION:-latest}"
REPO_URL="${REPOURL:-https://github.com/Piebald-AI/splitrail.git}"
BRANCH="${BRANCH:-main}"
USERNAME="${USERNAME:-automatic}"

# Skip installation if version is "none"
if [ "${VERSION}" = "none" ]; then
    echo "[splitrail] Skipping installation (version=none)"
    exit 0
fi

echo "[splitrail] Starting Splitrail installation..."

# Validate git is available
if ! command -v git &>/dev/null; then
    echo "[splitrail] ERROR: git is not available"
    exit 1
fi

# Validate cargo is available
if ! command -v cargo &>/dev/null; then
    echo "[splitrail] ERROR: cargo is not available. Please ensure Rust feature is installed first."
    echo "  Expected cargo at: /usr/local/cargo/bin/cargo"
    exit 1
fi

# Validate input parameters
if [ -n "${REPO_URL}" ]; then
    if [[ ! "${REPO_URL}" =~ ^https?:// ]] && [[ ! "${REPO_URL}" =~ ^git@.+:.+\.git$ ]]; then
        echo "[splitrail] ERROR: repoUrl must be a valid git URL"
        echo "  Provided: ${REPO_URL}"
        echo "  Expected: https://... or git@github.com:.../*.git"
        exit 1
    fi
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

echo "[splitrail] Installing for user: ${USERNAME}"

INSTALL_DIR="/home/${USERNAME}/splitrail"
BINARY="/home/${USERNAME}/.cargo/bin/splitrail"

if [[ -f "$BINARY" ]]; then
    echo "[splitrail] Splitrail already installed at $BINARY. Skipping..."
else
    echo "[splitrail] Installing Splitrail (Rust compilation - may take 2-3 minutes)..."

    # Use explicit cargo path and rustup home (global installation from devcontainer Rust feature)
    export PATH="/usr/local/cargo/bin:$PATH"
    export RUSTUP_HOME="/usr/local/rustup"

    # Fix permissions on rustup directories for non-root user access during build
    mkdir -p /usr/local/rustup/tmp
    chmod -R 777 /usr/local/rustup 2>/dev/null || true

    # Clone and build as detected user
    sudo -u "${USERNAME}" bash -c "
        # Use explicit cargo path and rustup home for user context
        export PATH=\"/usr/local/cargo/bin:\$PATH\"
        export RUSTUP_HOME=\"/usr/local/rustup\"

        cd /home/${USERNAME}
        rm -rf splitrail

        echo \"[splitrail] → Cloning splitrail repository...\"
        git clone -b \"${BRANCH}\" \"${REPO_URL}\" splitrail
        cd splitrail

        echo \"[splitrail] → Compiling splitrail (this will take a few minutes)...\"
        cargo build --release

        echo \"[splitrail] → Installing binary...\"
        cargo install --path .
    "

    # Verify installation
    if [[ ! -f "$BINARY" ]]; then
        echo "[splitrail] ERROR: Splitrail compilation failed - binary not found"
        echo "  Expected location: $BINARY"
        echo "  Check build output above for errors"
        exit 1
    fi

    echo "[splitrail] ✓ Splitrail installed successfully at $BINARY"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Splitrail Installation Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Configuration:"
echo "  • Install Path: ${INSTALL_DIR}"
echo "  • Binary: ${BINARY}"
echo "  • Repository: ${REPO_URL}"
echo "  • Branch: ${BRANCH}"
echo "  • User: ${USERNAME}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Next Steps"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Test the binary:"
echo "   splitrail --version"
echo ""
echo "2. Start monitoring:"
echo "   splitrail"
echo ""
echo "3. View help:"
echo "   splitrail --help"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
