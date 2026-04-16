#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
# Setup cc/claude/ccraw aliases for claude with local system prompt support
#
# Idempotent: removes the entire managed block then re-writes it fresh.
# Safe to run on every container start via postStartCommand.

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:?CLAUDE_CONFIG_DIR not set}"

echo "[setup-aliases] Configuring Claude aliases..."

# Resolve check-setup path once (used inside the block we write)
DEVCONTAINER_SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BLOCK_START='# === CodeForge Claude aliases START (managed by setup-aliases.sh — do not edit) ==='
BLOCK_END='# === CodeForge Claude aliases END ==='

for rc in ~/.bashrc ~/.zshrc; do
	if [ -f "$rc" ]; then
		# --- 1. Backup before modifying ---
		cp "$rc" "${rc}.bak.$(date +%s)" 2>/dev/null || true
		# Clean old backups (keep last 3)
		ls -t "${rc}.bak."* 2>/dev/null | tail -n +4 | xargs rm -f 2>/dev/null || true

		# --- 2. Remove existing managed block (if present) ---
		sed -i '/# === CodeForge Claude aliases START/,/# === CodeForge Claude aliases END/d' "$rc"

		# --- 3. Legacy cleanup (pre-marker formats only) ---
		# These remove remnants from versions that predated the block-marker system.
		# After step 2, anything matching these patterns is orphaned from old formats.

		# Old function forms (pre-v1.10.0)
		if grep -q "^cc()" "$rc" 2>/dev/null; then
			sed -i '/^cc() {/,/^}/d' "$rc"
			echo "[setup-aliases] Removed legacy cc() function from $(basename "$rc")"
		fi
		if grep -q "^_claude_with_config()" "$rc" 2>/dev/null; then
			sed -i '/^_claude_with_config() {/,/^}/d' "$rc"
			echo "[setup-aliases] Removed legacy _claude_with_config() function from $(basename "$rc")"
		fi
		if grep -q "^claude() { _claude_with_config" "$rc" 2>/dev/null; then
			sed -i '/^claude() { _claude_with_config/d' "$rc"
			echo "[setup-aliases] Removed legacy claude() function from $(basename "$rc")"
		fi
		if grep -q "alias specwright=" "$rc" 2>/dev/null; then
			sed -i '/alias specwright=/d' "$rc"
			echo "[setup-aliases] Removed legacy specwright alias from $(basename "$rc")"
		fi

		# Old alias/export form (v1.10.0 — no block markers)
		sed -i '/# Claude Code environment and aliases/d' "$rc"
		sed -i '/^export CLAUDE_CONFIG_DIR="/d' "$rc"
		sed -i '/^export LANG=en_US\.UTF-8$/d' "$rc"
		sed -i '/^export LC_ALL=en_US\.UTF-8$/d' "$rc"
		# _CLAUDE_BIN if-block (4 patterns: if, elif, else, fi + assignments)
		sed -i '/^if \[ -x "\$HOME\/\.local\/bin\/claude" \]/,/^fi$/d' "$rc"
		sed -i '/^    _CLAUDE_BIN=/d' "$rc"
		# Standalone aliases from old format
		sed -i "/^alias cc='/d" "$rc"
		sed -i "/^alias claude='/d" "$rc"
		sed -i "/^alias ccraw='/d" "$rc"
		sed -i "/^alias ccw='/d" "$rc"
		sed -i '/^alias check-setup=/d' "$rc"
		# cc-tools function from old format
		if grep -q "^cc-tools()" "$rc" 2>/dev/null; then
			sed -i '/^cc-tools() {/,/^}/d' "$rc"
		fi

		# --- 5. Write fresh managed block ---
		cat >>"$rc" <<BLOCK_EOF

${BLOCK_START}
export CLAUDE_CONFIG_DIR="${CLAUDE_CONFIG_DIR}"
export GH_CONFIG_DIR="${GH_CONFIG_DIR:-/workspaces/.gh}"
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# Terminal color defaults — Docker sets TERM=xterm (8 colors); upgrade to 256-color
if [ "\$TERM" = "xterm" ] || [ -z "\$TERM" ]; then
    export TERM=xterm-256color
fi
export COLORTERM="\${COLORTERM:-truecolor}"

# Native binary (installed by claude-code-native feature)
_CLAUDE_BIN="\$HOME/.local/bin/claude"

# ChromaTerm wrapper (if ct is installed, wrap claude through it)
if command -v ct >/dev/null 2>&1; then
    _CLAUDE_WRAP="ct"
