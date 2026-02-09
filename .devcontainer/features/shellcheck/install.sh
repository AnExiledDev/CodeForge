#!/bin/bash
set -euo pipefail

# ==============================
# ShellCheck DevContainer Feature
# Installed via apt
# ==============================

VERSION="${VERSION:-latest}"

# Skip installation if version is "none"
if [ "${VERSION}" = "none" ]; then
    echo "[shellcheck] Skipping installation (version=none)"
    exit 0
fi

echo "[shellcheck] Starting installation..."

apt-get update -y
apt-get install -y --no-install-recommends shellcheck
apt-get clean -y
rm -rf /var/lib/apt/lists/*

echo "[shellcheck] Installed: $(shellcheck --version 2>/dev/null | head -2 || echo 'unknown')"
