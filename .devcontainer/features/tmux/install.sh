#!/bin/bash
set -e

VERSION="${VERSION:-latest}"

# Skip installation if version is "none"
if [ "${VERSION}" = "none" ]; then
    echo "[tmux] Skipping installation (version=none)"
    exit 0
fi

echo "Installing tmux for Claude Code Agent Teams..."

# Install tmux via apt
apt-get update
apt-get install -y tmux

# Install Catppuccin theme (shallow clone for fast builds)
CATPPUCCIN_DIR="/usr/share/tmux/plugins/catppuccin"
echo "Installing Catppuccin tmux theme..."
mkdir -p "$(dirname "$CATPPUCCIN_DIR")"
git clone --depth 1 -b v2.1.3 https://github.com/catppuccin/tmux.git "$CATPPUCCIN_DIR"
# Remove .git to save space (we pinned the version, don't need history)
rm -rf "$CATPPUCCIN_DIR/.git"

# Create tmux config optimized for Claude Code teams + Catppuccin Mocha
TMUX_CONF="/etc/tmux.conf"
cat > "$TMUX_CONF" << 'EOF'
# Claude Code Agent Teams - tmux configuration
# Theme: Catppuccin Mocha

# ── Core Settings ──────────────────────────────────────────────
set -g mouse on
set -g base-index 1
setw -g pane-base-index 1
set -g history-limit 10000
set -sg escape-time 10
set -g focus-events on
set -g renumber-windows on

# ── True Color Support ─────────────────────────────────────────
set -g default-terminal "tmux-256color"
set -ga terminal-overrides ",*256col*:Tc"
set -ga terminal-overrides ",xterm-256color:RGB"

# ── Catppuccin Theme ──────────────────────────────────────────
set -g @catppuccin_flavor "mocha"

# Window tabs: rounded style with Nerd Font icons
set -g @catppuccin_window_status_style "rounded"
set -g @catppuccin_window_text " #W"
set -g @catppuccin_window_current_text " #W"
set -g @catppuccin_window_flags "icon"
set -g @catppuccin_window_number_position "left"

# Pane borders: colored with active pane indicator
set -g @catppuccin_pane_status_enabled "yes"
set -g @catppuccin_pane_border_status "top"

# Status bar background: transparent (inherit terminal bg)
set -g @catppuccin_status_background "none"

# Status bar: left side
set -g status-left ""

# Status bar: right side — session name + date/time
set -g @catppuccin_date_time_text " %H:%M"
set -g status-right "#{E:@catppuccin_status_session}"
set -agF status-right "#{E:@catppuccin_status_date_time}"

# Load Catppuccin (must come after all @catppuccin settings)
run /usr/share/tmux/plugins/catppuccin/catppuccin.tmux
EOF

echo "tmux installed successfully"
echo "  - Config: $TMUX_CONF"
echo "  - Theme: Catppuccin Mocha"
echo "  - Use 'tmux new -s claude-teams' to start a session"
echo "  - Claude Code Agent Teams will auto-detect tmux when available"
