#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
set -euo pipefail

VERSION="${VERSION:-latest}"
USERNAME="${USERNAME:-automatic}"

# Skip if version is "none"
if [ "${VERSION}" = "none" ]; then
	echo "[codex-cli] Skipping installation (version=none)"
	exit 0
fi

echo "[codex-cli] Starting installation..."
echo "[codex-cli] Version: ${VERSION}"

# === VALIDATE DEPENDENCIES ===
if ! command -v npm >/dev/null 2>&1; then
	echo "[codex-cli] ERROR: npm is required"
	echo "  Ensure node feature is installed first"
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
	echo "[codex-cli] ERROR: Could not determine home directory for ${USERNAME}"
	exit 1
fi

echo "[codex-cli] Installing for user: ${USERNAME} (home: ${USER_HOME})"

# === PREPARE DIRECTORIES ===
mkdir -p "${USER_HOME}/.codex"
chown -R "${USERNAME}:" "${USER_HOME}/.codex"

# === DETERMINE PACKAGE ===
if [ "${VERSION}" = "latest" ]; then
	PACKAGE="@openai/codex"
else
	if ! echo "${VERSION}" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+'; then
		echo "[codex-cli] ERROR: Invalid version '${VERSION}'"
		echo "  Use 'latest' or a semver (e.g., 1.0.9)"
		exit 1
	fi
	PACKAGE="@openai/codex@${VERSION}"
fi

# === INSTALL ===
echo "[codex-cli] Installing ${PACKAGE} globally via npm..."

if [ "${USERNAME}" = "root" ]; then
	npm install -g "${PACKAGE}"
else
	# Try su first; fall back to HOME override for VM-based Docker
	if su - "${USERNAME}" -c "npm install -g '${PACKAGE}'" 2>/dev/null; then
		: # success
	else
		echo "[codex-cli] su failed, falling back to direct npm install..."
		npm install -g "${PACKAGE}"
	fi
fi

# Clean npm cache to reduce image size
npm cache clean --force 2>/dev/null || true

# === VERIFICATION ===
CODEX_BIN=$(command -v codex 2>/dev/null || echo "${USER_HOME}/.local/bin/codex")

# Check common npm global paths
if ! command -v codex >/dev/null 2>&1; then
	for candidate in /usr/local/bin/codex /usr/bin/codex "${USER_HOME}/.npm-global/bin/codex"; do
		if [ -x "${candidate}" ]; then
			CODEX_BIN="${candidate}"
			break
		fi
	done
fi

if command -v codex >/dev/null 2>&1 || [ -x "${CODEX_BIN}" ]; then
	INSTALLED_VERSION=$(codex --version 2>/dev/null || "${CODEX_BIN}" --version 2>/dev/null || echo "unknown")
	echo "[codex-cli] Codex CLI installed: ${INSTALLED_VERSION}"
	echo "[codex-cli]   Binary: $(command -v codex 2>/dev/null || echo "${CODEX_BIN}")"
else
	echo "[codex-cli] ERROR: Installation failed -- codex not found"
	echo "[codex-cli] Checking npm global bin directory..."
	npm bin -g 2>/dev/null || true
	ls -la "$(npm bin -g 2>/dev/null)/" 2>/dev/null || true
	exit 1
fi

echo "[codex-cli] Installation complete"
