#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
set -euo pipefail

# === IMPORT OPTIONS ===
# NOTE: DevContainer converts camelCase options to UPPERCASE without underscores
# "version" → VERSION, "cronInterval" → CRONINTERVAL, "username" → USERNAME
LAMARCK_VERSION="${VERSION:-latest}"
CRONINTERVAL="${CRONINTERVAL:-4h}"
USERNAME="${USERNAME:-automatic}"

# Skip installation if version is "none"
if [ "${LAMARCK_VERSION}" = "none" ]; then
    echo "[lamarck] Skipping installation (version=none)"
    exit 0
fi

echo "[lamarck] Starting lamarck installation..."

# === SOURCE NVM ===
# Node is installed via NVM by the node feature
if [ -f /usr/local/share/nvm/nvm.sh ]; then
    source /usr/local/share/nvm/nvm.sh
fi

# === VALIDATE DEPENDENCIES ===
if ! command -v npm &>/dev/null; then
    echo "[lamarck] ERROR: npm is not available"
    echo "  Ensure node feature is installed first"
    echo "  NVM path: /usr/local/share/nvm/nvm.sh"
    exit 1
fi

# === DETECT USER ===
if [ "${USERNAME}" = "auto" ] || [ "${USERNAME}" = "automatic" ]; then
    USERNAME=""
    for CURRENT_USER in vscode node codespace; do
        if id -u "${CURRENT_USER}" >/dev/null 2>&1; then
            USERNAME=${CURRENT_USER}
            break
        fi
    done
    [ -z "${USERNAME}" ] && USERNAME=root
elif [ "${USERNAME}" = "none" ] || ! id -u "${USERNAME}" >/dev/null 2>&1; then
    USERNAME=root
fi

echo "[lamarck] Installing for user: ${USERNAME}"

# === GET USER HOME ===
USER_HOME=$(getent passwd "${USERNAME}" | cut -d: -f6)
if [ ! -d "${USER_HOME}" ]; then
    echo "[lamarck] ERROR: Home directory not found for user ${USERNAME}"
    exit 1
fi

# === INSTALL ===
echo "[lamarck] Installing lamarck@${LAMARCK_VERSION} globally..."
npm install -g "lamarck@${LAMARCK_VERSION}"

# === VERIFY ===
if lamarck --help &>/dev/null; then
    echo "[lamarck] Verified: lamarck is available"
else
    echo "[lamarck] WARNING: Could not verify lamarck installation"
    echo "  'lamarck --help' did not succeed"
    echo "  The tool may still work once PATH is configured"
fi

# === INSTALL CRON ===
apt-get update && apt-get install -y --no-install-recommends cron

# === CREATE STATE DIRECTORY ===
mkdir -p "${USER_HOME}/.lamarck"
chown "${USERNAME}:" "${USER_HOME}/.lamarck"

# === SET UP CRONTAB ===
if [ "${CRONINTERVAL}" != "disabled" ]; then
    case "${CRONINTERVAL}" in
        2h)  CRON_SCHEDULE="0 */2 * * *" ;;
        4h)  CRON_SCHEDULE="0 */4 * * *" ;;
        6h)  CRON_SCHEDULE="0 */6 * * *" ;;
        12h) CRON_SCHEDULE="0 */12 * * *" ;;
        *)
            echo "[lamarck] ERROR: Invalid cronInterval: ${CRONINTERVAL}"
            exit 1
            ;;
    esac

    echo "${CRON_SCHEDULE} ${USERNAME} . /usr/local/share/nvm/nvm.sh && lamarck --project /workspaces >> /tmp/lamarck.log 2>&1" > /etc/cron.d/lamarck
    chmod 0644 /etc/cron.d/lamarck
    echo "[lamarck] Crontab installed: ${CRON_SCHEDULE}"
else
    echo "[lamarck] Cron disabled, skipping crontab setup"
fi

# === POSTSTART SCRIPT ===
mkdir -p /usr/local/devcontainer-poststart.d
cat > /usr/local/devcontainer-poststart.d/46-lamarck-cron.sh <<'EOF'
#!/bin/bash
if ! pgrep -x cron >/dev/null 2>&1; then
  cron
  echo "[lamarck] cron daemon started"
fi
EOF
chmod +x /usr/local/devcontainer-poststart.d/46-lamarck-cron.sh

# === SUMMARY ===
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Lamarck Installation Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Configuration:"
echo "  • User: ${USERNAME}"
echo "  • Version: ${LAMARCK_VERSION}"
echo "  • Cron interval: ${CRONINTERVAL}"
echo ""
echo "Usage:"
echo "  lamarck skill <name> --mode suggest"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
