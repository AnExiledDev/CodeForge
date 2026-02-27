#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
# One-time migration: .devcontainer/config/ → .codeforge/
# Migrates config files, manifest, and terminal scripts from the legacy
# .devcontainer/config/ layout to the new .codeforge/ directory structure.

WORKSPACE_ROOT="${WORKSPACE_ROOT:?WORKSPACE_ROOT not set}"
CODEFORGE_DIR="${CODEFORGE_DIR:-${WORKSPACE_ROOT}/.codeforge}"
OLD_CONFIG_DIR="${WORKSPACE_ROOT}/.devcontainer/config"
OLD_DEFAULTS_DIR="${OLD_CONFIG_DIR}/defaults"
MARKER="$CODEFORGE_DIR/.markers/v2-migrated"

log() { echo "[setup-migrate-codeforge] $*"; }
warn() { echo "[setup-migrate-codeforge] WARNING: $*"; }

# Already migrated — skip
if [ -d "$CODEFORGE_DIR" ]; then
	log ".codeforge/ already exists — skipping migration"
	exit 0
fi

# Nothing to migrate if old defaults dir doesn't exist
if [ ! -d "$OLD_DEFAULTS_DIR" ]; then
	log "No legacy .devcontainer/config/defaults/ found — skipping migration"
	exit 0
fi

log "Migrating .devcontainer/config/ → .codeforge/ ..."

# Create directory structure
mkdir -p "$CODEFORGE_DIR/config/rules" \
	"$CODEFORGE_DIR/scripts" \
	"$CODEFORGE_DIR/.markers" \
	"$CODEFORGE_DIR/.checksums"

# Copy config files from .devcontainer/config/defaults/ → .codeforge/config/
if [ -d "$OLD_DEFAULTS_DIR" ]; then
	cp -a "$OLD_DEFAULTS_DIR/." "$CODEFORGE_DIR/config/"
	log "Copied config files from defaults/ → .codeforge/config/"
fi

# Copy file-manifest.json, rewriting src paths from defaults/ to config/
if [ -f "$OLD_CONFIG_DIR/file-manifest.json" ]; then
	sed 's|"defaults/|"config/|g' "$OLD_CONFIG_DIR/file-manifest.json" > "$CODEFORGE_DIR/file-manifest.json"
	log "Copied file-manifest.json (rewrote defaults/ → config/)"
fi

# Copy terminal scripts from .devcontainer/ → .codeforge/scripts/
for script in connect-external-terminal.sh connect-external-terminal.ps1; do
	if [ -f "${WORKSPACE_ROOT}/.devcontainer/${script}" ]; then
		cp "${WORKSPACE_ROOT}/.devcontainer/${script}" "$CODEFORGE_DIR/scripts/${script}"
		log "Copied ${script} → .codeforge/scripts/"
	fi
done

# Write migration marker
date -Iseconds > "$MARKER"

log "Migration complete — .codeforge/ is ready"
