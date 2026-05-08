#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
set -euo pipefail

# === IMPORT OPTIONS ===
ANALYZER_VERSION="${VERSION:-latest}"
USERNAME="${USERNAME:-automatic}"

# Skip installation if version is "none"
if [ "${ANALYZER_VERSION}" = "none" ]; then
	echo "[claude-session-analyzer] Skipping installation (version=none)"
	exit 0
fi

echo "[claude-session-analyzer] Starting installation..."

# === VALIDATE DEPENDENCIES ===
for cmd in python3 git; do
	if ! command -v "${cmd}" >/dev/null 2>&1; then
		echo "[claude-session-analyzer] ERROR: ${cmd} is required but not found"
		exit 1
	fi
done

# === DETECT USER ===
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

echo "[claude-session-analyzer] Installing for user: ${USERNAME}"

# === GET USER HOME ===
USER_HOME="$(getent passwd "${USERNAME}" | cut -d: -f6)"
if [ -z "${USER_HOME}" ] || [ ! -d "${USER_HOME}" ]; then
	echo "[claude-session-analyzer] ERROR: Home directory not found for user ${USERNAME}"
	exit 1
fi

# === CLONE REPO ===
rm -rf /opt/claude-session-analyzer
git clone https://github.com/lucemia/claude-session-analyzer.git /opt/claude-session-analyzer/

# Checkout specific ref if not "latest"
if [ "${ANALYZER_VERSION}" != "latest" ]; then
	git -C /opt/claude-session-analyzer checkout --detach "${ANALYZER_VERSION}"
fi

# === CREATE WRAPPER SCRIPT ===
cat > /usr/local/bin/analyze-sessions <<'EOF'
#!/bin/bash
exec python3 /opt/claude-session-analyzer/analyze_sessions.py "$@"
EOF
chmod +x /usr/local/bin/analyze-sessions

# === SET OWNERSHIP ===
chown -R "${USERNAME}:" /opt/claude-session-analyzer

# === VERIFICATION ===
echo "[claude-session-analyzer] Verifying installation..."
if analyze-sessions --help >/dev/null 2>&1; then
	echo "[claude-session-analyzer] ✓ analyze-sessions is accessible"
else
	echo "[claude-session-analyzer] WARNING: Could not verify analyze-sessions"
	echo "  The tool uses Python stdlib only — check python3 availability"
	echo "  The wrapper will still work once the repo is accessible"
fi

# === SUMMARY ===
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Claude Session Analyzer Installation Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Configuration:"
echo "  • User: ${USERNAME}"
echo "  • Version: ${ANALYZER_VERSION}"
echo ""
echo "Usage:"
echo "  analyze-sessions ~/.claude/projects/ --start 2026-01-01"
echo "  analyze-sessions --help"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
