#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
set -euo pipefail

KARMA_REF="${VERSION:-4067d87ee5c85eb7d2877890ba6174115f0bee2e}"
API_PORT="${APIPORT:-7848}"
FRONTEND_PORT="${FRONTENDPORT:-7847}"
AUTOSTART="${AUTOSTART:-true}"
USERNAME="${USERNAME:-automatic}"
INSTALL_DIR="/opt/claude-code-karma"

if [ "${KARMA_REF}" = "none" ]; then
	echo "[claude-code-karma] Skipping installation (version=none)"
	exit 0
fi

echo "[claude-code-karma] Starting installation..."
echo "[claude-code-karma] Ref: ${KARMA_REF}"
echo "[claude-code-karma] API port: ${API_PORT}"
echo "[claude-code-karma] Frontend port: ${FRONTEND_PORT}"

if [ -f /usr/local/share/nvm/nvm.sh ]; then
	# shellcheck disable=SC1091
	source /usr/local/share/nvm/nvm.sh
fi

for cmd in git python3 npm; do
	if ! command -v "${cmd}" >/dev/null 2>&1; then
		echo "[claude-code-karma] ERROR: ${cmd} is required but not found"
		exit 1
	fi
done

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

USER_HOME="$(getent passwd "${USERNAME}" | cut -d: -f6)"
if [ -z "${USER_HOME}" ] || [ ! -d "${USER_HOME}" ]; then
	echo "[claude-code-karma] ERROR: Home directory not found for user ${USERNAME}"
	exit 1
fi

if [[ ! "${API_PORT}" =~ ^[0-9]+$ ]] || [[ ! "${FRONTEND_PORT}" =~ ^[0-9]+$ ]]; then
	echo "[claude-code-karma] ERROR: apiPort and frontendPort must be numeric"
	exit 1
fi

if [ "${API_PORT}" = "8000" ] || [ "${FRONTEND_PORT}" = "5173" ]; then
	echo "[claude-code-karma] ERROR: upstream default ports 8000/5173 are not allowed in CodeForge"
	exit 1
fi

if [ "${AUTOSTART}" != "true" ] && [ "${AUTOSTART}" != "false" ]; then
	echo "[claude-code-karma] ERROR: autostart must be true or false"
	exit 1
fi

echo "[claude-code-karma] Installing for user: ${USERNAME} (${USER_HOME})"

rm -rf "${INSTALL_DIR}"
git clone https://github.com/JayantDevkar/claude-code-karma.git "${INSTALL_DIR}"
git -C "${INSTALL_DIR}" checkout --detach "${KARMA_REF}"

echo "[claude-code-karma] Applying CodeForge read-only settings patch..."
python3 - "${INSTALL_DIR}" "${API_PORT}" <<'PY'
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1])
api_port = sys.argv[2]

settings_py = root / "api" / "routers" / "settings.py"
text = settings_py.read_text()
pattern = re.compile(
    r'@router\.put\("/", response_model=Dict\[str, Any\]\)\n'
    r'async def update_settings\(updates: ClaudeSettingsUpdate\):\n'
    r'.*?(?=\n\n@router\.|\Z)',
    re.S,
)
replacement = '''@router.put("/", response_model=Dict[str, Any])
async def update_settings(updates: ClaudeSettingsUpdate):
    """Settings are managed by CodeForge and are intentionally read-only."""
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Claude settings are managed by CodeForge and cannot be modified from Karma.",
    )
'''
new_text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit("failed to patch settings.py update_settings")
settings_py.write_text(new_text)

page = root / "frontend" / "src" / "routes" / "settings" / "+page.svelte"
text = page.read_text()
text = text.replace(
    "subtitle=\"Manage your Claude Code configuration\"",
    "subtitle=\"View your CodeForge-managed Claude Code configuration\"",
)
text = text.replace(
    "// State\n\tlet isLoading",
    "// State\n\tconst SETTINGS_READ_ONLY = true;\n\tlet isLoading",
)
text = text.replace(
    "async function updateSetting(field: string, value: unknown) {\n\t\tsavingField = field;",
    "async function updateSetting(field: string, value: unknown) {\n\t\tif (SETTINGS_READ_ONLY) {\n\t\t\terror = 'Claude settings are managed by CodeForge and are read-only in Karma.';\n\t\t\treturn;\n\t\t}\n\t\tsavingField = field;",
)
text = text.replace("disabled={savingField", "disabled={SETTINGS_READ_ONLY || savingField")
text = text.replace("disabled={savingField", "disabled={SETTINGS_READ_ONLY || savingField")
text = text.replace("disabled={savingField", "disabled={SETTINGS_READ_ONLY || savingField")
page.write_text(text)

config = root / "frontend" / "src" / "lib" / "config.ts"
text = config.read_text()
text = text.replace(
    "export const API_BASE = import.meta.env.PUBLIC_API_URL || 'http://localhost:8000';",
    "export const API_BASE = import.meta.env.PUBLIC_API_URL || `http://localhost:${import.meta.env.PUBLIC_KARMA_API_PORT || '" + api_port + "'}`;",
)
config.write_text(text)
PY

echo "[claude-code-karma] Installing API dependencies..."
python3 -m venv "${INSTALL_DIR}/api/.venv"
"${INSTALL_DIR}/api/.venv/bin/pip" install --upgrade pip
"${INSTALL_DIR}/api/.venv/bin/pip" install -e "${INSTALL_DIR}/api[dev]"
"${INSTALL_DIR}/api/.venv/bin/pip" install -r "${INSTALL_DIR}/api/requirements.txt"

