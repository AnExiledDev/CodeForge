#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
set -euo pipefail

# Import options from devcontainer-feature.json
CLAUDE_MEM_VERSION="${VERSION:-latest}"
WORKER_PORT="${WORKERPORT:-37777}"
AUTOSTART="${AUTOSTART:-true}"
CHROMA_MODE="${CHROMAMODE:-local}"
USERNAME="${USERNAME:-automatic}"

# Skip installation if version is "none"
if [ "${CLAUDE_MEM_VERSION}" = "none" ]; then
    echo "[claude-mem] Skipping installation (version=none)"
    exit 0
fi

echo "[claude-mem] Starting installation..."
echo "[claude-mem] Version: ${CLAUDE_MEM_VERSION}"
echo "[claude-mem] Worker port: ${WORKER_PORT}"
echo "[claude-mem] Chroma mode: ${CHROMA_MODE}"
echo "[claude-mem] Autostart: ${AUTOSTART}"

# Source NVM
if [ -f /usr/local/share/nvm/nvm.sh ]; then
    # shellcheck disable=SC1091
    source /usr/local/share/nvm/nvm.sh
fi
export PATH="/home/vscode/.bun/bin:/root/.bun/bin:${PATH}"

# Validate required tools
for cmd in bun node npm git; do
    if ! command -v "${cmd}" >/dev/null 2>&1; then
        echo "[claude-mem] ERROR: ${cmd} is required but not found"
        exit 1
    fi
done

# Detect user
if [ "${USERNAME}" = "auto" ] || [ "${USERNAME}" = "automatic" ]; then
    USERNAME=""
    for current_user in vscode node codespace; do
        if id -u "${current_user}" >/dev/null 2>&1; then
            USERNAME="${current_user}"
            break
        fi
    done
    [ -z "${USERNAME}" ] && USERNAME=root
elif [ "${USERNAME}" = "none" ] || ! id -u "${USERNAME}" >/dev/null 2>&1; then
    USERNAME=root
fi

# Get user home directory
USER_HOME="$(getent passwd "${USERNAME}" | cut -d: -f6)"
if [ -z "${USER_HOME}" ] || [ ! -d "${USER_HOME}" ]; then
    echo "[claude-mem] ERROR: Home directory not found for user ${USERNAME}"
    exit 1
fi

# Validate WORKER_PORT is numeric
if [[ ! "${WORKER_PORT}" =~ ^[0-9]+$ ]]; then
    echo "[claude-mem] ERROR: workerPort must be numeric"
    exit 1
fi

# Validate AUTOSTART is true/false
if [ "${AUTOSTART}" != "true" ] && [ "${AUTOSTART}" != "false" ]; then
    echo "[claude-mem] ERROR: autostart must be true or false"
    exit 1
fi

# Validate CHROMA_MODE is local/disabled
if [ "${CHROMA_MODE}" != "local" ] && [ "${CHROMA_MODE}" != "disabled" ]; then
    echo "[claude-mem] ERROR: chromaMode must be local or disabled"
    exit 1
fi

echo "[claude-mem] Installing for user: ${USERNAME} (${USER_HOME})"

# Clone repository
rm -rf /opt/claude-mem
git clone https://github.com/thedotmack/claude-mem.git /opt/claude-mem/

# Checkout specific version if not "latest"
if [ "${CLAUDE_MEM_VERSION}" != "latest" ]; then
    git -C /opt/claude-mem checkout --detach "${CLAUDE_MEM_VERSION}"
fi

# Install dependencies
echo "[claude-mem] Installing npm dependencies..."
cd /opt/claude-mem && npm install --omit=dev --legacy-peer-deps

# Create data directories
mkdir -p "${USER_HOME}/.claude-mem/chroma" "${USER_HOME}/.claude-mem/logs"

# Create settings file
cat > "${USER_HOME}/.claude-mem/settings.json" <<EOF
{
  "CLAUDE_MEM_WORKER_PORT": "${WORKER_PORT}",
  "CLAUDE_MEM_CHROMA_MODE": "${CHROMA_MODE}",
  "CLAUDE_MEM_CHROMA_DATA_DIR": "${USER_HOME}/.claude-mem/chroma"
}
EOF

# Create wrapper script: claude-mem-worker
cat > /usr/local/bin/claude-mem-worker <<'EOF'
#!/bin/bash
# claude-mem worker management
ACTION="${1:-status}"
PORT="${CLAUDE_MEM_WORKER_PORT:-37777}"
PID_FILE="/tmp/claude-mem-worker.pid"
LOG_FILE="/tmp/claude-mem-worker.log"

if [ -f /usr/local/share/nvm/nvm.sh ]; then
  source /usr/local/share/nvm/nvm.sh
fi
export PATH="/home/vscode/.bun/bin:/root/.bun/bin:${PATH}"

