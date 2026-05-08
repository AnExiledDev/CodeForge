#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
# Configure terminal environment:
# 1. VS Code Shift+Enter → newline for Claude Code terminal input
# 2. Zsh completion stack (carapace, fzf-tab, autosuggestions, syntax-highlighting)
# Both operations are idempotent via marker blocks / existence checks.

echo "[setup-terminal] Configuring terminal environment..."

# ══════════════════════════════════════════════════════════════════
# 1. VS Code Shift+Enter keybinding
# ══════════════════════════════════════════════════════════════════

KEYBINDINGS_DIR="$HOME/.config/Code/User"
KEYBINDINGS_FILE="$KEYBINDINGS_DIR/keybindings.json"

mkdir -p "$KEYBINDINGS_DIR"

if [ -f "$KEYBINDINGS_FILE" ] && grep -q "workbench.action.terminal.sendSequence" "$KEYBINDINGS_FILE" 2>/dev/null; then
	echo "[setup-terminal] Shift+Enter binding already present, skipping"
else
	BINDING='{"key":"shift+enter","command":"workbench.action.terminal.sendSequence","args":{"text":"\\u001b\\r"},"when":"terminalFocus"}'

	if [ -f "$KEYBINDINGS_FILE" ] && command -v jq >/dev/null 2>&1; then
		if jq empty "$KEYBINDINGS_FILE" 2>/dev/null; then
			jq ". + [$BINDING]" "$KEYBINDINGS_FILE" >"$KEYBINDINGS_FILE.tmp" &&
				mv "$KEYBINDINGS_FILE.tmp" "$KEYBINDINGS_FILE"
			echo "[setup-terminal] Merged binding into existing keybindings"
		else
			echo "[$BINDING]" | jq '.' >"$KEYBINDINGS_FILE"
			echo "[setup-terminal] Replaced invalid keybindings file"
		fi
	else
		cat >"$KEYBINDINGS_FILE" <<'EOF'
[
    {
        "key": "shift+enter",
        "command": "workbench.action.terminal.sendSequence",
        "args": {
            "text": "\r"
        },
        "when": "terminalFocus"
    }
]
EOF
		echo "[setup-terminal] Created keybindings file at $KEYBINDINGS_FILE"
	fi
fi

# ══════════════════════════════════════════════════════════════════
# 2. Zsh completion stack configuration
# ══════════════════════════════════════════════════════════════════

ZSHRC="$HOME/.zshrc"
MARKER_START="# >>> CodeForge terminal completions >>>"
MARKER_END="# <<< CodeForge terminal completions <<<"

if [ ! -f "$ZSHRC" ]; then
	echo "[setup-terminal] No .zshrc found, skipping completion config"
	exit 0
fi

# ── Remove existing marker block (idempotent) ─────────────────────
if grep -qF "$MARKER_START" "$ZSHRC"; then
	echo "[setup-terminal] Removing existing completion block for re-application..."
	sed -i "/${MARKER_START//\//\\/}/,/${MARKER_END//\//\\/}/d" "$ZSHRC"
fi

# ── Replace plugins=(git) with full plugin list ───────────────────
PLUGINS_LINE='plugins=(git docker docker-compose npm node python pip fzf-tab zsh-autosuggestions zsh-syntax-highlighting)'

if grep -q '^plugins=(' "$ZSHRC"; then
	sed -i "s/^plugins=(.*)/${PLUGINS_LINE}/" "$ZSHRC"
	echo "[setup-terminal] Updated plugins list in .zshrc"
else
	echo "[setup-terminal] No plugins=() line found, skipping plugins update"
fi

# ── Insert carapace init block AFTER 'source $ZSH/oh-my-zsh.sh' ──
CARAPACE_BLOCK="${MARKER_START}
# (managed by setup-terminal.sh — do not edit)

# Completion system fallback (OMZ handles primary compinit)
autoload -Uz compinit
compinit -C

# Carapace multi-shell completions
if command -v carapace >/dev/null 2>&1; then
    export CARAPACE_BRIDGES='zsh,fish,bash,inshellisense'
    source <(carapace _carapace)
fi

${MARKER_END}"

# Find the OMZ source line and insert after it
if grep -q 'source \$ZSH/oh-my-zsh.sh' "$ZSHRC"; then
	# Use awk to insert the block after the source line
	awk -v block="$CARAPACE_BLOCK" '
		/source \$ZSH\/oh-my-zsh\.sh/ {
			print
			print ""
			print block
			next
		}
		{ print }
	' "$ZSHRC" > "$ZSHRC.tmp" && mv "$ZSHRC.tmp" "$ZSHRC"
	echo "[setup-terminal] Inserted completion block after OMZ source"
else
	# Fallback: append to end of file
	echo "" >> "$ZSHRC"
	echo "$CARAPACE_BLOCK" >> "$ZSHRC"
	echo "[setup-terminal] Appended completion block to .zshrc (OMZ source line not found)"
fi

echo "[setup-terminal] Terminal configuration complete"
