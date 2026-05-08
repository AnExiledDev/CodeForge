#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
# One-time migration from copied .codeforge/config defaults to v3 overrides/state.

set -uo pipefail

WORKSPACE_ROOT="${WORKSPACE_ROOT:?WORKSPACE_ROOT not set}"
CODEFORGE_DIR="${CODEFORGE_DIR:-${WORKSPACE_ROOT}/.codeforge}"
MARKERS_DIR="${CODEFORGE_DIR}/.markers"
MARKER="${MARKERS_DIR}/config-layout-v3"
REPORT="${MARKERS_DIR}/config-layout-v3-report.md"
BACKUP_ROOT="${CODEFORGE_DIR}/backups"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="${BACKUP_ROOT}/config-layout-v3-${TIMESTAMP}"
OLD_CONFIG_DIR="${CODEFORGE_DIR}/config"

log() { echo "[setup-migrate-codeforge-v3] $*"; }
report() { printf '%s\n' "$*" >>"$REPORT"; }

mkdir -p "$MARKERS_DIR" "$CODEFORGE_DIR/data" "$CODEFORGE_DIR/.checksums"

if [ -f "$MARKER" ]; then
	log "v3 config layout marker exists; skipping"
	exit 0
fi

cat >"$REPORT" <<EOF
# CodeForge Config Layout v3 Migration

- Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)
- Workspace: ${WORKSPACE_ROOT}
- CodeForge dir: ${CODEFORGE_DIR}

EOF

if [ -d "$OLD_CONFIG_DIR" ] || [ -f "${CODEFORGE_DIR}/file-manifest.json" ]; then
	mkdir -p "$BACKUP_DIR"
	if [ -d "$OLD_CONFIG_DIR" ]; then
		if ! cp -a "$OLD_CONFIG_DIR" "$BACKUP_DIR/config"; then
			echo "[migration] ERROR: Could not back up old config" >&2
			exit 1
		fi
		report "- Backed up old config directory to \`${BACKUP_DIR}/config\`."
	fi
	if [ -f "${CODEFORGE_DIR}/file-manifest.json" ]; then
		if ! cp -a "${CODEFORGE_DIR}/file-manifest.json" "$BACKUP_DIR/file-manifest.json"; then
			echo "[migration] ERROR: Could not back up old user manifest" >&2
			exit 1
		fi
		report "- Backed up old user manifest to \`${BACKUP_DIR}/file-manifest.json\`."
	fi
else
	report "- No old \`.codeforge/config\` directory or user manifest was present."
fi

move_file() {
	local old="$1"
	local new="$2"
	local label="$3"
	local src="${OLD_CONFIG_DIR}/${old}"
	local dest="${CODEFORGE_DIR}/${new}"

	if [ ! -f "$src" ]; then
		return 0
	fi
	mkdir -p "$(dirname "$dest")"
	if [ -e "$dest" ]; then
		report "- Skipped ${label}: \`${new}\` already exists; old file remains at \`config/${old}\`."
	else
		if ! mv "$src" "$dest"; then
			echo "[migration] ERROR: Could not move ${label}: config/${old} -> ${new}" >&2
			exit 1
		fi
		report "- Moved ${label}: \`config/${old}\` -> \`${new}\`."
	fi
}

move_dir() {
	local old="$1"
	local new="$2"
	local label="$3"
	local src="${OLD_CONFIG_DIR}/${old}"
	local dest="${CODEFORGE_DIR}/${new}"

	if [ ! -d "$src" ]; then
		return 0
	fi
	mkdir -p "$(dirname "$dest")"
	if [ -e "$dest" ]; then
		report "- Skipped ${label}: \`${new}\` already exists; old directory remains at \`config/${old}\`."
	else
		if ! mv "$src" "$dest"; then
			echo "[migration] ERROR: Could not move ${label}: config/${old} -> ${new}" >&2
			exit 1
		fi
		report "- Moved ${label}: \`config/${old}\` -> \`${new}\`."
	fi
}

move_file "settings.base.json" "claude/settings/base.json" "settings base override"
if [ -d "${OLD_CONFIG_DIR}/settings-profiles" ]; then
	mkdir -p "${CODEFORGE_DIR}/claude/settings/profiles"
	for profile in "${OLD_CONFIG_DIR}/settings-profiles"/*.json; do
		[ -f "$profile" ] || continue
		name="$(basename "$profile")"
		if [ -e "${CODEFORGE_DIR}/claude/settings/profiles/${name}" ]; then
			report "- Skipped settings profile \`${name}\`: new override already exists."
		else
			if ! mv "$profile" "${CODEFORGE_DIR}/claude/settings/profiles/${name}"; then
				echo "[migration] ERROR: Could not move settings profile: ${name}" >&2
				exit 1
			fi
			report "- Moved settings profile: \`config/settings-profiles/${name}\` -> \`claude/settings/profiles/${name}\`."
		fi
	done
	rmdir "${OLD_CONFIG_DIR}/settings-profiles" 2>/dev/null || true
fi

move_file "main-system-prompt.md" "claude/system-prompts/main.md" "main system prompt"
move_file "writing-system-prompt.md" "claude/system-prompts/writing.md" "writing system prompt"
move_file "orchestrator-system-prompt.md" "claude/system-prompts/orchestrator.md" "orchestrator system prompt"
move_dir "rules" "claude/rules" "rules overrides"
move_dir "hooks" "claude/hooks" "hook overrides"
move_file "ccstatusline-settings.json" "claude/statusline/settings.json" "ccstatusline config"
move_file "claude-code-router.json" "claude/router/config.json" "Claude Code Router config"
move_file "disabled-hooks.json" "claude/disabled-hooks.json" "disabled hooks config"
move_file "keybindings.json" "claude/keybindings.json" "Claude keybindings"
move_file "codex-config.toml" "codex/config.toml" "Codex config"
move_file "codex-rtk-awareness.md" "codex/AGENTS.md" "Codex AGENTS.md"
move_file "rtk-config.toml" "rtk/config.toml" "RTK config"

if [ -d "$OLD_CONFIG_DIR" ]; then
	shopt -s nullglob
	for generated in \
		"${OLD_CONFIG_DIR}/settings.json" \
		"${OLD_CONFIG_DIR}"/settings-opus-*.json; do
		report "- Left generated settings file in place for review, not as source of truth: \`config/$(basename "$generated")\`."
	done
	shopt -u nullglob
	if find "$OLD_CONFIG_DIR" -mindepth 1 -print -quit | grep -q .; then
		report "- Remaining old files were left under \`config/\` for manual review."
	else
		rmdir "$OLD_CONFIG_DIR" 2>/dev/null || true
		report "- Removed empty old \`config/\` directory."
	fi
fi

if [ -f "${CODEFORGE_DIR}/file-manifest.json" ]; then
	report "- Existing user manifest was preserved. Review it for v3 \`id\` fields and new logical paths."
fi

{
	echo "migratedAt=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
	echo "report=${REPORT}"
	echo "backup=${BACKUP_DIR}"
} >"$MARKER"

log "v3 migration complete; report written to ${REPORT}"
