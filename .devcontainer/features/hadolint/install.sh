#!/bin/bash
set -euo pipefail

# ==============================
# hadolint DevContainer Feature
# Direct binary from GitHub releases
# ==============================

HADOLINT_VERSION="${VERSION:-latest}"

# Skip installation if version is "none"
if [ "${HADOLINT_VERSION}" = "none" ]; then
    echo "[hadolint] Skipping installation (version=none)"
    exit 0
fi

echo "[hadolint] Starting installation..."

# ---------- HELPERS ----------
download_with_retry() {
    local url="$1" dest="$2" retries="${3:-3}" delay="${4:-2}"
    local attempt=1
    while [ $attempt -le $retries ]; do
        if curl -fsSL ${GITHUB_AUTH_HEADER:-} "$url" -o "$dest" 2>/dev/null; then
            return 0
        fi
        echo "[hadolint] Download attempt $attempt/$retries failed, retrying in ${delay}s..."
        sleep "$delay"
        attempt=$((attempt + 1))
        delay=$((delay * 2))
    done
    echo "[hadolint] ERROR: Download failed after $retries attempts: $url"
    return 1
}

# GitHub API auth header (avoids rate limiting)
GITHUB_AUTH_HEADER=""
if [ -n "${GH_TOKEN:-}" ] || [ -n "${GITHUB_TOKEN:-}" ]; then
    GITHUB_AUTH_HEADER="-H Authorization: token ${GH_TOKEN:-$GITHUB_TOKEN}"
fi

ARCH="$(dpkg --print-architecture)"
case "${ARCH}" in
    amd64) BINARY_ARCH="x86_64" ;;
    arm64) BINARY_ARCH="arm64" ;;
    *)
        echo "[hadolint] ERROR: Unsupported architecture: ${ARCH}" >&2
        exit 1
        ;;
esac

# Version pinned for reproducible builds. Set "latest" to always get newest.
if [[ "${HADOLINT_VERSION}" == "latest" ]]; then
    HADOLINT_VERSION="$(curl -fsSL ${GITHUB_AUTH_HEADER:-} https://api.github.com/repos/hadolint/hadolint/releases/latest | grep -o '"tag_name": *"[^"]*"' | head -1 | cut -d'"' -f4)"
    echo "[hadolint] Resolved latest version: ${HADOLINT_VERSION}"
fi

URL="https://github.com/hadolint/hadolint/releases/download/${HADOLINT_VERSION}/hadolint-Linux-${BINARY_ARCH}"
echo "[hadolint] Downloading from: ${URL}"

TMP_DIR="$(mktemp -d)"
download_with_retry "${URL}" "${TMP_DIR}/hadolint"

# ---------- CHECKSUM VERIFICATION ----------
# hadolint publishes per-binary .sha256 files
CHECKSUM_URL="${URL}.sha256"
if curl -fsSL "${CHECKSUM_URL}" -o "${TMP_DIR}/checksum.sha256" 2>/dev/null; then
    EXPECTED=$(awk '{print $1}' "${TMP_DIR}/checksum.sha256")
    ACTUAL=$(sha256sum "${TMP_DIR}/hadolint" | cut -d' ' -f1)
    if [ -n "$EXPECTED" ] && [ "$ACTUAL" != "$EXPECTED" ]; then
        echo "[hadolint] ERROR: Checksum verification failed"
        echo "  Expected: $EXPECTED"
        echo "  Actual:   $ACTUAL"
        rm -rf "${TMP_DIR}"
        exit 1
    fi
    echo "[hadolint] Checksum verified"
else
    echo "[hadolint] WARNING: Could not fetch checksum, skipping verification"
fi

cp "${TMP_DIR}/hadolint" /usr/local/bin/hadolint
chmod +x /usr/local/bin/hadolint
rm -rf "${TMP_DIR}"

echo "[hadolint] Installed: $(hadolint --version 2>/dev/null || echo 'unknown')"
