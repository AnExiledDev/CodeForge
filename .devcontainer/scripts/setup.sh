#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
# Master setup script for CodeForge devcontainer

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVCONTAINER_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$DEVCONTAINER_DIR/.env"

# Load configuration
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

# Deprecation guard: .env may still set CLAUDE_CONFIG_DIR=/workspaces/.claude
# (pre-v2.0 default). Since .env is gitignored, PR updates can't fix it.
# Override with warning so all child scripts use the correct home location.
if [ "$CLAUDE_CONFIG_DIR" = "/workspaces/.claude" ]; then
    echo "[setup] WARNING: CLAUDE_CONFIG_DIR=/workspaces/.claude is deprecated (moved to home dir in v2.0)"
    echo "[setup]   Updating .devcontainer/.env automatically."
    CLAUDE_CONFIG_DIR="$HOME/.claude"
    # Fix the file on disk so subsequent restarts don't trigger this guard
    if [ -f "$ENV_FILE" ]; then
        sed -i 's|^CLAUDE_CONFIG_DIR=.*/workspaces/\.claude.*|# CLAUDE_CONFIG_DIR removed (v2.0: now uses $HOME/.claude)|' "$ENV_FILE"
        echo "[setup]   .env updated — CLAUDE_CONFIG_DIR line commented out."
    fi
fi

# Deprecation guard: CONFIG_SOURCE_DIR may still point to /workspaces/.claude
# (pre-v2.0 default was to keep config source in workspace .claude dir).
# Override with correct path.
if [ "$CONFIG_SOURCE_DIR" = "/workspaces/.claude" ]; then
    echo "[setup] WARNING: CONFIG_SOURCE_DIR=/workspaces/.claude is deprecated (moved to .devcontainer/config in v2.0)"
    echo "[setup]   Updating .devcontainer/.env automatically."
    CONFIG_SOURCE_DIR="$DEVCONTAINER_DIR/config"
    if [ -f "$ENV_FILE" ]; then
        sed -i 's|^CONFIG_SOURCE_DIR=.*/workspaces/\.claude.*|# CONFIG_SOURCE_DIR removed (v2.0: now uses .devcontainer/config)|' "$ENV_FILE"
        echo "[setup]   .env updated — CONFIG_SOURCE_DIR line commented out."
    fi
fi

# Deprecation guard: CONFIG_SOURCE_DIR may still point to .devcontainer/config
# (pre-v2.0 default). Redirect to .codeforge.
if [ "$CONFIG_SOURCE_DIR" = "$DEVCONTAINER_DIR/config" ] || [ "$CONFIG_SOURCE_DIR" = "/workspaces/.devcontainer/config" ]; then
    echo "[setup] WARNING: CONFIG_SOURCE_DIR pointing to .devcontainer/config is deprecated (moved to .codeforge in v2.0)"
    echo "[setup]   Redirecting to .codeforge."
    : "${CODEFORGE_DIR:=${WORKSPACE_ROOT:?}/.codeforge}"
    unset CONFIG_SOURCE_DIR
    if [ -f "$ENV_FILE" ]; then
        sed -i 's|^CONFIG_SOURCE_DIR=.*\.devcontainer/config.*|# CONFIG_SOURCE_DIR removed (v2.0: now uses .codeforge)|' "$ENV_FILE"
        echo "[setup]   .env updated — CONFIG_SOURCE_DIR line commented out."
    fi
fi

# Apply defaults for any unset variables
: "${CLAUDE_CONFIG_DIR:=$HOME/.claude}"
: "${CODEFORGE_DIR:=${WORKSPACE_ROOT:?}/.codeforge}"
: "${CONFIG_SOURCE_DIR:=$CODEFORGE_DIR}"
: "${SETUP_CONFIG:=true}"
: "${SETUP_ALIASES:=true}"
: "${SETUP_AUTH:=true}"
: "${SETUP_PLUGINS:=true}"
: "${SETUP_UPDATE_CLAUDE:=true}"
: "${SETUP_PROJECTS:=true}"
: "${SETUP_TERMINAL:=true}"
: "${SETUP_POSTSTART:=true}"

export CLAUDE_CONFIG_DIR CONFIG_SOURCE_DIR CODEFORGE_DIR SETUP_CONFIG SETUP_ALIASES SETUP_AUTH SETUP_PLUGINS SETUP_UPDATE_CLAUDE SETUP_PROJECTS SETUP_TERMINAL SETUP_POSTSTART

# Fix named volume ownership — Docker creates named volumes as root:root
# regardless of remoteUser. This is the only setup script requiring sudo.
if ! sudo chown "$(id -un):$(id -gn)" "$HOME/.claude" 2>/dev/null; then
    echo "[setup] WARNING: Could not fix volume ownership on $HOME/.claude — subsequent scripts may fail"
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
                # Show output on failure for diagnostics
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
run_script "$SCRIPT_DIR/setup-auth.sh" "$SETUP_AUTH"
run_script "$SCRIPT_DIR/setup-config.sh" "$SETUP_CONFIG"
run_script "$SCRIPT_DIR/setup-aliases.sh" "$SETUP_ALIASES"
run_script "$SCRIPT_DIR/setup-plugins.sh" "$SETUP_PLUGINS"
run_script "$SCRIPT_DIR/setup-projects.sh" "$SETUP_PROJECTS"
run_script "$SCRIPT_DIR/setup-terminal.sh" "$SETUP_TERMINAL"

# Background the update to avoid blocking container start
if [ "$SETUP_UPDATE_CLAUDE" = "true" ] && [ -f "$SCRIPT_DIR/setup-update-claude.sh" ]; then
    CLAUDE_UPDATE_LOG="${CLAUDE_UPDATE_LOG:-/workspaces/.tmp/claude-update.log}"
    mkdir -p "$(dirname "$CLAUDE_UPDATE_LOG")"
    bash "$SCRIPT_DIR/setup-update-claude.sh" >>"$CLAUDE_UPDATE_LOG" 2>&1 &
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
if [ -d "/home/vscode/.bun/bin" ] && [ ! -f /etc/profile.d/bun.sh ]; then
    sudo tee /etc/profile.d/bun.sh > /dev/null <<'BUNEOF'
export BUN_INSTALL="/home/vscode/.bun"
if [[ "${PATH}" != *"${BUN_INSTALL}/bin"* ]]; then
    export PATH="${BUN_INSTALL}/bin:${PATH}"
fi
BUNEOF
    sudo chmod +x /etc/profile.d/bun.sh
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
