#!/bin/bash
set -euo pipefail

# ==============================
# shfmt DevContainer Feature
# Direct binary from GitHub releases
# ==============================

SHFMT_VERSION="${VERSION:-latest}"

# Skip installation if version is "none"
if [ "${SHFMT_VERSION}" = "none" ]; then
    echo "[shfmt] Skipping installation (version=none)"
    exit 0
fi

echo "[shfmt] Starting installation..."

# ---------- HELPERS ----------
download_with_retry() {
    local url="$1" dest="$2" retries="${3:-3}" delay="${4:-2}"
    local attempt=1
    while [ $attempt -le $retries ]; do
        if curl -fsSL ${GITHUB_AUTH_HEADER:-} "$url" -o "$dest" 2>/dev/null; then
            return 0
        fi
        echo "[shfmt] Download attempt $attempt/$retries failed, retrying in ${delay}s..."
        sleep "$delay"
        attempt=$((attempt + 1))
        delay=$((delay * 2))
    done
    echo "[shfmt] ERROR: Download failed after $retries attempts: $url"
    return 1
}

# GitHub API auth header (avoids rate limiting)
GITHUB_AUTH_HEADER=""
if [ -n "${GH_TOKEN:-}" ] || [ -n "${GITHUB_TOKEN:-}" ]; then
    GITHUB_AUTH_HEADER="-H Authorization: token ${GH_TOKEN:-$GITHUB_TOKEN}"
fi

ARCH="$(dpkg --print-architecture)"
case "${ARCH}" in
    amd64) GOARCH="amd64" ;;
    arm64) GOARCH="arm64" ;;
    *)
        echo "[shfmt] ERROR: Unsupported architecture: ${ARCH}" >&2
        exit 1
        ;;
esac

# Version pinned for reproducible builds. Set "latest" to always get newest.
if [[ "${SHFMT_VERSION}" == "latest" ]]; then
    SHFMT_VERSION="$(curl -fsSL ${GITHUB_AUTH_HEADER:-} https://api.github.com/repos/mvdan/sh/releases/latest | grep -o '"tag_name": *"[^"]*"' | head -1 | cut -d'"' -f4)"
    echo "[shfmt] Resolved latest version: ${SHFMT_VERSION}"
fi

URL="https://github.com/mvdan/sh/releases/download/${SHFMT_VERSION}/shfmt_${SHFMT_VERSION}_linux_${GOARCH}"
echo "[shfmt] Downloading from: ${URL}"

TMP_DIR="$(mktemp -d)"
download_with_retry "${URL}" "${TMP_DIR}/shfmt"

# ---------- CHECKSUM VERIFICATION ----------
CHECKSUM_URL="https://github.com/mvdan/sh/releases/download/${SHFMT_VERSION}/sha256sums.txt"
if curl -fsSL "${CHECKSUM_URL}" -o "${TMP_DIR}/checksums.txt" 2>/dev/null; then
    EXPECTED=$(grep "shfmt_${SHFMT_VERSION}_linux_${GOARCH}" "${TMP_DIR}/checksums.txt" | awk '{print $1}')
    ACTUAL=$(sha256sum "${TMP_DIR}/shfmt" | cut -d' ' -f1)
    if [ -n "$EXPECTED" ] && [ "$ACTUAL" != "$EXPECTED" ]; then
        echo "[shfmt] ERROR: Checksum verification failed"
        echo "  Expected: $EXPECTED"
        echo "  Actual:   $ACTUAL"
        rm -rf "${TMP_DIR}"
        exit 1
    fi
    echo "[shfmt] Checksum verified"
else
    echo "[shfmt] WARNING: Could not fetch checksums, skipping verification"
fi

cp "${TMP_DIR}/shfmt" /usr/local/bin/shfmt
chmod +x /usr/local/bin/shfmt
rm -rf "${TMP_DIR}"

echo "[shfmt] Installed: $(shfmt --version 2>/dev/null || echo 'unknown')"
