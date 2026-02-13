#!/bin/bash
# Configure VS Code Shift+Enter → newline for Claude Code terminal input
# Writes to ~/.config/Code/User/keybindings.json (same path /terminal-setup uses)

echo "[setup-terminal] Configuring Shift+Enter keybinding for Claude Code..."

KEYBINDINGS_DIR="$HOME/.config/Code/User"
KEYBINDINGS_FILE="$KEYBINDINGS_DIR/keybindings.json"

# === Create directory if needed ===
mkdir -p "$KEYBINDINGS_DIR"

# === Check if already configured ===
if [ -f "$KEYBINDINGS_FILE" ] && grep -q "workbench.action.terminal.sendSequence" "$KEYBINDINGS_FILE" 2>/dev/null; then
	echo "[setup-terminal] Shift+Enter binding already present, skipping"
	exit 0
fi

# === Merge or create keybindings ===
BINDING='{"key":"shift+enter","command":"workbench.action.terminal.sendSequence","args":{"text":"\\u001b\\r"},"when":"terminalFocus"}'

if [ -f "$KEYBINDINGS_FILE" ] && command -v jq &>/dev/null; then
	# Merge into existing keybindings
	if jq empty "$KEYBINDINGS_FILE" 2>/dev/null; then
		jq ". + [$BINDING]" "$KEYBINDINGS_FILE" >"$KEYBINDINGS_FILE.tmp" &&
			mv "$KEYBINDINGS_FILE.tmp" "$KEYBINDINGS_FILE"
		echo "[setup-terminal] Merged binding into existing keybindings"
	else
		# Invalid JSON — overwrite
		echo "[$BINDING]" | jq '.' >"$KEYBINDINGS_FILE"
		echo "[setup-terminal] Replaced invalid keybindings file"
	fi
else
	# No existing file — write fresh
	cat >"$KEYBINDINGS_FILE" <<'EOF'
[
    {
        "key": "shift+enter",
        "command": "workbench.action.terminal.sendSequence",
        "args": {
            "text": "\u001b\r"
        },
        "when": "terminalFocus"
    }
]
EOF
	echo "[setup-terminal] Created keybindings file at $KEYBINDINGS_FILE"
fi