else
    _CLAUDE_WRAP="command"
fi

# oh-my-claude tools to disable (memory, preferences, coworker - keep only proxy tools)
# Note: no quotes around tool names - they don't contain spaces and quotes would be passed literally
_OMC_DISALLOWED_TOOLS='--disallowedTools mcp__oh-my-claude__remember mcp__oh-my-claude__recall mcp__oh-my-claude__get_memory mcp__oh-my-claude__forget mcp__oh-my-claude__list_memories mcp__oh-my-claude__memory_status mcp__oh-my-claude__compact_memories mcp__oh-my-claude__clear_memories mcp__oh-my-claude__summarize_memories mcp__oh-my-claude__add_preference mcp__oh-my-claude__list_preferences mcp__oh-my-claude__get_preference mcp__oh-my-claude__update_preference mcp__oh-my-claude__delete_preference mcp__oh-my-claude__match_preferences mcp__oh-my-claude__preference_stats mcp__oh-my-claude__coworker_task'

alias cc='CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1 "\$_CLAUDE_WRAP" "\$_CLAUDE_BIN" --system-prompt-file "\$CLAUDE_CONFIG_DIR/main-system-prompt.md" --permission-mode plan --allow-dangerously-skip-permissions \$_OMC_DISALLOWED_TOOLS'
alias claude='CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1 "\$_CLAUDE_WRAP" "\$_CLAUDE_BIN" --system-prompt-file "\$CLAUDE_CONFIG_DIR/main-system-prompt.md" --permission-mode plan --allow-dangerously-skip-permissions \$_OMC_DISALLOWED_TOOLS'
alias ccraw='command "\$_CLAUDE_BIN"'
alias ccw='CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1 "\$_CLAUDE_WRAP" "\$_CLAUDE_BIN" --system-prompt-file "\$CLAUDE_CONFIG_DIR/writing-system-prompt.md" --permission-mode plan --allow-dangerously-skip-permissions \$_OMC_DISALLOWED_TOOLS'
alias cc-orc='CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1 "\$_CLAUDE_WRAP" "\$_CLAUDE_BIN" --system-prompt-file "\$CLAUDE_CONFIG_DIR/orchestrator-system-prompt.md" --permission-mode plan --allow-dangerously-skip-permissions \$_OMC_DISALLOWED_TOOLS'
alias ccr-apply='codeforge config apply && (ccr restart 2>/dev/null || ccr start) && echo "CCR config applied and restarted"'
alias omc-apply='codeforge config apply && (omc proxy restart 2>/dev/null || omc proxy start) && echo "OMC config applied and proxy restarted"'

cc-tools() {
  echo "CodeForge Available Tools"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━"
  printf "  %-20s %s\n" "COMMAND" "STATUS"
  echo "  ────────────────────────────────────"
  for cmd in claude cc ccw ccraw cc-orc codeforge ccr omc ccusage ccburn claude-monitor codex ccusage-codex \\
             ct cargo ruff biome dprint shfmt shellcheck hadolint \\
             ast-grep tree-sitter pyright typescript-language-server \\
             agent-browser gh docker git jq tmux bun go infocmp; do
    if command -v "\$cmd" >/dev/null 2>&1; then
      ver=\$("\$cmd" --version 2>/dev/null | head -1 || echo "installed")
      printf "  %-20s ✓ %s\n" "\$cmd" "\$ver"
    else
      printf "  %-20s ✗ not found\n" "\$cmd"
    fi
  done
}

alias check-setup='bash ${DEVCONTAINER_SCRIPTS}/check-setup.sh'
${BLOCK_END}
BLOCK_EOF

		echo "[setup-aliases] Added aliases to $(basename "$rc")"
	fi
done

echo "[setup-aliases] Aliases configured:"
echo "  cc          -> claude with \$CLAUDE_CONFIG_DIR/main-system-prompt.md"
echo "  claude      -> claude with \$CLAUDE_CONFIG_DIR/main-system-prompt.md"
echo "  ccraw       -> vanilla claude without any config"
echo "  ccw         -> claude with \$CLAUDE_CONFIG_DIR/writing-system-prompt.md"
echo "  cc-orc      -> claude with \$CLAUDE_CONFIG_DIR/orchestrator-system-prompt.md (delegation mode)"
echo "  ccr-apply   -> redeploy claude-code-router config + restart daemon"
echo "  cc-tools    -> list all available CodeForge tools"
echo "  check-setup -> verify CodeForge setup health"
