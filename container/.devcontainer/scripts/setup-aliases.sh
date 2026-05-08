#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
# Setup cc/claude/ccraw aliases for claude with local system prompt support
#
# Idempotent: removes the entire managed block then re-writes it fresh.
# Safe to run on every container start via postStartCommand.

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
		tmp="$(mktemp)"
		sed '/# === CodeForge Claude aliases START/,/# === CodeForge Claude aliases END/d' "$rc" > "$tmp" && mv "$tmp" "$rc"

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
		sed -i "/^alias cc5='/d" "$rc"
		sed -i "/^alias cc6='/d" "$rc"
		sed -i "/^alias cc61='/d" "$rc"
		sed -i "/^alias cc7='/d" "$rc"
		sed -i "/^alias cc71='/d" "$rc"
		sed -i "/^alias ccw5='/d" "$rc"
		sed -i "/^alias ccw6='/d" "$rc"
		sed -i "/^alias ccw61='/d" "$rc"
		sed -i "/^alias ccw7='/d" "$rc"
		sed -i "/^alias ccw71='/d" "$rc"
		sed -i "/^alias cc-orc='/d" "$rc"
		sed -i "/^alias cc-orc5='/d" "$rc"
		sed -i "/^alias cc-orc6='/d" "$rc"
		sed -i "/^alias cc-orc61='/d" "$rc"
		sed -i "/^alias cc-orc7='/d" "$rc"
		sed -i "/^alias cc-orc71='/d" "$rc"
		sed -i "/^alias omc-apply='/d" "$rc"
		sed -i "/^alias omc-doctor='/d" "$rc"
		sed -i "/^alias omc-deepseek='/d" "$rc"
		sed -i "/^alias omc-kimi='/d" "$rc"
		sed -i "/^alias omc-qwen='/d" "$rc"
		sed -i "/^alias omc-zhipu='/d" "$rc"
		sed -i "/^alias omc-minimax='/d" "$rc"
		sed -i '/^alias check-setup=/d' "$rc"
		# cc-tools function from old format
		if grep -q "^cc-tools()" "$rc" 2>/dev/null; then
			sed -i '/^cc-tools() {/,/^}/d' "$rc"
		fi
		if grep -q "^omc-cc()" "$rc" 2>/dev/null; then
			sed -i '/^omc-cc() {/,/^}/d' "$rc"
		fi

		# --- 5. Write fresh managed block ---
		cat >>"$rc" <<BLOCK_EOF

${BLOCK_START}
_CLAUDE_DIR="\$HOME/.claude"
export GH_CONFIG_DIR="${GH_CONFIG_DIR:-/home/vscode/.config/gh}"
export WORKSPACE_ROOT="${WORKSPACE_ROOT:-/workspaces}"
export CODEFORGE_DIR="${CODEFORGE_DIR:-${WORKSPACE_ROOT:-/workspaces}/.codeforge}"
export DEVCONTAINER_SCRIPTS="${DEVCONTAINER_SCRIPTS}"
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# Browser opener — lets tools (gh, npm, etc.) open URLs on the host.
# VS Code sets BROWSER in its own terminals; this fallback covers external
# terminals (Windows Terminal, tmux, etc.) with a friendly "copy this URL" message.
export BROWSER="\${BROWSER:-${DEVCONTAINER_SCRIPTS}/open-browser.sh}"

# Terminal color defaults — Docker sets TERM=xterm (8 colors); upgrade to 256-color
if [ "\$TERM" = "xterm" ] || [ -z "\$TERM" ]; then
    export TERM=xterm-256color
fi
export COLORTERM="\${COLORTERM:-truecolor}"

