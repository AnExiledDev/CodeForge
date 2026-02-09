#!/bin/bash
# Update Claude Code CLI to the latest version (native binary only)
# Runs non-blocking in background by default via setup.sh
# All failures are warnings — this script never blocks container startup

echo "[update-claude] Checking for Claude Code updates..."

# === TMPDIR ===
_TMPDIR="${TMPDIR:-/tmp}"

# === LOCK FILE (prevent concurrent updates) ===
LOCK_FILE="${_TMPDIR}/claude-update.lock"
if ! mkdir "$LOCK_FILE" 2>/dev/null; then
    echo "[update-claude] Another update is already running, skipping"
    exit 0
fi

# === CLEANUP TRAP ===
cleanup() {
    rm -f "${_TMPDIR}/claude-update" 2>/dev/null || true
    rm -f "${_TMPDIR}/claude-update-manifest.json" 2>/dev/null || true
    rm -rf "$LOCK_FILE" 2>/dev/null || true
}
trap cleanup EXIT

# === VERIFY CLAUDE IS INSTALLED ===
if ! command -v claude &>/dev/null; then
    echo "[update-claude] Claude Code not found, skipping update"
    exit 0
fi

# === DETECT INSTALL METHOD ===
CLAUDE_PATH=$(command -v claude)
if [[ "$CLAUDE_PATH" != "/usr/local/bin/claude" ]]; then
    echo "[update-claude] Non-native install detected ($CLAUDE_PATH), skipping"
    exit 0
fi

# === VALIDATE DEPENDENCIES ===
for dep in curl jq sha256sum sudo; do
    if ! command -v "$dep" &>/dev/null; then
        echo "[update-claude] WARNING: $dep not available, skipping update"
        exit 0
    fi
done

# === GET CURRENT VERSION ===
CURRENT_VERSION=$(claude --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "unknown")
echo "[update-claude] Current version: ${CURRENT_VERSION}"

# === FETCH LATEST VERSION ===
BASE_URL="https://storage.googleapis.com/claude-code-dist-86c565f3-f756-42ad-8dfa-d59b1c096819/claude-code-releases"

LATEST_VERSION=$(curl -fsSL "${BASE_URL}/stable" 2>/dev/null)
if [ -z "$LATEST_VERSION" ]; then
    echo "[update-claude] WARNING: Failed to fetch latest version, skipping"
    exit 0
fi

echo "[update-claude] Latest version: ${LATEST_VERSION}"

# === COMPARE VERSIONS ===
if [ "$CURRENT_VERSION" = "$LATEST_VERSION" ]; then
    echo "[update-claude] Already up to date (${CURRENT_VERSION})"
    exit 0
fi

echo "[update-claude] Updating from ${CURRENT_VERSION} to ${LATEST_VERSION}..."

# === DETECT PLATFORM ===
ARCH=$(uname -m)
case "${ARCH}" in
    x86_64)
        PLATFORM="linux-x64"
        ;;
    aarch64|arm64)
        PLATFORM="linux-arm64"
        ;;
    *)
        echo "[update-claude] WARNING: Unsupported architecture: ${ARCH}, skipping"
        exit 0
        ;;
esac

# Detect musl (Alpine Linux)
if ldd --version 2>&1 | grep -qi musl; then
    PLATFORM="${PLATFORM}-musl"
fi

echo "[update-claude] Platform: ${PLATFORM}"

# === DOWNLOAD MANIFEST ===
MANIFEST_URL="${BASE_URL}/${LATEST_VERSION}/manifest.json"

if ! curl -fsSL "${MANIFEST_URL}" -o ${_TMPDIR}/claude-update-manifest.json 2>/dev/null; then
    echo "[update-claude] WARNING: Failed to download manifest, skipping"
    exit 0
fi

# === EXTRACT AND VERIFY CHECKSUM ===
EXPECTED_CHECKSUM=$(jq -r ".platforms.\"${PLATFORM}\".checksum" ${_TMPDIR}/claude-update-manifest.json)
if [ -z "${EXPECTED_CHECKSUM}" ] || [ "${EXPECTED_CHECKSUM}" = "null" ]; then
    echo "[update-claude] WARNING: Platform ${PLATFORM} not found in manifest, skipping"
    exit 0
fi

# === DOWNLOAD BINARY ===
BINARY_URL="${BASE_URL}/${LATEST_VERSION}/${PLATFORM}/claude"

if ! curl -fsSL "${BINARY_URL}" -o ${_TMPDIR}/claude-update 2>/dev/null; then
    echo "[update-claude] WARNING: Failed to download binary, skipping"
    exit 0
fi

# === VERIFY CHECKSUM ===
ACTUAL_CHECKSUM=$(sha256sum ${_TMPDIR}/claude-update | cut -d' ' -f1)

if [ "${ACTUAL_CHECKSUM}" != "${EXPECTED_CHECKSUM}" ]; then
    echo "[update-claude] WARNING: Checksum verification failed, skipping"
    echo "[update-claude]   Expected: ${EXPECTED_CHECKSUM}"
    echo "[update-claude]   Actual:   ${ACTUAL_CHECKSUM}"
    exit 0
fi

# === INSTALL (atomic replace) ===
chmod +x ${_TMPDIR}/claude-update
if ! sudo mv ${_TMPDIR}/claude-update /usr/local/bin/claude; then
    echo "[update-claude] WARNING: Failed to install update (sudo mv failed), skipping"
    exit 0
fi

# === VERIFY UPDATE ===
INSTALLED_VERSION=$(claude --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "unknown")
echo "[update-claude] Updated Claude Code: ${CURRENT_VERSION} → ${INSTALLED_VERSION}"
