#!/bin/bash
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

# Apply defaults for any unset variables
: "${CLAUDE_CONFIG_DIR:=/workspaces/.claude}"
: "${CONFIG_SOURCE_DIR:=$DEVCONTAINER_DIR/config}"
: "${SETUP_CONFIG:=true}"
: "${SETUP_ALIASES:=true}"
: "${SETUP_AUTH:=true}"
: "${SETUP_PLUGINS:=true}"
: "${SETUP_UPDATE_CLAUDE:=true}"
: "${SETUP_PROJECTS:=true}"
: "${SETUP_TERMINAL:=true}"

export CLAUDE_CONFIG_DIR CONFIG_SOURCE_DIR SETUP_CONFIG SETUP_ALIASES SETUP_AUTH SETUP_PLUGINS SETUP_UPDATE_CLAUDE SETUP_PROJECTS SETUP_TERMINAL

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
            if bash "$script" 2>&1; then
                echo "done"
                SETUP_RESULTS+=("$name:ok")
            else
                echo "FAILED (exit $?)"
                SETUP_RESULTS+=("$name:failed")
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

run_script "$SCRIPT_DIR/setup-symlink-claude.sh" "true"
run_script "$SCRIPT_DIR/setup-auth.sh" "$SETUP_AUTH"
run_script "$SCRIPT_DIR/setup-config.sh" "$SETUP_CONFIG"
run_script "$SCRIPT_DIR/setup-aliases.sh" "$SETUP_ALIASES"
run_script "$SCRIPT_DIR/setup-plugins.sh" "$SETUP_PLUGINS"
run_script "$SCRIPT_DIR/setup-projects.sh" "$SETUP_PROJECTS"
run_script "$SCRIPT_DIR/setup-terminal.sh" "$SETUP_TERMINAL"
run_script "$SCRIPT_DIR/setup-update-claude.sh" "$SETUP_UPDATE_CLAUDE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Setup Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
FAILURES=0
for result in "${SETUP_RESULTS[@]}"; do
    name="${result%%:*}"
    status="${result##*:}"
    case "$status" in
        ok)       printf "  ✓ %s\n" "$name" ;;
        failed)   printf "  ✗ %s (FAILED)\n" "$name"; FAILURES=$((FAILURES + 1)) ;;
        disabled) printf "  - %s (disabled)\n" "$name" ;;
        missing)  printf "  ? %s (not found)\n" "$name" ;;
    esac
done
ELAPSED=$(( $(date +%s) - SETUP_START ))
echo ""
if [ $FAILURES -gt 0 ]; then
    echo "  $FAILURES step(s) failed. Check output above for details."
fi
echo "  Completed in ${ELAPSED}s"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
