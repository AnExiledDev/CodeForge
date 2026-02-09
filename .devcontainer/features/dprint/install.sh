#!/bin/bash
set -euo pipefail

# ==============================
# dprint DevContainer Feature
# Official installer + global config
# ==============================

DPRINT_VERSION="${VERSION:-latest}"
USERNAME="${USERNAME:-automatic}"

# Skip installation if version is "none"
if [ "${DPRINT_VERSION}" = "none" ]; then
    echo "[dprint] Skipping installation (version=none)"
    exit 0
fi

echo "[dprint] Starting installation..."

# ---------- USER ----------
if [[ "${USERNAME}" == "auto" || "${USERNAME}" == "automatic" ]]; then
    for u in vscode node codespace; do
        if id -u "$u" >/dev/null 2>&1; then
            USERNAME="$u"
            break
        fi
    done
    USERNAME="${USERNAME:-root}"
fi

USER_HOME="$(eval echo "~${USERNAME}")"

echo "[dprint] Target user: ${USERNAME}"
echo "[dprint] Version: ${DPRINT_VERSION}"

# ---------- HELPERS ----------
download_with_retry() {
    local url="$1" dest="$2" retries="${3:-3}" delay="${4:-2}"
    local attempt=1
    while [ $attempt -le $retries ]; do
        if curl -fsSL ${GITHUB_AUTH_HEADER:-} "$url" -o "$dest" 2>/dev/null; then
            return 0
        fi
        echo "[dprint] Download attempt $attempt/$retries failed, retrying in ${delay}s..."
        sleep "$delay"
        attempt=$((attempt + 1))
        delay=$((delay * 2))
    done
    echo "[dprint] ERROR: Download failed after $retries attempts: $url"
    return 1
}

# GitHub API auth header (avoids rate limiting)
GITHUB_AUTH_HEADER=""
if [ -n "${GH_TOKEN:-}" ] || [ -n "${GITHUB_TOKEN:-}" ]; then
    GITHUB_AUTH_HEADER="-H Authorization: token ${GH_TOKEN:-$GITHUB_TOKEN}"
fi

# ---------- INSTALL ----------
# Install to a system-wide location so all users can access it
export DPRINT_INSTALL="/usr/local/share/dprint"
mkdir -p "${DPRINT_INSTALL}/bin"

ARCH="$(dpkg --print-architecture)"
case "${ARCH}" in
    amd64) TARGET="x86_64-unknown-linux-gnu" ;;
    arm64) TARGET="aarch64-unknown-linux-gnu" ;;
    *)
        echo "[dprint] ERROR: Unsupported architecture: ${ARCH}" >&2
        exit 1
        ;;
esac

# Version pinned for reproducible builds. Set "latest" to always get newest.
if [[ "${DPRINT_VERSION}" == "latest" ]]; then
    DPRINT_VERSION="$(curl -fsSL ${GITHUB_AUTH_HEADER:-} https://api.github.com/repos/dprint/dprint/releases/latest | grep -o '"tag_name": *"[^"]*"' | head -1 | cut -d'"' -f4)"
    echo "[dprint] Resolved latest version: ${DPRINT_VERSION}"
fi

ZIP_URL="https://github.com/dprint/dprint/releases/download/${DPRINT_VERSION}/dprint-${TARGET}.zip"
echo "[dprint] Downloading from: ${ZIP_URL}"

TMP_DIR="$(mktemp -d)"
download_with_retry "${ZIP_URL}" "${TMP_DIR}/dprint.zip"

# ---------- CHECKSUM VERIFICATION ----------
CHECKSUM_URL="https://github.com/dprint/dprint/releases/download/${DPRINT_VERSION}/SHASUMS256.txt"
if curl -fsSL "${CHECKSUM_URL}" -o "${TMP_DIR}/checksums.txt" 2>/dev/null; then
    EXPECTED=$(grep "dprint-${TARGET}.zip" "${TMP_DIR}/checksums.txt" | awk '{print $1}')
    ACTUAL=$(sha256sum "${TMP_DIR}/dprint.zip" | cut -d' ' -f1)
    if [ -n "$EXPECTED" ] && [ "$ACTUAL" != "$EXPECTED" ]; then
        echo "[dprint] ERROR: Checksum verification failed"
        echo "  Expected: $EXPECTED"
        echo "  Actual:   $ACTUAL"
        rm -rf "${TMP_DIR}"
        exit 1
    fi
    echo "[dprint] Checksum verified"
else
    echo "[dprint] WARNING: Could not fetch checksums, skipping verification"
fi

unzip -o "${TMP_DIR}/dprint.zip" -d "${DPRINT_INSTALL}/bin"
chmod +x "${DPRINT_INSTALL}/bin/dprint"
rm -rf "${TMP_DIR}"

# Symlink into PATH
ln -sf "${DPRINT_INSTALL}/bin/dprint" /usr/local/bin/dprint

# ---------- GLOBAL CONFIG ----------
cat > "${DPRINT_INSTALL}/dprint.json" << 'DPRINT_CONFIG'
{
  "lineWidth": 120,
  "indentWidth": 2,
  "markdown": {},
  "yaml": {},
  "toml": {},
  "dockerfile": {},
  "plugins": [
    "https://plugins.dprint.dev/markdown-0.17.8.wasm",
    "https://plugins.dprint.dev/g-plane/pretty_yaml-0.5.0.wasm",
    "https://plugins.dprint.dev/toml-0.6.4.wasm",
    "https://plugins.dprint.dev/dockerfile-0.3.2.wasm"
  ]
}
DPRINT_CONFIG

echo "[dprint] Global config written to ${DPRINT_INSTALL}/dprint.json"

# ---------- VERIFY ----------
echo "[dprint] Installed: $(dprint --version 2>/dev/null || echo 'unknown')"
