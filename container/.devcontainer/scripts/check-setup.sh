#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
# Verify CodeForge setup is working correctly
# Run anytime with: check-setup

echo "CodeForge Setup Check"
echo "━━━━━━━━━━━━━━━━━━━━"

PASS=0
FAIL=0
WARN=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVCONTAINER_DIR="$(dirname "$SCRIPT_DIR")"
WORKSPACE_ROOT="${WORKSPACE_ROOT:-/workspaces}"
CODEFORGE_DIR="${CODEFORGE_DIR:-${WORKSPACE_ROOT}/.codeforge}"
CLAUDE_DIR="$HOME/.claude"

check() {
	local label="$1" cmd="$2"
	if eval "$cmd" >/dev/null 2>&1; then
		printf "  ✓ %s\n" "$label"
		PASS=$((PASS + 1))
	else
		printf "  ✗ %s\n" "$label"
		FAIL=$((FAIL + 1))
	fi
}

warn_check() {
	local label="$1" cmd="$2"
	if eval "$cmd" >/dev/null 2>&1; then
		printf "  ✓ %s\n" "$label"
		PASS=$((PASS + 1))
	else
		printf "  ⚠ %s\n" "$label"
		WARN=$((WARN + 1))
	fi
}

echo ""
echo "Core:"
check "Claude Code installed" "command -v claude"
warn_check "Claude native binary" "[ -x ~/.local/bin/claude ]"
check "cc launcher configured" "type cc"
check "Config directory exists" "[ -d '$CLAUDE_DIR' ]"
check ".codeforge overrides/state exists" "[ -d '$CODEFORGE_DIR/.markers' ]"
check "Settings generation marker exists" "[ -f '$CODEFORGE_DIR/.markers/settings-generated-v3' ]"
check "Generated settings are current" "node '$SCRIPT_DIR/generate-settings-profiles.js' --check"
check "Settings file exists" "[ -f '$CLAUDE_DIR/settings.json' ]"
check "Default settings matches Opus 4.6 200k" "cmp -s '$CLAUDE_DIR/settings.json' '$CLAUDE_DIR/settings-opus-46-200k.json'"
check "Opus 4.7 settings profiles exist" "[ -f '$CLAUDE_DIR/settings-opus-47-200k.json' ] && [ -f '$CLAUDE_DIR/settings-opus-47-1m-400k.json' ]"
check "Opus 4.6 settings profiles exist" "[ -f '$CLAUDE_DIR/settings-opus-46-200k.json' ] && [ -f '$CLAUDE_DIR/settings-opus-46-1m-400k.json' ]"
check "Opus 4.5 settings profile exists" "[ -f '$CLAUDE_DIR/settings-opus-45-200k.json' ]"

echo ""
echo "Authentication:"
warn_check "GitHub CLI authenticated" "gh auth status"
warn_check "Git user configured" "git config --global user.name"

echo ""
echo "Tools:"
check "Node.js" "command -v node"
check "Python" "command -v python3"
check "uv" "command -v uv"
warn_check "Go" "command -v go"
warn_check "Bun" "command -v bun"
warn_check "Docker" "command -v docker"

echo ""
echo "Development:"
warn_check "biome" "command -v biome"
warn_check "ruff" "command -v ruff"
warn_check "ast-grep" "command -v ast-grep"
warn_check "tmux" "command -v tmux"
warn_check "codex" "command -v codex"

echo ""
echo "Claude Code Router:"
warn_check "ccr installed" "command -v ccr"
warn_check "CCR config exists" "test -f ${HOME}/.claude-code-router/config.json"

echo ""
echo "Claude Code Karma:"
warn_check "Karma hook wrappers installed" "command -v karma-live-session-tracker && command -v karma-title-generator"
warn_check "Karma status command installed" "command -v karma-status"
warn_check "Karma API responding" "curl -fsS http://localhost:${CODEFORGE_KARMA_API_PORT:-7848}/health"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━"
echo "  $PASS passed, $FAIL failed, $WARN warnings"

if [ $FAIL -gt 0 ]; then
	echo ""
	echo "  Run 'cc-tools' for detailed version info."
	exit 1
fi
