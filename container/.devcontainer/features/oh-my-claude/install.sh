#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
set -euo pipefail

OMC_VERSION="${VERSION:-latest}"
SHELLS="${SHELLS:-both}"
USERNAME="${USERNAME:-automatic}"
PROVIDER_AGENTS_ONLY="${PROVIDERAGENTSONLY:-true}"
# Note: installLaunchAliases option removed — CodeForge's setup-aliases.sh owns shell helpers

if [ "${OMC_VERSION}" = "none" ]; then
	echo "[oh-my-claude] Skipping installation (version=none)"
	exit 0
fi

echo "[oh-my-claude] Starting installation..."

if [ -f /usr/local/share/nvm/nvm.sh ]; then
	# shellcheck disable=SC1091
	source /usr/local/share/nvm/nvm.sh
fi

if ! command -v npm >/dev/null 2>&1; then
	echo "[oh-my-claude] ERROR: npm is not available"
	echo "  Ensure the Node devcontainer feature is installed first"
	exit 1
fi

if [[ ! "${SHELLS}" =~ ^(bash|zsh|both)$ ]]; then
	echo "[oh-my-claude] ERROR: shells must be 'bash', 'zsh', or 'both'"
	exit 1
fi

if [[ ! "${OMC_VERSION}" =~ ^[a-zA-Z0-9._-]+$ ]]; then
	echo "[oh-my-claude] ERROR: version contains invalid characters"
	exit 1
fi

if [[ ! "${PROVIDER_AGENTS_ONLY}" =~ ^(true|false)$ ]]; then
	echo "[oh-my-claude] ERROR: providerAgentsOnly must be true or false"
	exit 1
fi

if [ "${USERNAME}" = "auto" ] || [ "${USERNAME}" = "automatic" ]; then
	USERNAME=""
	for CURRENT_USER in vscode node codespace; do
		if id -u "${CURRENT_USER}" >/dev/null 2>&1; then
			USERNAME="${CURRENT_USER}"
			break
		fi
	done
	[ -z "${USERNAME}" ] && USERNAME=root
elif [ "${USERNAME}" = "none" ] || ! id -u "${USERNAME}" >/dev/null 2>&1; then
	USERNAME=root
fi

USER_HOME="$(getent passwd "${USERNAME}" | cut -d: -f6)"
if [ -z "${USER_HOME}" ] || [ ! -d "${USER_HOME}" ]; then
	echo "[oh-my-claude] ERROR: Home directory not found for user ${USERNAME}"
	exit 1
fi

echo "[oh-my-claude] Installing for user: ${USERNAME}"
echo "[oh-my-claude] Installing @lgcyaxi/oh-my-claude@${OMC_VERSION} globally..."
npm install -g "@lgcyaxi/oh-my-claude@${OMC_VERSION}"

CLAUDE_DIR="${USER_HOME}/.claude"
SETTINGS_JSON="${CLAUDE_DIR}/settings.json"
SETTINGS_BACKUP=""
SETTINGS_EXISTED="false"
mkdir -p "${CLAUDE_DIR}"
chown "${USERNAME}:${USERNAME}" "${CLAUDE_DIR}" 2>/dev/null || true

if [ -f "${SETTINGS_JSON}" ]; then
	SETTINGS_EXISTED="true"
	SETTINGS_BACKUP="${SETTINGS_JSON}.omc-backup.$$"
	cp "${SETTINGS_JSON}" "${SETTINGS_BACKUP}"
	echo "[oh-my-claude] Backed up existing settings.json"
fi

restore_settings() {
	if [ "${SETTINGS_EXISTED}" = "true" ] && [ -n "${SETTINGS_BACKUP}" ] && [ -f "${SETTINGS_BACKUP}" ]; then
		mv "${SETTINGS_BACKUP}" "${SETTINGS_JSON}"
		chown "${USERNAME}:${USERNAME}" "${SETTINGS_JSON}" 2>/dev/null || true
		echo "[oh-my-claude] Restored CodeForge-managed settings.json"
	elif [ "${SETTINGS_EXISTED}" = "false" ] && [ -f "${SETTINGS_JSON}" ]; then
		rm -f "${SETTINGS_JSON}"
		echo "[oh-my-claude] Removed OMC-generated settings.json; CodeForge will deploy settings on start"
	fi
}
trap restore_settings EXIT

echo "[oh-my-claude] Running OMC installer without hooks or MCP server..."
OMC_INSTALL_SUCCESS="false"
for attempt in 1 2 3; do
	echo "[oh-my-claude] Attempt ${attempt}/3: running omc install..."
	if sudo -u "${USERNAME}" HOME="${USER_HOME}" omc install --skip-hooks --skip-mcp --force; then
		OMC_INSTALL_SUCCESS="true"
		break
	fi
	echo "[oh-my-claude] Attempt ${attempt} failed"
	if [ "${attempt}" -lt 3 ]; then
		echo "[oh-my-claude] Retrying in 2 seconds..."
		sleep 2
	fi
