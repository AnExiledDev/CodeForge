#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
set -euo pipefail

# ==============================
# ChromaTerm DevContainer Feature
# Installs ChromaTerm2 via uv tool
# ==============================

CT_VERSION="${VERSION:-latest}"
USERNAME="${USERNAME:-automatic}"

# Skip installation if version is "none"
if [ "${CT_VERSION}" = "none" ]; then
    echo "[chromaterm] Skipping installation (version=none)"
    exit 0
fi

echo "[chromaterm] Starting ChromaTerm2 installation..."

# ---------- USER ----------
if [[ "${USERNAME}" == "auto" || "${USERNAME}" == "automatic" ]]; then
    USERNAME=""
    for u in vscode node codespace; do
        if id -u "$u" >/dev/null 2>&1; then
            USERNAME="$u"
            break
        fi
    done
    USERNAME="${USERNAME:-root}"
fi

USER_HOME="$(eval echo "~${USERNAME}")"

echo "[chromaterm] Target user: ${USERNAME}"
echo "[chromaterm] Version: ${CT_VERSION}"

fail() {
    echo "[chromaterm] ERROR: $1" >&2
    exit 1
}

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
[[ -n "${UV_BIN}" ]] || fail "uv is not installed (devcontainer uv feature missing or broken)"

echo "[chromaterm] Using uv at: ${UV_BIN}"

if [[ "${CT_VERSION}" == "latest" ]]; then
    run_as_user "${UV_BIN}" tool install chromaterm2
else
    run_as_user "${UV_BIN}" tool install "chromaterm2==${CT_VERSION}"
fi

# ---------- DEPLOY DEFAULT CONFIG ----------
CT_CONFIG="${USER_HOME}/.chromaterm.yml"
FEATURE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -f "${CT_CONFIG}" ]; then
    if [ -f "${FEATURE_DIR}/chromaterm.yml" ]; then
        cp "${FEATURE_DIR}/chromaterm.yml" "${CT_CONFIG}"
        chown "${USERNAME}:${USERNAME}" "${CT_CONFIG}" 2>/dev/null || true
        echo "[chromaterm] Deployed default config to ${CT_CONFIG}"
    fi
else
    echo "[chromaterm] Config already exists at ${CT_CONFIG} — not overwriting"
fi

# ---------- VERIFY ----------
BIN_DIR="${USER_HOME}/.local/bin"

if [ -x "${BIN_DIR}/ct" ]; then
    INSTALLED_VERSION="$("${BIN_DIR}/ct" --version 2>/dev/null || echo "unknown")"
    echo "[chromaterm] ✓ ChromaTerm2 installed (${INSTALLED_VERSION})"
else
    echo "[chromaterm] ERROR: ct not found in ${BIN_DIR}" >&2
    ls -la "${BIN_DIR}" 2>/dev/null || true
    exit 1
fi

# ---------- SUMMARY ----------
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ChromaTerm2 Installation Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Configuration:"
echo "  • User: ${USERNAME}"
echo "  • Version: ${CT_VERSION}"
echo "  • Config: ${CT_CONFIG}"
echo ""
echo "Usage:"
echo "  ct <command>              # Wrap any command with colorization"
echo "  echo 'ERROR test' | ct   # Pipe output through ChromaTerm"
echo "  cc / claude               # Auto-wrapped when ct is installed"
echo ""
echo "Edit ~/.chromaterm.yml to customize highlighting rules."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
