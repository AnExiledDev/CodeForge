#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
set -euo pipefail

VERSION="${VERSION:-latest}"
USERNAME="${USERNAME:-automatic}"

# Skip if version is "none"
if [ "${VERSION}" = "none" ]; then
	echo "[rtk] Skipping installation (version=none)"
	exit 0
fi

echo "[rtk] Starting installation..."
echo "[rtk] Version: ${VERSION}"

# === VALIDATE DEPENDENCIES ===
if ! command -v curl >/dev/null 2>&1; then
	echo "[rtk] ERROR: curl is required"
	exit 1
fi

if ! command -v tar >/dev/null 2>&1; then
	echo "[rtk] ERROR: tar is required"
	exit 1
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

USER_HOME=$(getent passwd "${USERNAME}" | cut -d: -f6)
if [ -z "${USER_HOME}" ]; then
	echo "[rtk] ERROR: Could not determine home directory for ${USERNAME}"
	exit 1
fi

echo "[rtk] Installing for user: ${USERNAME} (home: ${USER_HOME})"

# === DETERMINE DOWNLOAD URL ===
ARCH="$(uname -m)"
case "${ARCH}" in
	x86_64) BINARY_ARCH="x86_64-unknown-linux-musl" ;;
	aarch64) BINARY_ARCH="aarch64-unknown-linux-musl" ;;
	*)
		echo "[rtk] ERROR: Unsupported architecture: ${ARCH}"
		exit 1
		;;
esac

if [ "${VERSION}" = "latest" ]; then
	DOWNLOAD_URL="https://github.com/rtk-ai/rtk/releases/latest/download/rtk-${BINARY_ARCH}.tar.gz"
else
	if ! echo "${VERSION}" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+'; then
		echo "[rtk] ERROR: Invalid version '${VERSION}'"
		echo "  Use 'latest' or a specific semver (e.g., 0.38.0)"
		exit 1
	fi
	DOWNLOAD_URL="https://github.com/rtk-ai/rtk/releases/download/v${VERSION}/rtk-${BINARY_ARCH}.tar.gz"
fi

# === INSTALL ===
echo "[rtk] Downloading from: ${DOWNLOAD_URL}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

if ! curl -fsSL "${DOWNLOAD_URL}" -o "${TMP_DIR}/rtk.tar.gz"; then
	echo "[rtk] ERROR: Failed to download RTK binary"
	echo "  URL: ${DOWNLOAD_URL}"
	exit 1
fi

tar -xzf "${TMP_DIR}/rtk.tar.gz" -C "${TMP_DIR}"

# Find the rtk binary (may be in a subdirectory)
RTK_BIN=$(find "${TMP_DIR}" -name "rtk" -type f -executable | head -1)
if [ -z "${RTK_BIN}" ]; then
	# Try without executable flag (might not be preserved in tar)
	RTK_BIN=$(find "${TMP_DIR}" -name "rtk" -type f | head -1)
fi

if [ -z "${RTK_BIN}" ]; then
	echo "[rtk] ERROR: Could not find rtk binary in archive"
	ls -laR "${TMP_DIR}"
	exit 1
fi

chmod +x "${RTK_BIN}"
mv "${RTK_BIN}" /usr/local/bin/rtk

# === CREATE CONFIG DIRECTORY ===
mkdir -p "${USER_HOME}/.config/rtk"
chown -R "${USERNAME}:" "${USER_HOME}/.config/rtk"

# === VERIFICATION ===
if command -v rtk >/dev/null 2>&1; then
	INSTALLED_VERSION=$(rtk --version 2>/dev/null || echo "unknown")
	echo "[rtk] RTK installed: ${INSTALLED_VERSION}"
	echo "[rtk]   Binary: $(command -v rtk)"
else
	echo "[rtk] ERROR: Installation failed -- rtk not found in PATH"
	exit 1
fi

echo "[rtk] Installation complete"
