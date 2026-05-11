#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
set -euo pipefail

VERSION="${VERSION:-latest}"
USERNAME="${USERNAME:-automatic}"

# Skip if version is "none"
if [ "${VERSION}" = "none" ]; then
	echo "[hermes-agent] Skipping installation (version=none)"
	exit 0
fi

# VERSION currently only honors 'latest' and 'none'. Upstream Hermes has not
# tagged release versions yet; the installer always pulls HEAD of main. Warn
# loudly so a user who pins a semver doesn't think they got that version.
if [ "${VERSION}" != "latest" ]; then
	echo "[hermes-agent] WARNING: version '${VERSION}' was requested, but only 'latest' and 'none' are supported."
	echo "[hermes-agent] WARNING: installing HEAD of NousResearch/hermes-agent main instead."
fi

echo "[hermes-agent] Starting installation..."
echo "[hermes-agent] Version: ${VERSION}"

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
	echo "[hermes-agent] ERROR: Could not determine home directory for ${USERNAME}"
	exit 1
fi

echo "[hermes-agent] Installing for user: ${USERNAME} (home: ${USER_HOME})"

# === VOLUME MOUNT CONSISTENCY CHECK ===
# devcontainer.json pins the Hermes config volume to /home/vscode/.hermes.
# If we're installing for a different user (not 'vscode'), ~/.hermes won't be
# backed by the named volume and setup state will be lost on rebuild.
EXPECTED_HERMES_HOME="/home/vscode/.hermes"
ACTUAL_HERMES_HOME="${USER_HOME}/.hermes"
if [ "${ACTUAL_HERMES_HOME}" != "${EXPECTED_HERMES_HOME}" ]; then
	echo "[hermes-agent] WARNING: installing as '${USERNAME}' (home: ${USER_HOME})."
	echo "[hermes-agent] WARNING: the Hermes config volume in devcontainer.json targets ${EXPECTED_HERMES_HOME},"
	echo "[hermes-agent] WARNING: but this install will write to ${ACTUAL_HERMES_HOME}."
	echo "[hermes-agent] WARNING: 'hermes setup' state will NOT persist across container rebuilds."
	echo "[hermes-agent] WARNING: fix by aligning the mount target in devcontainer.json with ${USER_HOME}/.hermes."
fi

# === VALIDATE DEPENDENCIES ===
for cmd in curl git bash; do
	if ! command -v "${cmd}" >/dev/null 2>&1; then
		echo "[hermes-agent] ERROR: ${cmd} is required but not found"
		exit 1
	fi
done

if ! command -v uv >/dev/null 2>&1; then
	# uv may be on the user's PATH but not root's — check common locations
	if [ -x "${USER_HOME}/.local/bin/uv" ] || [ -x "/usr/local/bin/uv" ]; then
		echo "[hermes-agent] uv found in user's local bin"
	else
		echo "[hermes-agent] WARNING: uv not found on PATH. Hermes installer will attempt to install it."
	fi
fi

# === PRE-INSTALL SYSTEM DEPS ===
# Hermes installer will try to apt-get ripgrep + ffmpeg; do it here so root perms are clean.
if command -v apt-get >/dev/null 2>&1; then
	echo "[hermes-agent] Ensuring ripgrep and ffmpeg are installed..."
	export DEBIAN_FRONTEND=noninteractive
	apt-get update -qq || true
	apt-get install -y --no-install-recommends ripgrep ffmpeg >/dev/null 2>&1 || \
		echo "[hermes-agent] WARNING: apt-get install for ripgrep/ffmpeg failed; Hermes installer will retry"
fi

# === PREPARE CONFIG DIRECTORY ===
# ~/.hermes is mounted as a volume in devcontainer.json; make sure ownership is correct.
mkdir -p "${USER_HOME}/.hermes"
chown -R "${USERNAME}:" "${USER_HOME}/.hermes"

# === RUN UPSTREAM INSTALLER (as target user, non-interactive) ===
# --skip-setup skips the interactive `hermes setup` wizard only.
# Package install, venv creation, template copy, PATH setup, and language runtime
# detection still run.
INSTALL_CMD='
set -e
# Source NVM so the installer sees the existing Node LTS from the node feature.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
	# shellcheck disable=SC1091
	. "$NVM_DIR/nvm.sh"
fi
# Ensure ~/.local/bin (where hermes binary symlinks) is on PATH during install.
export PATH="$HOME/.local/bin:$PATH"
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash -s -- --skip-setup
'

echo "[hermes-agent] Running upstream installer (--skip-setup)..."
if [ "${USERNAME}" = "root" ]; then
	bash -c "${INSTALL_CMD}"
else
	su - "${USERNAME}" -c "${INSTALL_CMD}"
fi

# === POST-INSTALL OWNERSHIP SWEEP ===
# Defensive: reclaim anything the installer might have touched as root.
for path in "${USER_HOME}/hermes-agent" "${USER_HOME}/.local" "${USER_HOME}/.hermes"; do
	if [ -e "${path}" ]; then
		chown -R "${USERNAME}:" "${path}" 2>/dev/null || true
	fi
done

# === VERIFY ~/.local/bin IS ON PATH IN SHELL RC ===
# Upstream installer adds this, but guard against shell-rc variance.
for rc in "${USER_HOME}/.bashrc" "${USER_HOME}/.zshrc"; do
	if [ -f "${rc}" ] && ! grep -q '\.local/bin' "${rc}" 2>/dev/null; then
		{
			echo ''
			echo '# Added by hermes-agent feature'
			echo 'export PATH="$HOME/.local/bin:$PATH"'
		} >> "${rc}"
		chown "${USERNAME}:" "${rc}"
	fi
done

# === VERIFICATION ===
HERMES_BIN="${USER_HOME}/.local/bin/hermes"
if [ ! -x "${HERMES_BIN}" ]; then
	echo "[hermes-agent] ERROR: hermes binary not found at ${HERMES_BIN}"
	ls -la "${USER_HOME}/.local/bin/" 2>/dev/null || true
	exit 1
fi

if [ "${USERNAME}" = "root" ]; then
	VERIFY_OUTPUT=$("${HERMES_BIN}" --version 2>&1 || echo "version-check-failed")
else
	VERIFY_OUTPUT=$(su - "${USERNAME}" -c 'export PATH="$HOME/.local/bin:$PATH"; hermes --version 2>&1' || echo "version-check-failed")
fi

echo "[hermes-agent] Verification: ${VERIFY_OUTPUT}"
echo "[hermes-agent]   Binary: ${HERMES_BIN}"
echo "[hermes-agent] Installation complete. Run 'hermes setup' interactively to configure a provider."
