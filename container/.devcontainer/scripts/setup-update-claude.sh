#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
# Update Claude Code CLI to the latest version (native binary only)
# Runs non-blocking in background by default via setup.sh
# All failures are warnings — this script never blocks container startup

# Log to file (simple append — process substitution breaks under disown)
LOG_FILE="${TMPDIR:-/tmp}/claude-update.log"

log() { echo "[update-claude] $(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$LOG_FILE"; }

log "Checking for Claude Code updates..."

# === Clear nesting guard (postStartCommand may inherit from VS Code extension) ===
unset CLAUDECODE

# === TMPDIR ===
_TMPDIR="${TMPDIR:-/tmp}"

# === LOCK FILE (prevent concurrent updates) ===
LOCK_FILE="${_TMPDIR}/claude-update.lock"
if ! mkdir "$LOCK_FILE" 2>/dev/null; then
	log "Another update is already running, skipping"
	exit 0
fi

# === CLEANUP TRAP ===
cleanup() {
	rm -rf "$LOCK_FILE" 2>/dev/null || true
}
trap cleanup EXIT

# === NATIVE BINARY ===
NATIVE_BIN="$HOME/.local/bin/claude"

if [ ! -x "$NATIVE_BIN" ]; then
	log "ERROR: Native binary not found at ${NATIVE_BIN}"
	log "  The claude-code-native feature should install this during container build."
	log "  Try rebuilding the container or running: curl -fsSL https://claude.ai/install.sh | sh"
	exit 1
fi

# === TRANSITIONAL: Remove leftover npm installation ===
NPM_CLAUDE="$(npm config get prefix 2>/dev/null)/lib/node_modules/@anthropic-ai/claude-code"
if [ -d "$NPM_CLAUDE" ]; then
	log "Removing leftover npm installation at ${NPM_CLAUDE}..."
	if sudo npm uninstall -g @anthropic-ai/claude-code 2>/dev/null; then
		log "Removed leftover npm installation"
	else
		log "WARNING: Could not remove npm installation (non-blocking)"
	fi
fi

# === CHECK FOR UPDATES ===
CURRENT_VERSION=$("$NATIVE_BIN" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "unknown")
log "Current version: ${CURRENT_VERSION}"

# Use the official update command with timeout (handles download, verification, and versioned install)
timeout 60 "$NATIVE_BIN" update 2>&1 | tee -a "$LOG_FILE"
UPDATE_STATUS=${PIPESTATUS[0]}
if [ "$UPDATE_STATUS" -eq 0 ]; then
	UPDATED_VERSION=$("$NATIVE_BIN" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "unknown")
	if [ "$CURRENT_VERSION" != "$UPDATED_VERSION" ]; then
		log "Updated Claude Code: ${CURRENT_VERSION} → ${UPDATED_VERSION}"
	else
		log "Already up to date (${CURRENT_VERSION})"
	fi
else
	log "WARNING: 'claude update' failed or timed out (exit ${UPDATE_STATUS})"
fi
