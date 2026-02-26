#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
set -euo pipefail

# ==============================
# Kitty Terminfo DevContainer Feature
# Installs xterm-kitty terminfo entry
# ==============================

VERSION="${VERSION:-latest}"

# Skip installation if version is "none"
if [ "${VERSION}" = "none" ]; then
    echo "[kitty-terminfo] Skipping installation (version=none)"
    exit 0
fi

echo "[kitty-terminfo] Starting xterm-kitty terminfo installation..."

# ---------- CHECK EXISTING ----------
if infocmp xterm-kitty >/dev/null 2>&1; then
    echo "[kitty-terminfo] xterm-kitty terminfo already installed — skipping"
    exit 0
fi

# ---------- CHECK TIC ----------
if ! command -v tic >/dev/null 2>&1; then
    echo "[kitty-terminfo] Installing ncurses-bin for tic compiler..."
    apt-get update -qq && apt-get install -y -qq ncurses-bin
fi

# ---------- DOWNLOAD ----------
TERMINFO_URL="https://raw.githubusercontent.com/kovidgoyal/kitty/master/terminfo/kitty.terminfo"
TMPFILE="$(mktemp /tmp/kitty-terminfo.XXXXXX)"

cleanup() { rm -f "${TMPFILE}"; }
trap cleanup EXIT

echo "[kitty-terminfo] Downloading kitty terminfo from GitHub..."
if ! curl -fsSL "${TERMINFO_URL}" -o "${TMPFILE}"; then
    echo "[kitty-terminfo] ERROR: Failed to download kitty terminfo" >&2
    exit 1
fi

# ---------- COMPILE ----------
echo "[kitty-terminfo] Compiling terminfo entry..."
if ! tic -x -o /usr/share/terminfo "${TMPFILE}"; then
    echo "[kitty-terminfo] ERROR: Failed to compile terminfo" >&2
    exit 1
fi

# ---------- VERIFY ----------
if infocmp xterm-kitty >/dev/null 2>&1; then
    echo "[kitty-terminfo] ✓ xterm-kitty terminfo installed successfully"
else
    echo "[kitty-terminfo] ERROR: xterm-kitty terminfo not found after install" >&2
    exit 1
fi

# ---------- SUMMARY ----------
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Kitty Terminfo Installation Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Kitty terminal users now get full color and"
echo "  capability support when connecting to this"
echo "  container."
echo ""
echo "  Verify: infocmp xterm-kitty"
echo "  Check:  tput colors (should return 256)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
