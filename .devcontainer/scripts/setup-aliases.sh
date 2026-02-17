#!/bin/bash
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
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# Prefer native binary over npm-installed version
if [ -x "\$HOME/.local/bin/claude" ]; then
    _CLAUDE_BIN="\$HOME/.local/bin/claude"
elif [ -x /usr/local/bin/claude ]; then
    _CLAUDE_BIN=/usr/local/bin/claude
else
    _CLAUDE_BIN=claude
fi

alias cc='CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1 command "\$_CLAUDE_BIN" --system-prompt-file "\$CLAUDE_CONFIG_DIR/main-system-prompt.md" --permission-mode plan --allow-dangerously-skip-permissions'
alias claude='CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1 command "\$_CLAUDE_BIN" --system-prompt-file "\$CLAUDE_CONFIG_DIR/main-system-prompt.md" --permission-mode plan --allow-dangerously-skip-permissions'
alias ccraw='command "\$_CLAUDE_BIN"'
alias ccw='CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1 command "\$_CLAUDE_BIN" --system-prompt-file "\$CLAUDE_CONFIG_DIR/writing-system-prompt.md" --permission-mode plan --allow-dangerously-skip-permissions'

cc-tools() {
  echo "CodeForge Available Tools"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━"
  printf "  %-20s %s\n" "COMMAND" "STATUS"
  echo "  ────────────────────────────────────"
  for cmd in claude cc ccw ccraw ccusage ccburn claude-monitor \\
             ccms cargo ruff biome dprint shfmt shellcheck hadolint \\
             ast-grep tree-sitter pyright typescript-language-server \\
             agent-browser gh docker git jq tmux bun go; do
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
echo "  cc-tools    -> list all available CodeForge tools"
echo "  check-setup -> verify CodeForge setup health"