echo "[claude-code-karma] Installing and building frontend..."
(
	cd "${INSTALL_DIR}/frontend"
	npm install
	PUBLIC_KARMA_API_PORT="${API_PORT}" PUBLIC_API_URL="http://localhost:${API_PORT}" npm run build
)
npm cache clean --force >/dev/null 2>&1 || true

chown -R "${USERNAME}:" "${INSTALL_DIR}" 2>/dev/null || true
mkdir -p "${USER_HOME}/.claude_karma"
chown -R "${USERNAME}:" "${USER_HOME}/.claude_karma" 2>/dev/null || true

cat > /usr/local/bin/karma-live-session-tracker <<EOF
#!/bin/bash
exec "${INSTALL_DIR}/api/.venv/bin/python" "${INSTALL_DIR}/hooks/live_session_tracker.py" "\$@"
EOF
chmod +x /usr/local/bin/karma-live-session-tracker

cat > /usr/local/bin/karma-title-generator <<EOF
#!/bin/bash
export CLAUDE_KARMA_API="\${CLAUDE_KARMA_API:-http://localhost:\${CODEFORGE_KARMA_API_PORT:-${API_PORT}}}"
exec "${INSTALL_DIR}/api/.venv/bin/python" "${INSTALL_DIR}/hooks/session_title_generator.py" "\$@"
EOF
chmod +x /usr/local/bin/karma-title-generator

cat > /usr/local/bin/karma-status <<'EOF'
#!/bin/bash
echo "Claude Code Karma"
echo "API port: ${CODEFORGE_KARMA_API_PORT:-7848}"
echo "Frontend port: ${CODEFORGE_KARMA_FRONTEND_PORT:-7847}"
echo ""
for name in api frontend; do
	pid_file="/tmp/claude-code-karma-${name}.pid"
	if [ -f "${pid_file}" ] && kill -0 "$(cat "${pid_file}")" 2>/dev/null; then
		echo "${name}: running (PID $(cat "${pid_file}"))"
	else
		echo "${name}: stopped"
	fi
done
echo ""
echo "Logs: /tmp/claude-code-karma-api.log, /tmp/claude-code-karma-frontend.log"
EOF
chmod +x /usr/local/bin/karma-status

if [ "${AUTOSTART}" = "true" ]; then
	mkdir -p /usr/local/devcontainer-poststart.d
	cat > /usr/local/devcontainer-poststart.d/44-claude-code-karma.sh <<EOF
#!/bin/bash
set -euo pipefail

KARMA_HOME="${INSTALL_DIR}"
KARMA_USER="${USERNAME}"
KARMA_USER_HOME="${USER_HOME}"
API_PORT="\${CODEFORGE_KARMA_API_PORT:-${API_PORT}}"
FRONTEND_PORT="\${CODEFORGE_KARMA_FRONTEND_PORT:-${FRONTEND_PORT}}"
API_LOG="/tmp/claude-code-karma-api.log"
FRONTEND_LOG="/tmp/claude-code-karma-frontend.log"

start_as_user() {
	local name="\$1"
	shift
	if [ "\${KARMA_USER}" = "root" ]; then
		HOME="\${KARMA_USER_HOME}" "\$@" &
	else
		sudo -u "\${KARMA_USER}" HOME="\${KARMA_USER_HOME}" "\$@" &
	fi
	echo \$! > "/tmp/claude-code-karma-\${name}.pid"
}

if [ -f /usr/local/share/nvm/nvm.sh ]; then
	# shellcheck disable=SC1091
	source /usr/local/share/nvm/nvm.sh
fi

mkdir -p "\${KARMA_USER_HOME}/.claude_karma"
chown -R "\${KARMA_USER}:" "\${KARMA_USER_HOME}/.claude_karma" 2>/dev/null || true

if [ ! -f /tmp/claude-code-karma-api.pid ] || ! kill -0 "\$(cat /tmp/claude-code-karma-api.pid)" 2>/dev/null; then
	(
		cd "\${KARMA_HOME}/api"
		export CLAUDE_KARMA_CLAUDE_BASE="\${KARMA_USER_HOME}/.claude"
		export CLAUDE_KARMA_CORS_ORIGINS="[\"http://localhost:\${FRONTEND_PORT}\",\"http://127.0.0.1:\${FRONTEND_PORT}\"]"
		exec "\${KARMA_HOME}/api/.venv/bin/uvicorn" main:app --host 0.0.0.0 --port "\${API_PORT}"
	) >>"\${API_LOG}" 2>&1 &
	echo \$! > /tmp/claude-code-karma-api.pid
	echo "[claude-code-karma] API started on port \${API_PORT}"
else
	echo "[claude-code-karma] API already running"
fi

if [ ! -f /tmp/claude-code-karma-frontend.pid ] || ! kill -0 "\$(cat /tmp/claude-code-karma-frontend.pid)" 2>/dev/null; then
	(
		cd "\${KARMA_HOME}/frontend"
		export HOST=0.0.0.0
		export PORT="\${FRONTEND_PORT}"
		exec node build/index.js
	) >>"\${FRONTEND_LOG}" 2>&1 &
	echo \$! > /tmp/claude-code-karma-frontend.pid
	echo "[claude-code-karma] Frontend started on port \${FRONTEND_PORT}"
else
	echo "[claude-code-karma] Frontend already running"
fi
EOF
	chmod +x /usr/local/devcontainer-poststart.d/44-claude-code-karma.sh
	echo "[claude-code-karma] Post-start hook installed"
else
	echo "[claude-code-karma] Autostart disabled"
fi

echo "[claude-code-karma] Installation complete"
echo "  Dashboard: http://localhost:${FRONTEND_PORT}"
echo "  API:       http://localhost:${API_PORT}"
echo "  Settings: read-only; CodeForge owns ~/.claude/settings.json"