# Terminal keybind hardening — disable signals that cause problems in
# Docker-attached panes (suspend closes pane, flow-control freezes
# terminal). EOF and QUIT rebound to esoteric combos for emergency use.
stty susp undef      # Kill Ctrl+Z — suspend closes Docker-attached panes
stty -ixon           # Kill Ctrl+S/Q — flow control freezes terminal
stty werase undef    # Kill Ctrl+W — conflicts with Windows Terminal close-tab
stty quit '^]'       # Rebind Ctrl+\ (SIGQUIT) → Ctrl+] (emergency only)
stty eof '^^'        # Rebind Ctrl+D (EOF) → Ctrl+^ (emergency only)
# zsh bindkey cleanup — stty handles the terminal layer, but zsh's line
# editor has its own bindings that bypass stty or conflict with pane hotkeys
if [ -n "\$ZSH_VERSION" ]; then
    bindkey -r '^W'   # Remove backward-kill-word (stty werase already disabled)
    bindkey -r '^[w'  # Remove copy-region-as-kill (unused emacs kill-ring op)
    bindkey -r '^[q'  # Remove push-line (niche; frees Alt+Q for terminal use)
fi

# Native binary (installed by claude-code-native feature)
_CLAUDE_BIN="\$HOME/.local/bin/claude"

# ChromaTerm wrapper (if ct is installed, wrap claude through it)
if command -v ct >/dev/null 2>&1; then
    _CLAUDE_WRAP="ct"
else
    _CLAUDE_WRAP="command"
fi

alias ccraw='command "\$_CLAUDE_BIN"'

_codeforge_ensure_settings() {
  bash "\$DEVCONTAINER_SCRIPTS/ensure-settings-generated.sh" --quiet || {
    echo "CodeForge could not generate/deploy Claude settings. Run check-setup for details." >&2
    return 1
  }
}

_codeforge_claude_profile() {
  local settings_file="\$1"
  local prompt_file="\$2"
  shift 2
  _codeforge_ensure_settings || return \$?
  CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1 "\$_CLAUDE_WRAP" "\$_CLAUDE_BIN" \\
    --settings "\$settings_file" \\
    --system-prompt-file "\$prompt_file" \\
    --permission-mode plan \\
    --allow-dangerously-skip-permissions \\
    --thinking-display summarized \\
    "\$@"
}

cc() { _codeforge_claude_profile "\$_CLAUDE_DIR/settings.json" "\$_CLAUDE_DIR/main-system-prompt.md" "\$@"; }
claude() { cc "\$@"; }
cc5() { _codeforge_claude_profile "\$_CLAUDE_DIR/settings-opus-45-200k.json" "\$_CLAUDE_DIR/main-system-prompt.md" "\$@"; }
cc6() { _codeforge_claude_profile "\$_CLAUDE_DIR/settings-opus-46-200k.json" "\$_CLAUDE_DIR/main-system-prompt.md" "\$@"; }
cc61() { _codeforge_claude_profile "\$_CLAUDE_DIR/settings-opus-46-1m-400k.json" "\$_CLAUDE_DIR/main-system-prompt.md" "\$@"; }
cc7() { _codeforge_claude_profile "\$_CLAUDE_DIR/settings-opus-47-200k.json" "\$_CLAUDE_DIR/main-system-prompt.md" "\$@"; }
cc71() { _codeforge_claude_profile "\$_CLAUDE_DIR/settings-opus-47-1m-400k.json" "\$_CLAUDE_DIR/main-system-prompt.md" "\$@"; }

ccw() { _codeforge_claude_profile "\$_CLAUDE_DIR/settings.json" "\$_CLAUDE_DIR/writing-system-prompt.md" "\$@"; }
ccw5() { _codeforge_claude_profile "\$_CLAUDE_DIR/settings-opus-45-200k.json" "\$_CLAUDE_DIR/writing-system-prompt.md" "\$@"; }
ccw6() { _codeforge_claude_profile "\$_CLAUDE_DIR/settings-opus-46-200k.json" "\$_CLAUDE_DIR/writing-system-prompt.md" "\$@"; }
ccw61() { _codeforge_claude_profile "\$_CLAUDE_DIR/settings-opus-46-1m-400k.json" "\$_CLAUDE_DIR/writing-system-prompt.md" "\$@"; }
ccw7() { _codeforge_claude_profile "\$_CLAUDE_DIR/settings-opus-47-200k.json" "\$_CLAUDE_DIR/writing-system-prompt.md" "\$@"; }
ccw71() { _codeforge_claude_profile "\$_CLAUDE_DIR/settings-opus-47-1m-400k.json" "\$_CLAUDE_DIR/writing-system-prompt.md" "\$@"; }

