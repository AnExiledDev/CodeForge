#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
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
# The official installer (claude.ai/install.sh) requires curl internally
if ! command -v curl >/dev/null 2>&1; then
	echo "[claude-code-native] ERROR: curl is required"
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
mkdir -p "${USER_HOME}/.local/state"
mkdir -p "${USER_HOME}/.claude"
chown -R "${USERNAME}:" "${USER_HOME}/.local" "${USER_HOME}/.claude"

# === DETERMINE TARGET ===
# The official installer accepts: stable, latest, or a specific semver
TARGET="${VERSION}"
if [ "${TARGET}" != "latest" ] && [ "${TARGET}" != "stable" ]; then
	if ! echo "${TARGET}" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
		echo "[claude-code-native] ERROR: Invalid version '${TARGET}'"
		echo "  Use 'latest', 'stable', or a semver (e.g., 2.1.52)"
		exit 1
	fi
fi

# === INSTALL ===
# The official Anthropic installer handles:
# - Platform detection (linux/darwin, x64/arm64, glibc/musl)
# - Manifest download and checksum verification
# - Binary download to ~/.local/bin/claude (symlink to ~/.local/share/claude/versions/*)
echo "[claude-code-native] Downloading official installer..."

if [ "${USERNAME}" = "root" ]; then
	curl -fsSL https://claude.ai/install.sh | bash -s -- "${TARGET}"
else
	su - "${USERNAME}" -c "curl -fsSL https://claude.ai/install.sh | bash -s -- \"${TARGET}\""
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

# === POST-START HOOK ===
# Ensures hasCompletedOnboarding is set when token auth is configured.
# Runs as the LAST post-start hook (99- prefix) to catch overwrites from
# Claude Code CLI/extension that may race with postStartCommand.
HOOK_DIR="/usr/local/devcontainer-poststart.d"
mkdir -p "$HOOK_DIR"
cat > "$HOOK_DIR/99-claude-onboarding.sh" << 'HOOK_EOF'
#!/bin/bash
# Ensure hasCompletedOnboarding: true in .claude.json when token auth exists.
# Runs after all setup scripts to catch any overwrites by Claude Code CLI/extension.
_USERNAME="${SUDO_USER:-${USER:-vscode}}"
_USER_HOME=$(getent passwd "$_USERNAME" 2>/dev/null | cut -d: -f6)
_USER_HOME="${_USER_HOME:-/home/$_USERNAME}"
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-${_USER_HOME}/.claude}"
CLAUDE_JSON="$CLAUDE_DIR/.claude.json"
CRED_FILE="$CLAUDE_DIR/.credentials.json"

# Only act when token auth is configured
[ -f "$CRED_FILE" ] || exit 0

if [ -f "$CLAUDE_JSON" ]; then
    if ! grep -q '"hasCompletedOnboarding"' "$CLAUDE_JSON" 2>/dev/null; then
        if command -v jq >/dev/null 2>&1; then
            jq '. + {"hasCompletedOnboarding": true}' "$CLAUDE_JSON" > "${CLAUDE_JSON}.tmp" && \
                mv "${CLAUDE_JSON}.tmp" "$CLAUDE_JSON"
        else
            sed -i '$ s/}$/,\n  "hasCompletedOnboarding": true\n}/' "$CLAUDE_JSON"
        fi
        echo "[claude-onboarding] Injected hasCompletedOnboarding into .claude.json"
    fi
else
    printf '{\n  "hasCompletedOnboarding": true\n}\n' > "$CLAUDE_JSON"
    echo "[claude-onboarding] Created .claude.json with hasCompletedOnboarding"
fi
HOOK_EOF
chmod +x "$HOOK_DIR/99-claude-onboarding.sh"

echo "[claude-code-native] Installation complete"
