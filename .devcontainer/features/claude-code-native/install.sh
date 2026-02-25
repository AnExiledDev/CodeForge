#!/bin/bash
set -euo pipefail

VERSION="${VERSION:-latest}"
USERNAME="${USERNAME:-automatic}"

# Skip installation if version is "none"
if [ "${VERSION}" = "none" ]; then
	echo "[claude-code-native] Skipping installation (version=none)"
	exit 0
fi

echo "[claude-code-native] Starting installation..."
echo "[claude-code-native] Version: ${VERSION}"

# === VALIDATE DEPENDENCIES ===
if ! command -v curl &>/dev/null && ! command -v wget &>/dev/null; then
	echo "[claude-code-native] ERROR: curl or wget is required"
	echo "  Ensure common-utils feature is installed first"
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
	echo "[claude-code-native] ERROR: Could not determine home directory for ${USERNAME}"
	exit 1
fi

echo "[claude-code-native] Installing for user: ${USERNAME} (home: ${USER_HOME})"

# === PREPARE DIRECTORIES ===
mkdir -p "${USER_HOME}/.local/bin"
mkdir -p "${USER_HOME}/.local/share/claude"
chown -R "${USERNAME}:" "${USER_HOME}/.local/bin" "${USER_HOME}/.local/share/claude"

# === DETERMINE TARGET ===
# The official installer accepts: stable, latest, or a specific semver
TARGET=""
if [ "${VERSION}" != "latest" ] && [ "${VERSION}" != "stable" ]; then
	TARGET="${VERSION}"
else
	TARGET="${VERSION}"
fi

# === INSTALL ===
# The official Anthropic installer handles:
# - Platform detection (linux/darwin, x64/arm64, glibc/musl)
# - Manifest download and checksum verification
# - Binary download to ~/.local/bin/claude (symlink to ~/.local/share/claude/versions/*)
echo "[claude-code-native] Downloading official installer..."

if [ "${USERNAME}" = "root" ]; then
	curl -fsSL https://claude.ai/install.sh | sh -s -- "${TARGET}"
else
	su - "${USERNAME}" -c "curl -fsSL https://claude.ai/install.sh | sh -s -- ${TARGET}"
fi

# === VERIFICATION ===
CLAUDE_BIN="${USER_HOME}/.local/bin/claude"

if [ -x "${CLAUDE_BIN}" ]; then
	INSTALLED_VERSION=$(su - "${USERNAME}" -c "${CLAUDE_BIN} --version 2>/dev/null" || echo "unknown")
	echo "[claude-code-native] ✓ Claude Code installed: ${INSTALLED_VERSION}"
	echo "[claude-code-native]   Binary: ${CLAUDE_BIN}"
else
	echo "[claude-code-native] ERROR: Installation failed — ${CLAUDE_BIN} not found or not executable"
	echo "[claude-code-native] Expected binary at: ${CLAUDE_BIN}"
	ls -la "${USER_HOME}/.local/bin/" 2>/dev/null || true
	exit 1
fi

echo "[claude-code-native] Installation complete"
