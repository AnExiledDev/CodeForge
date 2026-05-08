#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
# Fast stale check for generated Claude settings. Intended for setup and aliases.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVCONTAINER_DIR="$(dirname "$SCRIPT_DIR")"
WORKSPACE_ROOT="${WORKSPACE_ROOT:-/workspaces}"
CODEFORGE_DIR="${CODEFORGE_DIR:-${WORKSPACE_ROOT}/.codeforge}"
DEFAULT_SETTINGS_DIR="${DEVCONTAINER_DIR}/defaults/codeforge/claude/settings"
OVERRIDE_SETTINGS_DIR="${CODEFORGE_DIR}/claude/settings"
GENERATED_SETTINGS_DIR="${DEVCONTAINER_DIR}/.generated/codeforge/claude/settings"
MARKER="${CODEFORGE_DIR}/.markers/settings-generated-v3"

FORCE=false
QUIET=false
for arg in "$@"; do
	case "$arg" in
		--force) FORCE=true ;;
		--quiet) QUIET=true ;;
	esac
done

log() {
	if [ "$QUIET" != "true" ]; then
		echo "[ensure-settings-generated] $*"
	fi
}

is_stale() {
	[ "$FORCE" = "true" ] && return 0
	[ ! -f "$MARKER" ] && return 0

	local output
	for output in \
		settings.json \
		settings-opus-46-200k.json \
		settings-opus-46-1m-400k.json \
		settings-opus-47-200k.json \
		settings-opus-47-1m-400k.json \
		settings-opus-45-200k.json; do
		[ -f "${GENERATED_SETTINGS_DIR}/${output}" ] || return 0
	done

	if [ -d "$DEFAULT_SETTINGS_DIR" ] && find "$DEFAULT_SETTINGS_DIR" -type f -newer "$MARKER" -print -quit | grep -q .; then
		return 0
	fi

	if [ -d "$OVERRIDE_SETTINGS_DIR" ] && find "$OVERRIDE_SETTINGS_DIR" -type f -newer "$MARKER" -print -quit | grep -q .; then
		return 0
	fi

	# Fallback: check if generator script itself is newer than marker
	if [ -f "$SCRIPT_DIR/generate-settings-profiles.js" ] && [ "$SCRIPT_DIR/generate-settings-profiles.js" -nt "$MARKER" ]; then
		return 0
	fi

	return 1
}

mkdir -p "$CODEFORGE_DIR/.markers" "$GENERATED_SETTINGS_DIR" "$HOME/.claude"

if ! is_stale; then
	log "Generated Claude settings are current."
	exit 0
fi

log "Generating Claude settings..."
if [ "$FORCE" = "true" ]; then
	if ! node "$SCRIPT_DIR/generate-settings-profiles.js"; then
		echo "[ensure-settings-generated] ERROR: Claude settings generation failed." >&2
		exit 1
	fi
else
	if ! node "$SCRIPT_DIR/generate-settings-profiles.js" --if-stale; then
		echo "[ensure-settings-generated] ERROR: Claude settings generation failed." >&2
		exit 1
	fi
fi

log "Deploying generated Claude settings..."
if ! bash "$SCRIPT_DIR/setup-config.sh" --only-settings; then
	echo "[ensure-settings-generated] ERROR: Claude settings deployment failed." >&2
	exit 1
fi
