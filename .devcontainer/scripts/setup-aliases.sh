#!/bin/bash
# Setup cc/claude/ccraw aliases for claude with local system prompt support

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:?CLAUDE_CONFIG_DIR not set}"

echo "[setup-aliases] Configuring Claude aliases..."

# Simple alias definitions (not functions — functions don't behave reliably across shell contexts)
ALIAS_CC='alias cc='"'"'CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1 command claude --system-prompt-file "$CLAUDE_CONFIG_DIR/system-prompt.md" --permission-mode plan --allow-dangerously-skip-permissions'"'"''
ALIAS_CLAUDE='alias claude='"'"'CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1 command claude --system-prompt-file "$CLAUDE_CONFIG_DIR/system-prompt.md" --permission-mode plan --allow-dangerously-skip-permissions'"'"''
ALIAS_CCRAW='alias ccraw="command claude"'

for rc in ~/.bashrc ~/.zshrc; do
    if [ -f "$rc" ]; then
        # --- Backup before modifying ---
        cp "$rc" "${rc}.bak.$(date +%s)" 2>/dev/null || true
        # Clean old backups (keep last 3)
        ls -t "${rc}.bak."* 2>/dev/null | tail -n +4 | xargs rm -f 2>/dev/null || true

        # --- Cleanup old definitions ---

        # Remove old cc alias
        if grep -q "alias cc=" "$rc" 2>/dev/null; then
            sed -i '/alias cc=/d' "$rc"
            echo "[setup-aliases] Removed old cc alias from $(basename $rc)"
        fi
        # Remove old cc function (single-line or multi-line)
        if grep -q "^cc()" "$rc" 2>/dev/null; then
            sed -i '/^cc() {/,/^}/d' "$rc"
            echo "[setup-aliases] Removed old cc function from $(basename $rc)"
        fi
        # Remove old _claude_with_config function
        if grep -q "^_claude_with_config()" "$rc" 2>/dev/null; then
            sed -i '/^_claude_with_config() {/,/^}/d' "$rc"
            echo "[setup-aliases] Removed old _claude_with_config function from $(basename $rc)"
        fi
        # Remove old claude function override
        if grep -q "^claude() {" "$rc" 2>/dev/null; then
            sed -i '/^claude() { _claude_with_config/d' "$rc"
            echo "[setup-aliases] Removed old claude function from $(basename $rc)"
        fi
        # Remove old claude alias
        if grep -q "alias claude=" "$rc" 2>/dev/null; then
            sed -i '/alias claude=/d' "$rc"
        fi
        # Remove old ccraw alias
        if grep -q "alias ccraw=" "$rc" 2>/dev/null; then
            sed -i '/alias ccraw=/d' "$rc"
        fi
        # Remove old specwright alias
        if grep -q "alias specwright=" "$rc" 2>/dev/null; then
            sed -i '/alias specwright=/d' "$rc"
        fi
        # Remove old cc-tools/check-setup functions
        if grep -q "^cc-tools()" "$rc" 2>/dev/null; then
            sed -i '/^cc-tools() {/,/^}/d' "$rc"
        fi
        if grep -q "alias check-setup=" "$rc" 2>/dev/null; then
            sed -i '/alias check-setup=/d' "$rc"
        fi

        # --- Add environment and aliases (idempotent) ---
        # Guard: skip if aliases already present from a previous run
        if grep -q '# Claude Code environment and aliases' "$rc" 2>/dev/null; then
            echo "[setup-aliases] Aliases already present in $(basename $rc), skipping"
            continue
        fi
        echo "" >> "$rc"
        echo "# Claude Code environment and aliases (managed by setup-aliases.sh)" >> "$rc"
        # Export CLAUDE_CONFIG_DIR so it's available in all shells (not just VS Code remoteEnv)
        if ! grep -q 'export CLAUDE_CONFIG_DIR=' "$rc" 2>/dev/null; then
            echo "export CLAUDE_CONFIG_DIR=\"${CLAUDE_CONFIG_DIR}\"" >> "$rc"
        fi
        # Export UTF-8 locale so tmux renders Unicode correctly (docker exec doesn't inherit locale)
        if ! grep -q 'export LANG=en_US.UTF-8' "$rc" 2>/dev/null; then
            echo 'export LANG=en_US.UTF-8' >> "$rc"
            echo 'export LC_ALL=en_US.UTF-8' >> "$rc"
        fi
        echo "$ALIAS_CC" >> "$rc"
        echo "$ALIAS_CLAUDE" >> "$rc"
        echo "$ALIAS_CCRAW" >> "$rc"

        # cc-tools: list all available CodeForge tools with version info
        cat >> "$rc" << 'CCTOOLS_EOF'
cc-tools() {
  echo "CodeForge Available Tools"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━"
  printf "  %-20s %s\n" "COMMAND" "STATUS"
  echo "  ────────────────────────────────────"
  for cmd in claude cc ccraw ccusage ccburn claude-monitor \
             ruff biome dprint shfmt shellcheck hadolint \
             ast-grep tree-sitter pyright typescript-language-server \
             agent-browser gh docker git jq tmux bun go; do
    if command -v "$cmd" >/dev/null 2>&1; then
      ver=$("$cmd" --version 2>/dev/null | head -1 || echo "installed")
      printf "  %-20s ✓ %s\n" "$cmd" "$ver"
    else
      printf "  %-20s ✗ not found\n" "$cmd"
    fi
  done
}
CCTOOLS_EOF

        # check-setup: alias to the health check script
        DEVCONTAINER_SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        echo "alias check-setup='bash ${DEVCONTAINER_SCRIPTS}/check-setup.sh'" >> "$rc"

        echo "[setup-aliases] Added aliases to $(basename $rc)"
    fi
done

echo "[setup-aliases] Aliases configured:"
echo "  cc          -> claude with \$CLAUDE_CONFIG_DIR/system-prompt.md"
echo "  claude      -> claude with \$CLAUDE_CONFIG_DIR/system-prompt.md"
echo "  ccraw       -> vanilla claude without any config"
echo "  cc-tools    -> list all available CodeForge tools"
echo "  check-setup -> verify CodeForge setup health"
