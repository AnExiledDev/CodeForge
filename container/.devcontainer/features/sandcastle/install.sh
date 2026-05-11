#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
set -euo pipefail

VERSION="${VERSION:-latest}"
USERNAME="${USERNAME:-automatic}"

# Skip if version is "none"
if [ "${VERSION}" = "none" ]; then
	echo "[sandcastle] Skipping installation (version=none)"
	exit 0
fi

echo "[sandcastle] Starting installation..."
echo "[sandcastle] Version: ${VERSION}"

# === VALIDATE DEPENDENCIES ===
if ! command -v npm >/dev/null 2>&1; then
	echo "[sandcastle] ERROR: npm is required"
	echo "  Ensure node feature is installed first"
	exit 1
fi

if ! command -v git >/dev/null 2>&1; then
	echo "[sandcastle] ERROR: git is required"
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
	echo "[sandcastle] ERROR: Could not determine home directory for ${USERNAME}"
	exit 1
fi

echo "[sandcastle] Installing for user: ${USERNAME} (home: ${USER_HOME})"

# === DETERMINE PACKAGE ===
if [ "${VERSION}" = "latest" ]; then
	PACKAGE="@ai-hero/sandcastle"
else
	if ! echo "${VERSION}" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+'; then
		echo "[sandcastle] ERROR: Invalid version '${VERSION}'"
		echo "  Use 'latest' or a semver (e.g., 0.5.7)"
		exit 1
	fi
	# Enforce minimum version for command injection CVE fix
	MAJOR=$(echo "${VERSION}" | cut -d. -f1)
	MINOR=$(echo "${VERSION}" | cut -d. -f2)
	PATCH=$(echo "${VERSION}" | cut -d. -f3)
	if [ "${MAJOR}" -eq 0 ] && [ "${MINOR}" -lt 5 ]; then
		echo "[sandcastle] ERROR: Version ${VERSION} is below minimum safe version (0.5.4)"
		echo "  Versions <0.5.4 have a command injection vulnerability"
		exit 1
	fi
	if [ "${MAJOR}" -eq 0 ] && [ "${MINOR}" -eq 5 ] && [ "${PATCH}" -lt 4 ]; then
		echo "[sandcastle] ERROR: Version ${VERSION} is below minimum safe version (0.5.4)"
		echo "  Versions <0.5.4 have a command injection vulnerability"
		exit 1
	fi
	PACKAGE="@ai-hero/sandcastle@${VERSION}"
fi

# === INSTALL ===
echo "[sandcastle] Installing ${PACKAGE} globally via npm..."

if [ "${USERNAME}" = "root" ]; then
	npm install -g "${PACKAGE}"
else
	if su - "${USERNAME}" -c "npm install -g '${PACKAGE}'" 2>/dev/null; then
		: # success
	else
		echo "[sandcastle] su failed, falling back to direct npm install..."
		npm install -g "${PACKAGE}"
	fi
fi

# Clean npm cache to reduce image size
npm cache clean --force 2>/dev/null || true

# === VERIFICATION ===
if command -v sandcastle >/dev/null 2>&1; then
	INSTALLED_VERSION=$(sandcastle --version 2>/dev/null || echo "unknown")
	echo "[sandcastle] Sandcastle installed: ${INSTALLED_VERSION}"
	echo "[sandcastle]   Binary: $(command -v sandcastle)"
else
	# Check common npm global paths
	FOUND=""
	for candidate in /usr/local/bin/sandcastle /usr/bin/sandcastle "${USER_HOME}/.npm-global/bin/sandcastle"; do
		if [ -x "${candidate}" ]; then
			FOUND="${candidate}"
			break
		fi
	done

	if [ -n "${FOUND}" ]; then
		INSTALLED_VERSION=$("${FOUND}" --version 2>/dev/null || echo "unknown")
		echo "[sandcastle] Sandcastle installed: ${INSTALLED_VERSION}"
		echo "[sandcastle]   Binary: ${FOUND}"
	else
		echo "[sandcastle] ERROR: Installation failed -- sandcastle not found"
		echo "[sandcastle] Checking npm global bin directory..."
		npm bin -g 2>/dev/null || true
		ls -la "$(npm bin -g 2>/dev/null)/" 2>/dev/null || true
		exit 1
	fi
fi

echo "[sandcastle] Installation complete"
echo "[sandcastle] Usage: sandcastle init (scaffold .sandcastle/ in a project)"
echo "[sandcastle]        sandcastle run  (execute a workflow)"
