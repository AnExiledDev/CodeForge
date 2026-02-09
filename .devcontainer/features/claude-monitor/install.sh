#!/bin/bash
set -euo pipefail

# ==============================
# Claude Monitor DevContainer Feature
# ABSOLUTE, PATH-INDEPENDENT
# ==============================

MONITOR_VERSION="${VERSION:-latest}"
INSTALLER="${INSTALLER:-uv}"
USERNAME="${USERNAME:-automatic}"

# Skip installation if version is "none"
if [ "${MONITOR_VERSION}" = "none" ]; then
    echo "[claude-monitor] Skipping installation (version=none)"
    exit 0
fi

echo "[claude-monitor] Starting installation..."

# ---------- USER ----------
if [[ "${USERNAME}" == "auto" || "${USERNAME}" == "automatic" ]]; then
    for u in vscode node codespace; do
        if id -u "$u" >/dev/null 2>&1; then
            USERNAME="$u"
            break
        fi
    done
    USERNAME="${USERNAME:-root}"
fi

USER_HOME="$(eval echo "~${USERNAME}")"

echo "[claude-monitor] Target user: ${USERNAME}"
echo "[claude-monitor] Home: ${USER_HOME}"
echo "[claude-monitor] Installer: ${INSTALLER}"

fail() {
    echo "[claude-monitor] ERROR: $1" >&2
    exit 1
}

run_as_user() {
    sudo -u "${USERNAME}" env \
        HOME="${USER_HOME}" \
        "$@"
}

# ---------- UV DISCOVERY (THE IMPORTANT PART) ----------
find_uv() {
    # 1. PATH (if lucky)
    command -v uv 2>/dev/null && return 0
    command -v uvx 2>/dev/null && return 0

    # 2. Known devcontainer locations
    for p in \
        /usr/local/bin/uv \
        /usr/bin/uv \
        /opt/uv/bin/uv \
        /usr/local/bin/uvx \
        /usr/bin/uvx \
        /opt/uv/bin/uvx
    do
        [[ -x "$p" ]] && echo "$p" && return 0
    done

    # 3. Last resort: shallow filesystem scan (bounded, safe)
    find /usr /opt -maxdepth 4 -type f \( -name uv -o -name uvx \) -executable 2>/dev/null | head -n 1
}

# ---------- INSTALL ----------
case "${INSTALLER}" in
    uv)
        UV_BIN="$(find_uv || true)"
        [[ -n "${UV_BIN}" ]] || fail "uv is not installed (devcontainer uv feature missing or broken)"

        echo "[claude-monitor] Using uv at: ${UV_BIN}"

        if [[ "${MONITOR_VERSION}" == "latest" ]]; then
            run_as_user "${UV_BIN}" tool install claude-monitor
        else
            run_as_user "${UV_BIN}" tool install "claude-monitor==${MONITOR_VERSION}"
        fi
        ;;
    *)
        fail "Only uv is supported in this feature. Use the uv devcontainer feature."
        ;;
esac

# === VERIFICATION ===
echo "[claude-monitor] Verifying installation..."

BIN_DIR="${USER_HOME}/.local/bin"

if [ -x "${BIN_DIR}/claude-monitor" ]; then
    INSTALLED_VERSION="$("${BIN_DIR}/claude-monitor" --version 2>/dev/null || echo "unknown")"
    echo "[claude-monitor] ✓ claude-monitor installed (${INSTALLED_VERSION})"
elif [ -x "${BIN_DIR}/cmonitor" ]; then
    INSTALLED_VERSION="$("${BIN_DIR}/cmonitor" --version 2>/dev/null || echo "unknown")"
    echo "[claude-monitor] ✓ cmonitor installed (${INSTALLED_VERSION})"
else
    echo "[claude-monitor] ERROR: Executable not found in ${BIN_DIR}"
    ls -la "${BIN_DIR}" || true
    exit 1
fi
