#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
# Pre-flight check: validates a container runtime is available on the host.
# Runs via initializeCommand BEFORE any container build/pull/start.

set -euo pipefail

# --- OS detection ---

detect_os() {
    if [[ -f /proc/version ]] && grep -qi 'microsoft\|wsl' /proc/version 2>/dev/null; then
        echo "wsl"
    elif [[ "$(uname -s)" == "Darwin" ]]; then
        echo "macos"
    else
        echo "linux"
    fi
}

# --- Timeout wrapper (macOS lacks coreutils timeout) ---

run_with_timeout() {
    local seconds="$1"
    shift
    if command -v timeout &>/dev/null; then
        timeout "$seconds" "$@" &>/dev/null 2>&1
    else
        # Fallback for macOS: background + kill
        "$@" &>/dev/null 2>&1 &
        local pid=$!
        (sleep "$seconds" && kill "$pid" 2>/dev/null) &
        local watchdog=$!
        if wait "$pid" 2>/dev/null; then
            kill "$watchdog" 2>/dev/null
            wait "$watchdog" 2>/dev/null
            return 0
        else
            kill "$watchdog" 2>/dev/null
            wait "$watchdog" 2>/dev/null
            return 1
        fi
    fi
}

# --- Runtime detection ---

check_runtime() {
    local runtime="$1"
    if ! command -v "$runtime" &>/dev/null; then
        return 1
    fi
    if run_with_timeout 5 "$runtime" info; then
        return 0
    fi
    return 1
}

# --- Main ---

for runtime in docker podman; do
    if check_runtime "$runtime"; then
        exit 0
    fi
done

# No working runtime found — determine why and advise

found_binary=""
for runtime in docker podman; do
    if command -v "$runtime" &>/dev/null; then
        found_binary="$runtime"
        break
    fi
done

HOST_OS="$(detect_os)"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  CodeForge: Container runtime not available                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

if [[ -n "$found_binary" ]]; then
    echo "  Found '$found_binary' but the daemon is not responding."
    echo ""
    case "$HOST_OS" in
        wsl)
            echo "  Fix: Start Docker Desktop and enable WSL 2 integration:"
            echo "        Settings → Resources → WSL Integration"
            ;;
        macos)
            echo "  Fix: Start Docker Desktop:"
            echo "        open -a Docker"
            ;;
        linux)
            echo "  Fix: Start the Docker daemon:"
            echo "        sudo systemctl start docker"
            ;;
    esac
else
    echo "  No container runtime (docker or podman) found in PATH."
    echo ""
    echo "  Install Docker Desktop:"
    echo "    https://www.docker.com/products/docker-desktop/"
    echo ""
    echo "  Or install Podman:"
    echo "    https://podman.io/getting-started/installation"
fi

echo ""
exit 1