done

if [ "${OMC_INSTALL_SUCCESS}" = "false" ]; then
	echo "[oh-my-claude] WARNING: omc install failed after 3 attempts"
	echo "  Continuing because CodeForge only needs the package installed."
	echo "  Run 'omc install --skip-hooks --skip-mcp --force' manually after container start."
fi

restore_settings
trap - EXIT

# Explicitly reset statusLine to ccstatusline — OMC has no --skip-statusline flag,
# so we surgically fix it after restore regardless of what OMC touched.
if [ -f "${SETTINGS_JSON}" ] && command -v jq >/dev/null 2>&1; then
	if jq -e '.statusLine' "${SETTINGS_JSON}" >/dev/null 2>&1; then
		jq '.statusLine = {"type": "command", "command": "/usr/local/bin/ccstatusline-wrapper"}' \
			"${SETTINGS_JSON}" > "${SETTINGS_JSON}.tmp" && \
			mv "${SETTINGS_JSON}.tmp" "${SETTINGS_JSON}"
		chown "${USERNAME}:${USERNAME}" "${SETTINGS_JSON}" 2>/dev/null || true
		echo "[oh-my-claude] Reset statusLine to ccstatusline (CodeForge-managed)"
	fi
fi

LEGACY_POSTSTART="/usr/local/devcontainer-poststart.d/46-oh-my-claude.sh"
if [ -f "${LEGACY_POSTSTART}" ]; then
	rm -f "${LEGACY_POSTSTART}"
	echo "[oh-my-claude] Removed legacy post-start proxy hook"
fi

if [ "${PROVIDER_AGENTS_ONLY}" = "true" ]; then
	echo "[oh-my-claude] Filtering generated role agents (provider-only mode)..."
	AGENTS_DIR="${CLAUDE_DIR}/agents"
	if [ -d "${AGENTS_DIR}" ]; then
		for agent in \
			sisyphus prometheus claude-reviewer claude-scout oracle \
			ui-designer analyst librarian document-writer navigator hephaestus; do
			if [ -f "${AGENTS_DIR}/${agent}.md" ]; then
				rm -f "${AGENTS_DIR}/${agent}.md"
				echo "[oh-my-claude] Deleted role agent: ${agent}"
			fi
		done
	fi
fi

# Clean up any legacy OMC shell blocks from previous installs
for shell_rc in "${USER_HOME}/.bashrc" "${USER_HOME}/.zshrc"; do
	if [ -f "${shell_rc}" ]; then
		if grep -q "oh-my-claude launch helpers START" "${shell_rc}" 2>/dev/null; then
			sed -i '/oh-my-claude launch helpers START/,/oh-my-claude launch helpers END/d' "${shell_rc}"
			echo "[oh-my-claude] Removed legacy shell block from ${shell_rc}"
		fi
		if grep -q "oh-my-claude activation START" "${shell_rc}" 2>/dev/null; then
			sed -i '/oh-my-claude activation START/,/oh-my-claude activation END/d' "${shell_rc}"
			echo "[oh-my-claude] Removed legacy activation block from ${shell_rc}"
		fi
	fi
done
# Note: Shell aliases (omc-cc, omc-deepseek, etc.) are provided by CodeForge's
# setup-aliases.sh, not this feature install script.

echo "[oh-my-claude] Verifying installation..."
if command -v omc >/dev/null 2>&1; then
	OMC_VERSION_INSTALLED="$(omc --version 2>/dev/null || echo "unknown")"
	echo "[oh-my-claude] omc is installed (${OMC_VERSION_INSTALLED})"
else
	echo "[oh-my-claude] WARNING: omc command not found after install"
fi

cat <<SUMMARY

-----------------------------------------------
  oh-my-claude Installation Complete
-----------------------------------------------

Configuration:
  - User: ${USERNAME}
  - Version: ${OMC_VERSION}
  - Provider agents only: ${PROVIDER_AGENTS_ONLY}

CodeForge ownership:
  - settings.json is preserved for CodeForge
  - OMC hooks and MCP server are skipped
  - Shell aliases provided by setup-aliases.sh
  - Proxy sessions are launched with: omc cc

Usage:
  omc cc -skip              # Launch Claude Code through OMC
  omc cc -p ds -- --help    # Direct DeepSeek provider launch with Claude args
  omc proxy status          # Show active OMC proxy sessions
  omc doctor --detail       # Diagnose OMC setup

-----------------------------------------------
SUMMARY
