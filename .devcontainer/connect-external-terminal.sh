#!/bin/bash
#
# Connect to CodeForge devcontainer from external terminal with tmux
# For Claude Code Agent Teams split-pane support
#
# Usage: ./connect-external-terminal.sh
#
# Prerequisites:
#   - Docker installed and running
#   - Devcontainer already running (via VS Code or CLI)
#
# This script will:
#   1. Auto-detect your running devcontainer
#   2. Attach to it with an interactive shell
#   3. Start or attach to a tmux session named "claude-teams"
#

set -e

TMUX_SESSION="claude-teams"
CONTAINER_LABEL="devcontainer.local_folder"

echo "======================================"
echo "  CodeForge External Terminal Connect"
echo "======================================"
echo ""

# Find the devcontainer
echo "Searching for running devcontainer..."
CONTAINER_ID=$(docker ps --filter "label=$CONTAINER_LABEL" --format "{{.ID}}" | head -n1)

if [ -z "$CONTAINER_ID" ]; then
	echo ""
	echo "ERROR: No running devcontainer found."
	echo ""
	echo "Make sure your devcontainer is running:"
	echo "  1. Open VS Code"
	echo "  2. Open the folder containing .devcontainer/"
	echo "  3. Use 'Dev Containers: Reopen in Container'"
	echo ""
	exit 1
fi

# Get container name for display
CONTAINER_NAME=$(docker ps --filter "id=$CONTAINER_ID" --format "{{.Names}}")
echo "Found container: $CONTAINER_NAME ($CONTAINER_ID)"
echo ""

# Check if tmux is available in the container
if ! docker exec "$CONTAINER_ID" which tmux >/dev/null 2>&1; then
	echo "ERROR: tmux is not installed in the container."
	echo "Rebuild the devcontainer to install the tmux feature."
	exit 1
fi

echo "Connecting to tmux session '$TMUX_SESSION'..."
echo ""
echo "Tips:"
echo "  - Agent Teams will use this terminal for split panes"
echo "  - Run 'claude' to start Claude Code"
echo "  - Press Ctrl+B then D to detach (keeps session running)"
echo "  - Mouse support is enabled for pane selection"
echo ""
echo "======================================"
echo ""

# Connect to container with tmux as vscode user (where aliases are defined)
# Pass UTF-8 locale so tmux renders Unicode correctly (not as underscores)
# Use tmux -u to force UTF-8 mode as a belt-and-suspenders measure
exec docker exec -it \
	-e LANG=en_US.UTF-8 \
	-e LC_ALL=en_US.UTF-8 \
	--user vscode "$CONTAINER_ID" bash -c "
  export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
  if tmux has-session -t '$TMUX_SESSION' 2>/dev/null; then
    tmux -u attach-session -t '$TMUX_SESSION'
  else
    tmux -u new-session -d -s '$TMUX_SESSION' -c \"\${WORKSPACE_ROOT:-/workspaces}\"
    sleep 0.5
    tmux send-keys -t '$TMUX_SESSION' 'cc' Enter
    tmux -u attach-session -t '$TMUX_SESSION'
  fi
"