case "${ACTION}" in
  start)
    if [ -f "${PID_FILE}" ] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
      echo "[claude-mem] Worker already running (PID $(cat "${PID_FILE}"))"
      exit 0
    fi
    bun /opt/claude-mem/plugin/scripts/worker-service.cjs start >>"${LOG_FILE}" 2>&1 &
    echo $! > "${PID_FILE}"
    echo "[claude-mem] Worker started (PID $!, port ${PORT})"
    ;;
  stop)
    if [ -f "${PID_FILE}" ] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
      kill "$(cat "${PID_FILE}")"
      rm -f "${PID_FILE}"
      echo "[claude-mem] Worker stopped"
    else
      echo "[claude-mem] Worker not running"
    fi
    ;;
  status)
    if [ -f "${PID_FILE}" ] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
      echo "[claude-mem] Worker running (PID $(cat "${PID_FILE}"), port ${PORT})"
    else
      echo "[claude-mem] Worker not running"
    fi
    ;;
  *)
    echo "Usage: claude-mem-worker {start|stop|status}"
    exit 1
    ;;
esac
EOF

# Create wrapper script: claude-mem-hook
cat > /usr/local/bin/claude-mem-hook <<'EOF'
#!/bin/bash
# Thin HTTP proxy — sends hook payload to worker, exits 0 always
EVENT="${1:-unknown}"
PORT="${CLAUDE_MEM_WORKER_PORT:-37777}"
PAYLOAD=$(cat)
curl -s -m 10 -X POST "http://localhost:${PORT}/hook/${EVENT}" \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}" >/dev/null 2>&1 || true
exit 0
EOF

# Make wrapper scripts executable
chmod +x /usr/local/bin/claude-mem-worker
chmod +x /usr/local/bin/claude-mem-hook

# Create poststart script (only if AUTOSTART=true)
if [ "${AUTOSTART}" = "true" ]; then
    mkdir -p /usr/local/devcontainer-poststart.d
    cat > /usr/local/devcontainer-poststart.d/45-claude-mem.sh <<EOF
#!/bin/bash
set -euo pipefail

CLAUDE_MEM_HOME="/opt/claude-mem"
CLAUDE_MEM_USER="${USERNAME}"
CLAUDE_MEM_USER_HOME="${USER_HOME}"
WORKER_PORT="\${CLAUDE_MEM_WORKER_PORT:-${WORKER_PORT}}"
PID_FILE="/tmp/claude-mem-worker.pid"
LOG_FILE="/tmp/claude-mem-worker.log"

if [ -f /usr/local/share/nvm/nvm.sh ]; then
  source /usr/local/share/nvm/nvm.sh
fi
export PATH="/home/vscode/.bun/bin:/root/.bun/bin:${PATH}"

# Start worker if not running
if [ ! -f "\${PID_FILE}" ] || ! kill -0 "\$(cat "\${PID_FILE}")" 2>/dev/null; then
  export CLAUDE_MEM_WORKER_PORT="\${WORKER_PORT}"
  bun "\${CLAUDE_MEM_HOME}/plugin/scripts/worker-service.cjs" start >>"\${LOG_FILE}" 2>&1 &
  echo \$! > "\${PID_FILE}"
  echo "[claude-mem] Worker started (PID \$!, port \${WORKER_PORT})"
else
  echo "[claude-mem] Worker already running (PID \$(cat "\${PID_FILE}"))"
fi

# Register MCP server in Claude Code settings
SETTINGS_FILE="\${CLAUDE_MEM_USER_HOME}/.claude/settings.json"
if [ ! -f "\${SETTINGS_FILE}" ]; then
  echo '{}' > "\${SETTINGS_FILE}"
fi

if ! command -v jq &>/dev/null; then
  echo "[claude-mem] WARNING: jq not available, skipping MCP registration"
  exit 0
fi

SERVER_CONFIG=\$(jq -n '{
  command: "bun",
  args: ["/opt/claude-mem/plugin/scripts/mcp-server.cjs"]
}')

TEMP_FILE=\$(mktemp)
jq --argjson server "\${SERVER_CONFIG}" \
  '.mcpServers["claude-mem"] = \$server' \
  "\${SETTINGS_FILE}" > "\${TEMP_FILE}"

if jq empty "\${TEMP_FILE}" 2>/dev/null; then
  mv "\${TEMP_FILE}" "\${SETTINGS_FILE}"
  echo "[claude-mem] MCP server registered in Claude Code settings"
else
  echo "[claude-mem] ERROR: Generated invalid JSON"
  rm -f "\${TEMP_FILE}"
fi

chmod 644 "\${SETTINGS_FILE}"
chown "${USERNAME}:${USERNAME}" "\${SETTINGS_FILE}" 2>/dev/null || true
EOF
    chmod +x /usr/local/devcontainer-poststart.d/45-claude-mem.sh
    echo "[claude-mem] Post-start hook installed"
else
    echo "[claude-mem] Autostart disabled"
fi

# Set ownership
chown -R "${USERNAME}:" /opt/claude-mem
chown -R "${USERNAME}:" "${USER_HOME}/.claude-mem"

# Verify installation
if [ ! -d /opt/claude-mem/node_modules ]; then
    echo "[claude-mem] ERROR: npm install failed (node_modules not found)"
    exit 1
fi

# Print summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Claude-Mem Installation Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  User:        ${USERNAME}"
echo "  Version:     ${CLAUDE_MEM_VERSION}"
echo "  Worker port: ${WORKER_PORT}"
echo "  Chroma mode: ${CHROMA_MODE}"
echo "  Autostart:   ${AUTOSTART}"
echo ""
echo "  MCP tools available:"
echo "    - memory_store"
echo "    - memory_search"
echo "    - memory_recall"
echo "    - observation_capture"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
