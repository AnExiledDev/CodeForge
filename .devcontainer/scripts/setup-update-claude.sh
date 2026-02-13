#!/bin/bash
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
	rm -f "${_TMPDIR}/claude-update" 2>/dev/null || true
	rm -f "${_TMPDIR}/claude-update-manifest.json" 2>/dev/null || true
	rm -rf "$LOCK_FILE" 2>/dev/null || true
}
trap cleanup EXIT

# === VERIFY CLAUDE IS INSTALLED ===
if ! command -v claude &>/dev/null; then
	log "Claude Code not found, skipping update"
	exit 0
fi

# === ENSURE NATIVE BINARY EXISTS ===
# 'claude install' puts the binary at ~/.local/bin/claude (symlink to ~/.local/share/claude/versions/*)
# Legacy manual installs used /usr/local/bin/claude — check both, prefer ~/.local
if [ -x "$HOME/.local/bin/claude" ]; then
	NATIVE_BIN="$HOME/.local/bin/claude"
elif [ -x "/usr/local/bin/claude" ]; then
	NATIVE_BIN="/usr/local/bin/claude"
else
	NATIVE_BIN=""
fi
if [ -z "$NATIVE_BIN" ]; then
	log "Native binary not found, installing..."
	if claude install 2>&1 | tee -a "$LOG_FILE"; then
		log "Native binary installed successfully"
	else
		log "WARNING: 'claude install' failed, skipping"
		exit 0
	fi
	# Skip update check on first install — next start will handle it
	exit 0
fi

# === CHECK FOR UPDATES ===
CURRENT_VERSION=$("$NATIVE_BIN" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "unknown")
log "Current version: ${CURRENT_VERSION}"

# Use the official update command (handles download, verification, and versioned install)
if "$NATIVE_BIN" update 2>&1 | tee -a "$LOG_FILE"; then
	UPDATED_VERSION=$("$NATIVE_BIN" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "unknown")
	if [ "$CURRENT_VERSION" != "$UPDATED_VERSION" ]; then
		log "Updated Claude Code: ${CURRENT_VERSION} → ${UPDATED_VERSION}"
	else
		log "Already up to date (${CURRENT_VERSION})"
	fi
else
	log "WARNING: 'claude update' failed, skipping"
fi