cc-orc() { _codeforge_claude_profile "\$_CLAUDE_DIR/settings.json" "\$_CLAUDE_DIR/orchestrator-system-prompt.md" "\$@"; }
cc-orc5() { _codeforge_claude_profile "\$_CLAUDE_DIR/settings-opus-45-200k.json" "\$_CLAUDE_DIR/orchestrator-system-prompt.md" "\$@"; }
cc-orc6() { _codeforge_claude_profile "\$_CLAUDE_DIR/settings-opus-46-200k.json" "\$_CLAUDE_DIR/orchestrator-system-prompt.md" "\$@"; }
cc-orc61() { _codeforge_claude_profile "\$_CLAUDE_DIR/settings-opus-46-1m-400k.json" "\$_CLAUDE_DIR/orchestrator-system-prompt.md" "\$@"; }
cc-orc7() { _codeforge_claude_profile "\$_CLAUDE_DIR/settings-opus-47-200k.json" "\$_CLAUDE_DIR/orchestrator-system-prompt.md" "\$@"; }
cc-orc71() { _codeforge_claude_profile "\$_CLAUDE_DIR/settings-opus-47-1m-400k.json" "\$_CLAUDE_DIR/orchestrator-system-prompt.md" "\$@"; }
alias ccr-apply='codeforge config apply && (ccr restart 2>/dev/null || ccr start) && echo "CCR config applied and restarted"'
alias omc-doctor='omc doctor --detail'
omc-cc() {
  if ! command -v omc >/dev/null 2>&1; then
    echo "oh-my-claude is not installed" >&2
    return 127
  fi
  omc cc "\$@"
}
alias omc-deepseek='omc cc -p ds'
alias omc-kimi='omc cc -p km'
alias omc-qwen='omc cc -p ay'
alias omc-zhipu='omc cc -p zp'
alias omc-minimax='omc cc -p mm-cn'

cc-tools() {
  echo "CodeForge Available Tools"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━"
  printf "  %-20s %s\n" "COMMAND" "STATUS"
  echo "  ────────────────────────────────────"
  for cmd in claude cc cc5 cc6 cc61 cc7 cc71 ccw ccw5 ccw6 ccw61 ccw7 ccw71 ccraw cc-orc cc-orc5 cc-orc6 cc-orc61 cc-orc7 cc-orc71 codeforge ccr omc omc-cc ccusage ccburn claude-monitor karma-status karma-live-session-tracker karma-title-generator codex ccusage-codex \\
             rtk ct cargo ruff biome dprint shfmt shellcheck hadolint \\
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
echo "  cc/claude   -> claude (opus-4-6, 200k ctx) with \$_CLAUDE_DIR/main-system-prompt.md"
echo "  ccraw       -> vanilla claude without any config"
echo "  cc5         -> claude (opus-4-5, 200k ctx)"
echo "  cc6/cc61    -> claude (opus-4-6, 200k ctx / 1m bounded to 400k)"
echo "  cc7/cc71    -> claude (opus-4-7, 200k ctx / 1m bounded to 400k)"
echo "  ccw*        -> same model profiles with \$_CLAUDE_DIR/writing-system-prompt.md"
echo "  cc-orc*     -> same model profiles with \$_CLAUDE_DIR/orchestrator-system-prompt.md"
echo "  ccr-apply   -> redeploy claude-code-router config + restart daemon"
echo "  omc-cc      -> launch Claude Code through oh-my-claude when installed"
echo "  omc-doctor  -> diagnose oh-my-claude when installed"
echo "  cc-tools    -> list all available CodeForge tools"
echo "  check-setup -> verify CodeForge setup health"
