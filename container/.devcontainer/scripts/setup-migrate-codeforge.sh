#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
# Ensure the minimal .codeforge/ workspace directory exists.

set -uo pipefail

WORKSPACE_ROOT="${WORKSPACE_ROOT:?WORKSPACE_ROOT not set}"
CODEFORGE_DIR="${CODEFORGE_DIR:-${WORKSPACE_ROOT}/.codeforge}"
README="${CODEFORGE_DIR}/README.md"

log() { echo "[setup-migrate-codeforge] $*"; }

mkdir -p \
	"$CODEFORGE_DIR/.markers" \
	"$CODEFORGE_DIR/.checksums" \
	"$CODEFORGE_DIR/data"

if [ ! -f "$README" ]; then
	cat >"$README" <<'EOF'
# CodeForge Project Overrides

This directory is intentionally small and user-owned.

Packaged defaults live in `.devcontainer/defaults/codeforge/`. Put files here
only when you want to override a packaged default, add project-local state, or
store CodeForge marker files.

Override files use the same logical path as packaged defaults. For example:

- `.codeforge/claude/system-prompts/main.md`
- `.codeforge/claude/settings/base.json`
- `.codeforge/file-manifest.json`

CodeForge may also create marker and audit files under `.codeforge/.markers/`.
EOF
	log "Created .codeforge/README.md"
fi

log ".codeforge/ scaffold is ready"
