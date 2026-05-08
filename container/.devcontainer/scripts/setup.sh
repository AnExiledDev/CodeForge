#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
# Master setup script for CodeForge devcontainer

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVCONTAINER_DIR="$(dirname "$SCRIPT_DIR")"
WORKSPACE_ROOT="${WORKSPACE_ROOT:-/workspaces}"
CODEFORGE_DIR="${CODEFORGE_DIR:-${WORKSPACE_ROOT}/.codeforge}"
CONFIG_FILE="${CODEFORGE_DIR}/container.json"

# --- Migration warnings for removed config files ---
if [ -f "$DEVCONTAINER_DIR/.env" ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  MIGRATION: .devcontainer/.env is no longer used"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Setup config has moved to .codeforge/container.json"
    echo "  Delete .devcontainer/.env after migrating your settings."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
fi
if [ -f "$DEVCONTAINER_DIR/.secrets" ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  MIGRATION: .devcontainer/.secrets is no longer used"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Secrets have moved to .codeforge/secrets/ (one file per secret)."
    echo "  See AGENTS.md for the new secret names and setup instructions."
    echo "  Delete .devcontainer/.secrets after migrating your tokens."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
fi

# --- Load configuration from .codeforge/container.json ---
jq_val() {
    [ -f "$CONFIG_FILE" ] && jq -r "$1" "$CONFIG_FILE" 2>/dev/null || echo "$2"
}

SETUP_CONFIG=$(jq_val '.setup.config // true' true)
SETUP_ALIASES=$(jq_val '.setup.aliases // true' true)
SETUP_AUTH=$(jq_val '.setup.auth // true' true)
SETUP_PLUGINS=$(jq_val '.setup.plugins // true' true)
SETUP_UPDATE_CLAUDE=$(jq_val '.setup.updateClaude // true' true)
SETUP_PROJECTS=$(jq_val '.setup.projects // true' true)
SETUP_TERMINAL=$(jq_val '.setup.terminal // true' true)
SETUP_POSTSTART=$(jq_val '.setup.poststart // true' true)
CLAUDE_VERSION_LOCK=$(jq_val '.claude.versionLock // empty' "")
CODEFORGE_TIMEZONE=$(jq_val '.timezone // "America/Chicago"' "America/Chicago")

export CODEFORGE_DIR SETUP_CONFIG SETUP_ALIASES SETUP_AUTH SETUP_PLUGINS SETUP_UPDATE_CLAUDE CLAUDE_VERSION_LOCK SETUP_PROJECTS SETUP_TERMINAL SETUP_POSTSTART

# --- Configure timezone ---
if [ -n "$CODEFORGE_TIMEZONE" ]; then
    export TZ="$CODEFORGE_TIMEZONE"
    # Persist for all shells via profile.d
    if [ ! -f /etc/profile.d/codeforge-tz.sh ] || ! grep -q "TZ=\"$CODEFORGE_TIMEZONE\"" /etc/profile.d/codeforge-tz.sh 2>/dev/null; then
        sudo tee /etc/profile.d/codeforge-tz.sh > /dev/null <<TZEOF
export TZ="$CODEFORGE_TIMEZONE"
TZEOF
        sudo chmod 0644 /etc/profile.d/codeforge-tz.sh
    fi
fi

# Fix named volume ownership — Docker creates named volumes as root:root
# regardless of remoteUser. Every mount point from docker-compose.yml must
# be listed here. This is the only setup script requiring sudo.
_VOLUME_MOUNTS=(
    "$HOME/.claude"
    "$HOME/.codex"
    "$HOME/.hermes"
    "$HOME/.config/gh"
    "$HOME/.cache"
    "$HOME/.npm"
    "$HOME/.bun/install/cache"
)
_OWNER="$(id -un):$(id -gn)"
for _vol in "${_VOLUME_MOUNTS[@]}"; do
    [ -d "$_vol" ] || continue
    if ! sudo chown "$_OWNER" "$_vol" 2>/dev/null; then
        echo "[setup] WARNING: Could not fix volume ownership on $_vol"
    fi
done
unset _VOLUME_MOUNTS _OWNER _vol

# Mark all project directories as safe for Git — bind-mounted workspace may
# have different uid than container user, causing "dubious ownership"
# errors (CVE-2022-24765). Scans for .git dirs and worktree files.
while IFS= read -r gitdir; do
    project_dir="$(dirname "$gitdir")"
    git config --global --add safe.directory "$project_dir" 2>/dev/null
done < <(find "$WORKSPACE_ROOT" -maxdepth 6 \( -name .git -type d -o -name .git -type f \) 2>/dev/null)
# Also add workspace root as a catch-all
if ! git config --global --add safe.directory "${WORKSPACE_ROOT:-/workspaces}" 2>/dev/null; then
    echo "[setup] WARNING: Could not configure git safe.directory — git operations may show 'dubious ownership' errors"
fi

SETUP_START=$(date +%s)
SETUP_RESULTS=()

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CodeForge Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

run_script() {
    local script="$1"
    local enabled="$2"
    local name
    name="$(basename "$script" .sh)"

    if [ "$enabled" = "true" ]; then
        if [ -f "$script" ]; then
            printf "  %-30s" "$name..."
            local output
            if output=$(bash "$script" 2>&1); then
                echo "done"
                SETUP_RESULTS+=("$name:ok")
            else
                local exit_code=$?
                echo "FAILED (exit $exit_code)"
                SETUP_RESULTS+=("$name:failed")
                echo "$output" | sed 's/^/    /'
            fi
        else
            echo "  $name... not found, skipping"
            SETUP_RESULTS+=("$name:missing")
        fi
    else
        echo "  $name... skipped (disabled)"
        SETUP_RESULTS+=("$name:disabled")
    fi
}

run_poststart_hooks() {
    local hook_dir="/usr/local/devcontainer-poststart.d"
    if [ ! -d "$hook_dir" ]; then
        return 0
    fi
    local count=0
    for hook in "$hook_dir"/*.sh; do
        [ -f "$hook" ] || continue
        [ -x "$hook" ] || continue
        local name
        name="$(basename "$hook")"
        printf "  %-30s" "$name..."
        if bash "$hook" 2>&1; then
            echo "done"
            count=$((count + 1))
        else
            echo "FAILED (exit $?)"
        fi
    done
    if [ $count -gt 0 ]; then
        SETUP_RESULTS+=("poststart-hooks:ok ($count)")
    fi
}

run_script "$SCRIPT_DIR/setup-migrate-claude.sh" "true"
run_script "$SCRIPT_DIR/setup-migrate-codeforge.sh" "true"
run_script "$SCRIPT_DIR/setup-migrate-codeforge-v3.sh" "true"
run_script "$SCRIPT_DIR/setup-auth.sh" "$SETUP_AUTH"
run_script "$SCRIPT_DIR/ensure-settings-generated.sh" "$SETUP_CONFIG"
run_script "$SCRIPT_DIR/setup-config.sh" "$SETUP_CONFIG"
run_script "$SCRIPT_DIR/setup-aliases.sh" "$SETUP_ALIASES"
run_script "$SCRIPT_DIR/setup-plugins.sh" "$SETUP_PLUGINS"
run_script "$SCRIPT_DIR/setup-projects.sh" "$SETUP_PROJECTS"
run_script "$SCRIPT_DIR/setup-terminal.sh" "$SETUP_TERMINAL"

# Background the update to avoid blocking container start
if [ "$SETUP_UPDATE_CLAUDE" = "true" ] && [ -f "$SCRIPT_DIR/setup-update-claude.sh" ]; then
    CLAUDE_UPDATE_LOG="${CLAUDE_UPDATE_LOG:-/tmp/claude-update.log}"
    mkdir -p "$(dirname "$CLAUDE_UPDATE_LOG")"
    ( bash "$SCRIPT_DIR/setup-update-claude.sh" >>"$CLAUDE_UPDATE_LOG" 2>&1 && touch /tmp/.claude-update-ok || touch /tmp/.claude-update-failed ) &
    disown
    SETUP_RESULTS+=("setup-update-claude:background")
else
    SETUP_RESULTS+=("setup-update-claude:disabled")
fi

# Run post-start hooks
if [ "$SETUP_POSTSTART" = "true" ]; then
    run_poststart_hooks
fi

# Fix Bun PATH — external feature only adds to ~/.bashrc (misses non-interactive shells)
if [ -d "$HOME/.bun/bin" ]; then
    # Symlink bun binaries into /usr/local/bin for non-login, non-interactive shells (bash -c, exec)
    for bin in bun bunx; do
        if [ -x "$HOME/.bun/bin/$bin" ] && [ ! -e "/usr/local/bin/$bin" ]; then
            sudo ln -sf "$HOME/.bun/bin/$bin" "/usr/local/bin/$bin"
        fi
    done
    # Profile script sets BUN_INSTALL for login/interactive shells (content-idempotent)
    if [ ! -f /etc/profile.d/bun.sh ] || ! grep -q 'BUN_INSTALL="\$HOME/.bun"' /etc/profile.d/bun.sh; then
        sudo tee /etc/profile.d/bun.sh > /dev/null <<'BUNEOF'
export BUN_INSTALL="$HOME/.bun"
case ":${PATH}:" in
    *:"${BUN_INSTALL}/bin":*) ;;
    *) export PATH="${BUN_INSTALL}/bin:${PATH}" ;;
esac
BUNEOF
        sudo chmod 0644 /etc/profile.d/bun.sh
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Setup Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
FAILURES=0
for result in "${SETUP_RESULTS[@]}"; do
    name="${result%%:*}"
    status="${result##*:}"
    case "$status" in
        ok*)      printf "  ✓ %s\n" "$name" ;;
        failed)   printf "  ✗ %s (FAILED)\n" "$name"; FAILURES=$((FAILURES + 1)) ;;
        disabled) printf "  - %s (disabled)\n" "$name" ;;
        missing)  printf "  ? %s (not found)\n" "$name" ;;
        background) printf "  ⇢ %s (background)\n" "$name" ;;
    esac
done
ELAPSED=$(( $(date +%s) - SETUP_START ))
echo ""
if [ $FAILURES -gt 0 ]; then
    echo "  $FAILURES step(s) failed. Check output above for details."
fi
echo "  Completed in ${ELAPSED}s"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
