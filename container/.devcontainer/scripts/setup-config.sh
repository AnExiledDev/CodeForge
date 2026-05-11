#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
# Deploy effective CodeForge configuration from packaged defaults plus
# optional .codeforge/ overrides.

set -uo pipefail

log() { echo "[setup-config] $*"; }
warn() { echo "[setup-config] WARNING: $*"; }
err() { echo "[setup-config] ERROR: $*" >&2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVCONTAINER_DIR="$(dirname "$SCRIPT_DIR")"
WORKSPACE_ROOT="${WORKSPACE_ROOT:-/workspaces}"
CODEFORGE_DIR="${CODEFORGE_DIR:-${WORKSPACE_ROOT}/.codeforge}"
DEFAULTS_DIR="${DEVCONTAINER_DIR}/defaults/codeforge"
GENERATED_DIR="${DEVCONTAINER_DIR}/.generated/codeforge"
DEFAULT_MANIFEST="${DEFAULTS_DIR}/file-manifest.json"
USER_MANIFEST="${CODEFORGE_DIR}/file-manifest.json"
ONLY_ID_PREFIX=""

if [ "${1:-}" = "--only-settings" ]; then
	ONLY_ID_PREFIX="claude.settings."
fi

if [ -n "${OVERWRITE_CONFIG+x}" ]; then
	warn "OVERWRITE_CONFIG is deprecated. Use per-file 'overwrite' in file-manifest.json instead."
fi

if [ ! -f "$DEFAULT_MANIFEST" ]; then
	err "Default file-manifest.json not found at $DEFAULT_MANIFEST"
	exit 1
fi

if ! jq empty "$DEFAULT_MANIFEST" 2>/dev/null; then
	err "Invalid JSON in $DEFAULT_MANIFEST"
	exit 1
fi

if [ -f "$USER_MANIFEST" ] && ! jq empty "$USER_MANIFEST" 2>/dev/null; then
	err "Invalid JSON in $USER_MANIFEST"
	exit 1
fi

if [ "$(jq 'all(.[]; has("id"))' "$DEFAULT_MANIFEST")" != "true" ]; then
	err "Default manifest entries must include stable id fields"
	exit 1
fi

effective_manifest="$(mktemp)"
trap 'rm -f "$effective_manifest"' EXIT

if [ -f "$USER_MANIFEST" ]; then
	jq -s '
		def entry_id: .id // .src;
		reduce (.[0] + .[1])[] as $entry ({};
			($entry | entry_id) as $id
			| .[$id] = ((.[$id] // {}) + $entry)
			| if ($entry.disabled == true) then .[$id].enabled = false else . end
		)
		| [ .[] ]
	' "$DEFAULT_MANIFEST" "$USER_MANIFEST" > "$effective_manifest"
else
	cp "$DEFAULT_MANIFEST" "$effective_manifest"
fi

[ "${DEBUG:-}" = "1" ] && log "Effective manifest: $(cat "$effective_manifest")"

expand_vars() {
	local val="$1"
	# Escape replacement values to prevent bash pattern interpretation
	local safe_workspace
	safe_workspace="$(printf '%s' "$WORKSPACE_ROOT" | sed 's/[\/&]/\\&/g')"
	local safe_home
	safe_home="$(printf '%s' "${HOME:-/home/vscode}" | sed 's/[\/&]/\\&/g')"
	local safe_codeforge
	safe_codeforge="$(printf '%s' "$CODEFORGE_DIR" | sed 's/[\/&]/\\&/g')"
	val="$(printf '%s' "$val" | sed "s|\${WORKSPACE_ROOT}|${safe_workspace}|g")"
	val="$(printf '%s' "$val" | sed "s|\${CODEFORGE_DIR}|${safe_codeforge}|g")"
	val="$(printf '%s' "$val" | sed "s|\${HOME}|${safe_home}|g")"
	if [[ "$val" =~ \$\{[^}]+\} ]]; then
		warn "Unresolved variable in: $val"
	fi
	echo "$val"
}

resolve_source() {
	local src="$1"
	local candidate
	for root in "$CODEFORGE_DIR" "$GENERATED_DIR" "$DEFAULTS_DIR"; do
		candidate="${root}/${src}"
		if [ -f "$candidate" ]; then
			echo "$candidate"
			return 0
		fi
	done
	return 1
}

should_copy() {
	local src="$1" dest="$2"
	[ ! -f "$dest" ] && return 0
	local src_hash dest_hash
	src_hash="$(sha256sum "$src" | cut -d' ' -f1)"
	dest_hash="$(sha256sum "$dest" | cut -d' ' -f1)"
	[ "$src_hash" != "$dest_hash" ]
}

repair_claude_state() {
	local target="${HOME:-/home/vscode}/.claude.json"
	local legacy="${HOME:-/home/vscode}/.claude/.claude.json"
	local defaults="${DEFAULTS_DIR}/claude/claude.json"
	local legacy_input defaults_input tmp

	[ -f "$defaults" ] || return 0
	mkdir -p "$(dirname "$target")"
	if [ ! -f "$target" ]; then
		if cp "$defaults" "$target" 2>/dev/null; then
			chmod 600 "$target" 2>/dev/null || true
			chown "$(id -un):$(id -gn)" "$target" 2>/dev/null || true
			log "Copied claude.state -> $target"
		fi
		return 0
	fi

	command -v jq >/dev/null 2>&1 || return 0
	jq empty "$target" 2>/dev/null || return 0

	legacy_input="$legacy"
	if [ ! -f "$legacy_input" ] || ! jq empty "$legacy_input" 2>/dev/null; then
		legacy_input="$(mktemp)"
		printf '{}\n' > "$legacy_input"
	fi
	defaults_input="$defaults"
	tmp="$(mktemp)"
	if jq -s '
		.[0] as $current
		| .[1] as $legacy
		| .[2] as $defaults
		| $current
		| .hasCompletedOnboarding = (.hasCompletedOnboarding // $legacy.hasCompletedOnboarding // $defaults.hasCompletedOnboarding // true)
		| .bypassPermissionsModeAccepted = (.bypassPermissionsModeAccepted // $legacy.bypassPermissionsModeAccepted // $defaults.bypassPermissionsModeAccepted // true)
		| .hasTrustDialogAccepted = (.hasTrustDialogAccepted // $legacy.hasTrustDialogAccepted // true)
	' "$target" "$legacy_input" "$defaults_input" > "$tmp"; then
		if ! cmp -s "$target" "$tmp"; then
			install -m 600 "$tmp" "$target"
			chown "$(id -un):$(id -gn)" "$target" 2>/dev/null || true
			log "Repaired Claude state flags in $target"
		fi
	fi
	rm -f "$tmp"
	[ "$legacy_input" = "$legacy" ] || rm -f "$legacy_input"
}

processed=0
copied=0
skipped=0

if [ -n "$ONLY_ID_PREFIX" ]; then
	log "Deploying generated Claude settings..."
else
	log "Deploying effective configuration files..."
fi

jq -r '.[] | [
	(.id // ""),
	(.src // ""),
	(.dest // ""),
	(.destFilename // "__NONE__"),
	(.enabled // true | tostring),
	(.overwrite // "if-changed")
] | @tsv' "$effective_manifest" |
	while IFS=$'\t' read -r id src dest dest_filename enabled overwrite; do
		if [ -n "$ONLY_ID_PREFIX" ] && [[ "$id" != "$ONLY_ID_PREFIX"* ]]; then
			continue
		fi

		processed=$((processed + 1))

		if [ "$enabled" = "false" ]; then
			log "Skipping $id (disabled)"
			skipped=$((skipped + 1))
			continue
		fi

		if [ -z "$id" ] || [ -z "$src" ] || [ -z "$dest" ]; then
			warn "Skipping malformed manifest entry: id=$id src=$src dest=$dest"
			skipped=$((skipped + 1))
			continue
		fi

		if ! src_path="$(resolve_source "$src")"; then
			warn "$src not found in overrides, generated output, or defaults; skipping"
			skipped=$((skipped + 1))
			continue
		fi

		dest_dir="$(expand_vars "$dest")"
		[ "$dest_filename" = "__NONE__" ] && dest_filename=""
		filename="${dest_filename:-${src##*/}}"
		dest_path="${dest_dir}/${filename}"

		mkdir -p "$dest_dir"

		case "$overwrite" in
			always)
				if cp "$src_path" "$dest_path" 2>/dev/null; then
					copied=$((copied + 1))
					log "Copied $id -> $dest_path"
				else
					warn "Failed to copy $id -> $dest_path"
					skipped=$((skipped + 1))
				fi
				;;
			never)
				if [ ! -f "$dest_path" ]; then
					if cp "$src_path" "$dest_path" 2>/dev/null; then
						copied=$((copied + 1))
						log "Copied $id -> $dest_path"
					else
						warn "Failed to copy $id -> $dest_path"
						skipped=$((skipped + 1))
					fi
				else
					log "Skipping $id (exists, overwrite=never)"
					skipped=$((skipped + 1))
				fi
				;;
			if-changed | *)
				if should_copy "$src_path" "$dest_path"; then
					if cp "$src_path" "$dest_path" 2>/dev/null; then
						copied=$((copied + 1))
						log "Copied $id -> $dest_path"
					else
						warn "Failed to copy $id -> $dest_path"
						skipped=$((skipped + 1))
					fi
				else
					log "Skipping $id (unchanged)"
					skipped=$((skipped + 1))
				fi
				;;
		esac

		chown "$(id -un):$(id -gn)" "$dest_path" 2>/dev/null || true
	done

repair_claude_state
log "Configuration complete"
