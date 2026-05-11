#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only

# Post-start hook for oh-my-claude:
# 1. Filter role agents (keep provider-only) — runs on every start for idempotency
# 2. Status message

if ! command -v omc >/dev/null 2>&1; then
	echo "[oh-my-claude] omc not found; skipping"
	exit 0
fi

# Filter role agents that overlap with CodeForge's agent-system plugin.
# This runs on every container start to handle cases where omc install
# was run manually or the feature install didn't complete cleanup.
AGENTS_DIR="${HOME}/.claude/agents"
if [ -d "${AGENTS_DIR}" ]; then
	FILTERED=0
	for agent in \
		sisyphus prometheus claude-reviewer claude-scout oracle \
		ui-designer analyst librarian document-writer navigator hephaestus; do
		if [ -f "${AGENTS_DIR}/${agent}.md" ]; then
			rm -f "${AGENTS_DIR}/${agent}.md"
			FILTERED=$((FILTERED + 1))
		fi
	done
	if [ "${FILTERED}" -gt 0 ]; then
		echo "[oh-my-claude] Filtered ${FILTERED} role agents (provider-only mode)"
	fi
fi

echo "[oh-my-claude] Installed; launch per-session proxy with 'omc cc'"
