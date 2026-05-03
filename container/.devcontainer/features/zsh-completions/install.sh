#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
# Installs zsh completion stack: fzf, carapace, zsh-autosuggestions,
# zsh-syntax-highlighting, fzf-tab. Sets zsh as default shell.
set -euo pipefail

VERSION="${VERSION:-latest}"
USERNAME="${USERNAME:-automatic}"

# Skip installation if version is "none"
if [ "${VERSION}" = "none" ]; then
    echo "[zsh-completions] Skipping installation (version=none)"
    exit 0
fi

# Resolve username
if [ "${USERNAME}" = "automatic" ] || [ "${USERNAME}" = "auto" ]; then
    if [ -n "${_REMOTE_USER:-}" ]; then
        USERNAME="${_REMOTE_USER}"
    elif [ -n "${_CONTAINER_USER:-}" ]; then
        USERNAME="${_CONTAINER_USER}"
    else
        USERNAME="vscode"
    fi
fi

USER_HOME=$(eval echo "~${USERNAME}")
ZSH_CUSTOM="${USER_HOME}/.oh-my-zsh/custom"

echo "[zsh-completions] Installing completion stack for user: ${USERNAME}"

# ── Install fzf via apt ───────────────────────────────────────────
echo "[zsh-completions] Installing fzf..."
apt-get update -y
apt-get install -y fzf

# ── Install carapace from GitHub releases ─────────────────────────
echo "[zsh-completions] Installing carapace..."
CARAPACE_INSTALLED=false

# Try GitHub releases .deb (most reliable)
CARAPACE_VERSION=$(curl -fsSL https://api.github.com/repos/carapace-sh/carapace-bin/releases/latest 2>/dev/null | grep '"tag_name"' | sed 's/.*"v\(.*\)".*/\1/')
if [ -n "$CARAPACE_VERSION" ]; then
    CARAPACE_DEB_URL="https://github.com/carapace-sh/carapace-bin/releases/download/v${CARAPACE_VERSION}/carapace-bin_${CARAPACE_VERSION}_linux_amd64.deb"
    if curl -fsSL "$CARAPACE_DEB_URL" -o /tmp/carapace.deb; then
        dpkg -i /tmp/carapace.deb
        rm -f /tmp/carapace.deb
        CARAPACE_INSTALLED=true
        echo "[zsh-completions] carapace ${CARAPACE_VERSION} installed via .deb"
    fi
fi

# Fallback: tarball extract
if [ "$CARAPACE_INSTALLED" = false ] && [ -n "$CARAPACE_VERSION" ]; then
    CARAPACE_TAR_URL="https://github.com/carapace-sh/carapace-bin/releases/download/v${CARAPACE_VERSION}/carapace-bin_${CARAPACE_VERSION}_linux_amd64.tar.gz"
    if curl -fsSL "$CARAPACE_TAR_URL" -o /tmp/carapace.tar.gz; then
        tar xzf /tmp/carapace.tar.gz -C /usr/local/bin carapace
        rm -f /tmp/carapace.tar.gz
        CARAPACE_INSTALLED=true
        echo "[zsh-completions] carapace ${CARAPACE_VERSION} installed via tarball"
    fi
fi

if [ "$CARAPACE_INSTALLED" = false ]; then
    echo "[zsh-completions] WARNING: carapace install failed — completions will degrade gracefully"
fi

# ── Clone zsh plugins (shallow, no .git for image size) ───────────
echo "[zsh-completions] Installing zsh plugins..."
mkdir -p "${ZSH_CUSTOM}/plugins"

clone_plugin() {
    local repo="$1"
    local name="$2"
    local target="${ZSH_CUSTOM}/plugins/${name}"

    if [ -d "${target}" ]; then
        echo "[zsh-completions] ${name} already present, skipping"
        return 0
    fi

    echo "[zsh-completions] Cloning ${name}..."
    git clone --depth=1 "https://github.com/${repo}.git" "${target}"
    rm -rf "${target}/.git"
}

clone_plugin "zsh-users/zsh-autosuggestions" "zsh-autosuggestions"
clone_plugin "zsh-users/zsh-syntax-highlighting" "zsh-syntax-highlighting"
clone_plugin "Aloxaf/fzf-tab" "fzf-tab"

# ── Fix ownership ────────────────────────────────────────────────
chown -R "${USERNAME}:${USERNAME}" "${ZSH_CUSTOM}/plugins/"

# ── Set zsh as default shell ──────────────────────────────────────
echo "[zsh-completions] Setting default shell to /usr/bin/zsh for ${USERNAME}..."
chsh -s /usr/bin/zsh "${USERNAME}"

# ── Clean up apt cache ────────────────────────────────────────────
apt-get clean
rm -rf /var/lib/apt/lists/*

echo "[zsh-completions] Installation complete"
echo "  - fzf: $(fzf --version 2>/dev/null || echo 'installed')"
echo "  - carapace: $(carapace --version 2>/dev/null || echo 'not available')"
echo "  - Plugins: zsh-autosuggestions, zsh-syntax-highlighting, fzf-tab"
echo "  - Default shell: /usr/bin/zsh"
