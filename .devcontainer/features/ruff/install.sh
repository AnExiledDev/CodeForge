#!/bin/bash
set -euo pipefail

# ==============================
# Ruff DevContainer Feature
# Installs via uv tool install
# ==============================

RUFF_VERSION="${VERSION:-latest}"
USERNAME="${USERNAME:-automatic}"

# Skip installation if version is "none"
if [ "${RUFF_VERSION}" = "none" ]; then
    echo "[ruff] Skipping installation (version=none)"
    exit 0
fi

echo "[ruff] Starting installation..."

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

echo "[ruff] Target user: ${USERNAME}"
echo "[ruff] Version: ${RUFF_VERSION}"

run_as_user() {
    sudo -u "${USERNAME}" env \
        HOME="${USER_HOME}" \
        "$@"
}

# ---------- UV DISCOVERY ----------
find_uv() {
    command -v uv 2>/dev/null && return 0
    for p in /usr/local/bin/uv /usr/bin/uv /opt/uv/bin/uv; do
        [[ -x "$p" ]] && echo "$p" && return 0
    done
    find /usr /opt -maxdepth 4 -type f -name uv -executable 2>/dev/null | head -n 1
}

# ---------- INSTALL ----------
UV_BIN="$(find_uv || true)"
if [[ -z "${UV_BIN}" ]]; then
    echo "[ruff] ERROR: uv is not installed" >&2
    exit 1
fi

echo "[ruff] Using uv at: ${UV_BIN}"

if [[ "${RUFF_VERSION}" == "latest" ]]; then
    run_as_user "${UV_BIN}" tool install ruff
else
    run_as_user "${UV_BIN}" tool install "ruff==${RUFF_VERSION}"
fi

# ---------- VERIFY ----------
BIN_DIR="${USER_HOME}/.local/bin"
if [[ -x "${BIN_DIR}/ruff" ]]; then
    INSTALLED="$("${BIN_DIR}/ruff" --version 2>/dev/null || echo "unknown")"
    echo "[ruff] Installed: ${INSTALLED}"
else
    echo "[ruff] ERROR: ruff not found in ${BIN_DIR}" >&2
    exit 1
fi
