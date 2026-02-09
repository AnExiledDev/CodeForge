#!/bin/bash
set -euo pipefail

VERSION="${VERSION:-latest}"
ENABLEBELL="${ENABLEBELL:-true}"
ENABLEOSC="${ENABLEOSC:-true}"

# Skip installation if version is "none"
if [ "${VERSION}" = "none" ]; then
    echo "[notify-hook] Skipping installation (version=none)"
    exit 0
fi

echo "[notify-hook] Starting installation..."
echo "[notify-hook] Bell enabled: ${ENABLEBELL}"
echo "[notify-hook] OSC notifications enabled: ${ENABLEOSC}"

# Create the notification script
cat > /usr/local/bin/claude-notify << 'SCRIPT'
#!/bin/bash
# Claude Code notification script
# Sends desktop notification (OSC 777) and terminal bell when Claude finishes

ENABLE_BELL="${NOTIFY_ENABLE_BELL:-true}"
ENABLE_OSC="${NOTIFY_ENABLE_OSC:-true}"
PROJECT_NAME="${CLAUDE_PROJECT_NAME:-$(basename "${WORKSPACE_ROOT:-$(pwd)}")}"

if [ "${ENABLE_OSC}" = "true" ]; then
    printf '\033]777;notify;%s;%s\007' "Claude Code" "Ready for input [${PROJECT_NAME}]"
fi

if [ "${ENABLE_BELL}" = "true" ]; then
    printf '\a'
fi
SCRIPT

chmod +x /usr/local/bin/claude-notify

# Store feature options as environment defaults
cat > /etc/profile.d/notify-hook.sh << EOF
export NOTIFY_ENABLE_BELL="${ENABLEBELL}"
export NOTIFY_ENABLE_OSC="${ENABLEOSC}"
EOF

echo "[notify-hook] Installation complete"
