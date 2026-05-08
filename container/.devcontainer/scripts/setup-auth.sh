#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (c) 2026 Marcus Krueger
# Configure authentication from Docker Compose secrets or environment variables.
#
# Secret resolution: env var (Codespaces) → /run/secrets/<name> (Docker Compose) → skip.
# Auth failure should not block other setup steps, so set -e is intentionally omitted.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVCONTAINER_DIR="$(dirname "$SCRIPT_DIR")"
WORKSPACE_ROOT="${WORKSPACE_ROOT:-/workspaces}"
CODEFORGE_DIR="${CODEFORGE_DIR:-${WORKSPACE_ROOT}/.codeforge}"
CONFIG_FILE="${CODEFORGE_DIR}/container.json"

_USERNAME="${SUDO_USER:-${USER:-vscode}}"
_USER_HOME=$(getent passwd "$_USERNAME" 2>/dev/null | cut -d: -f6)
_USER_HOME="${_USER_HOME:-/home/$_USERNAME}"

# --- Secret reader ---
# Reads a secret from env var (Codespaces) or /run/secrets/ (Docker Compose).
# Usage: value=$(read_secret <secret_name> <ENV_VAR_NAME>)
read_secret() {
    local name="$1" env_name="$2"
    if [ -n "${!env_name:-}" ]; then
        printf '%s' "${!env_name}"
        return 0
    fi
    local f="/run/secrets/$name"
    if [ -f "$f" ]; then
        tr -d '\n' < "$f"
        return 0
    fi
    return 1
}

# --- Identity override from container.json ---
jq_val() {
    [ -f "$CONFIG_FILE" ] && jq -r "$1" "$CONFIG_FILE" 2>/dev/null || echo ""
}

AUTH_CONFIGURED=false

# --- Git identity from GitHub API ---
# Derives user.name and user.email from gh CLI or container.json overrides.
# Requires an active gh auth session.
_configure_git_identity() {
    local _identity_name _identity_email _gh_id

    _identity_name=$(jq_val '.identity.name // empty')
    _identity_email=$(jq_val '.identity.email // empty')

    if [ -z "$_identity_name" ]; then
        _identity_name=$(gh api user -q .login 2>/dev/null || true)
    fi
    if [ -z "$_identity_email" ]; then
        _identity_email=$(gh api user/emails -q '.[] | select(.primary) | .email' 2>/dev/null || true)
        if [ -z "$_identity_email" ]; then
            _gh_id=$(gh api user -q .id 2>/dev/null || true)
            if [ -n "$_gh_id" ] && [ -n "$_identity_name" ]; then
                _identity_email="${_gh_id}+${_identity_name}@users.noreply.github.com"
            fi
        fi
    fi

    if [ -n "$_identity_name" ]; then
        git config --global user.name "$_identity_name"
        echo "[setup-auth] Git user.name set to $_identity_name"
    fi
    if [ -n "$_identity_email" ]; then
        git config --global user.email "$_identity_email"
        echo "[setup-auth] Git user.email set to $_identity_email"
    fi
}

# --- GitHub CLI auth ---
if _gh_token=$(read_secret gh_token GH_TOKEN); then
    echo "[setup-auth] Authenticating GitHub CLI..."
    # Unset GH_TOKEN before login — gh refuses --with-token when GH_TOKEN is exported
    unset GH_TOKEN
    if gh auth login --with-token <<< "$_gh_token" 2>/dev/null; then
        echo "[setup-auth] GitHub CLI authenticated"
        AUTH_CONFIGURED=true
        _configure_git_identity
    else
        echo "[setup-auth] WARNING: GitHub CLI authentication failed"
    fi
    unset _gh_token
elif gh auth status &>/dev/null; then
    # No token secret provided, but gh is already authenticated from a previous
    # manual `gh auth login` (credentials persisted via Docker named volume).
    echo "[setup-auth] GitHub CLI already authenticated (persisted credentials)"
    AUTH_CONFIGURED=true
    _configure_git_identity
else
    echo "[setup-auth] GH_TOKEN not set and no persisted login, skipping GitHub CLI auth"
fi

# Always configure git credential helper — works with or without active login.
# This ensures manual `gh auth login` works immediately for git operations.
gh auth setup-git 2>/dev/null && echo "[setup-auth] Git credential helper configured"

# --- NPM auth ---
if _npm_token=$(read_secret npm_token NPM_TOKEN); then
    echo "[setup-auth] Configuring NPM registry auth..."
    if npm config set "//registry.npmjs.org/:_authToken=$_npm_token" 2>/dev/null; then
        echo "[setup-auth] NPM auth token configured"
        AUTH_CONFIGURED=true
    else
        echo "[setup-auth] WARNING: NPM auth configuration failed"
    fi
    unset _npm_token
else
    echo "[setup-auth] NPM_TOKEN not set, skipping NPM auth"
fi

# --- Claude Code OAuth token ---
# CLAUDE_CODE_OAUTH_TOKEN is Claude Code's native env var for headless/CI auth.
# WARNING: CLAUDE_CODE_OAUTH_TOKEN does not work when ANTHROPIC_API_KEY is set.
if _claude_token=$(read_secret claude_code_oauth_token CLAUDE_CODE_OAUTH_TOKEN); then
    echo "[setup-auth] Configuring Claude Code OAuth token..."

    for rc in "${_USER_HOME}/.bashrc" "${_USER_HOME}/.zshrc"; do
        [ -f "$rc" ] || continue
        grep -q "export CLAUDE_CODE_OAUTH_TOKEN=" "$rc" 2>/dev/null || \
            printf 'export CLAUDE_CODE_OAUTH_TOKEN=%q\n' "$_claude_token" >> "$rc"
    done

    # Claude Code documents CLAUDE_CODE_OAUTH_TOKEN for setup-token auth, but
    # some Linux/container first-run paths do not honor it reliably. Also write
    # the same token to the native Linux credential file shape.
    _CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-${_USER_HOME}/.claude}"
    _CLAUDE_CREDENTIALS_FILE="${_CLAUDE_DIR}/.credentials.json"
    _CLAUDE_EXPIRES_AT="$(($(date +%s) * 1000 + 365 * 24 * 60 * 60 * 1000))"
    if command -v jq >/dev/null 2>&1; then
        ( umask 077; mkdir -p "$_CLAUDE_DIR" )
        _CLAUDE_CREDENTIALS_TMP="$(mktemp)"
        if [ -f "$_CLAUDE_CREDENTIALS_FILE" ] && jq empty "$_CLAUDE_CREDENTIALS_FILE" 2>/dev/null; then
            jq \
                --arg token "$_claude_token" \
                --argjson expiresAt "$_CLAUDE_EXPIRES_AT" \
                '.claudeAiOauth = ((.claudeAiOauth // {}) + {
                    accessToken: $token,
                    refreshToken: (.claudeAiOauth.refreshToken // ""),
                    expiresAt: $expiresAt,
                    scopes: (.claudeAiOauth.scopes // ["user:inference", "user:profile", "user:sessions:claude_code"])
                })' \
                "$_CLAUDE_CREDENTIALS_FILE" > "$_CLAUDE_CREDENTIALS_TMP"
        else
            jq -n \
                --arg token "$_claude_token" \
                --argjson expiresAt "$_CLAUDE_EXPIRES_AT" \
                '{
                    claudeAiOauth: {
                        accessToken: $token,
                        refreshToken: "",
                        expiresAt: $expiresAt,
                        scopes: ["user:inference", "user:profile", "user:sessions:claude_code"]
                    }
                }' > "$_CLAUDE_CREDENTIALS_TMP"
        fi
        install -m 600 "$_CLAUDE_CREDENTIALS_TMP" "$_CLAUDE_CREDENTIALS_FILE"
        rm -f "$_CLAUDE_CREDENTIALS_TMP"
        chown "$_USERNAME:$_USERNAME" "$_CLAUDE_CREDENTIALS_FILE" 2>/dev/null || true
        echo "[setup-auth] Claude Code credentials file configured"
    else
        echo "[setup-auth] WARNING: jq not found; skipped Claude Code credentials file"
    fi
    unset _CLAUDE_DIR _CLAUDE_CREDENTIALS_FILE _CLAUDE_CREDENTIALS_TMP _CLAUDE_EXPIRES_AT

    echo "[setup-auth] CLAUDE_CODE_OAUTH_TOKEN configured"
    AUTH_CONFIGURED=true

    # Check for ANTHROPIC_API_KEY conflict
    if _anthropic_key=$(read_secret anthropic_api_key ANTHROPIC_API_KEY 2>/dev/null); then
        echo "[setup-auth] WARNING: Both CLAUDE_CODE_OAUTH_TOKEN and ANTHROPIC_API_KEY are set."
        echo "[setup-auth]   CLAUDE_CODE_OAUTH_TOKEN will not work when ANTHROPIC_API_KEY is present."
        echo "[setup-auth]   Remove the anthropic_api_key secret if you want OAuth token auth."
    fi
    unset _claude_token
else
    echo "[setup-auth] CLAUDE_CODE_OAUTH_TOKEN not set, skipping Claude auth"
fi
unset _anthropic_key

# --- OpenAI Codex auth (API key) ---
_CODEX_DIR="${CODEX_HOME:-${_USER_HOME}/.codex}"
_CODEX_AUTH_FILE="$_CODEX_DIR/auth.json"
if _openai_key=$(read_secret openai_api_key OPENAI_API_KEY); then
    if [ -f "$_CODEX_AUTH_FILE" ]; then
        echo "[setup-auth] Codex auth.json already exists, skipping token injection"
        perms=$(stat -c %a "$_CODEX_AUTH_FILE" 2>/dev/null)
        if [ -n "$perms" ] && [ "$perms" != "600" ]; then
            echo "[setup-auth] WARNING: Codex auth.json has permissions $perms (expected 600), fixing"
            chmod 600 "$_CODEX_AUTH_FILE"
        fi
        AUTH_CONFIGURED=true
    else
        echo "[setup-auth] Creating Codex auth.json from OPENAI_API_KEY..."
        ( umask 077; mkdir -p "$_CODEX_DIR" )
        if command -v jq >/dev/null 2>&1; then
            ( umask 077; jq -n --arg key "$_openai_key" '{auth_mode: "apikey", OPENAI_API_KEY: $key}' > "$_CODEX_AUTH_FILE" )
        else
            ESCAPED_KEY=$(printf '%s' "$_openai_key" | sed 's/\\/\\\\/g; s/"/\\"/g')
            ( umask 077; printf '{\n  "auth_mode": "apikey",\n  "OPENAI_API_KEY": "%s"\n}\n' "$ESCAPED_KEY" > "$_CODEX_AUTH_FILE" )
        fi
        if [ -f "$_CODEX_AUTH_FILE" ]; then
            echo "[setup-auth] Codex API key configured"
            AUTH_CONFIGURED=true
        else
            echo "[setup-auth] WARNING: Failed to write Codex auth.json — check permissions on $_CODEX_DIR"
        fi
    fi
    unset _openai_key ESCAPED_KEY
else
    echo "[setup-auth] OPENAI_API_KEY not set, skipping Codex auth"
fi

# --- Claude Code Router provider keys ---
# CCR reads env vars at runtime via $ENV_VAR interpolation in config.json.
# Keys must persist as env vars in shell rc files.
_CCR_KEY_CONFIGURED=false
for _CCR_VAR in ANTHROPIC_API_KEY DEEPSEEK_API_KEY GEMINI_API_KEY OPENROUTER_API_KEY; do
    _secret_name=$(echo "$_CCR_VAR" | tr '[:upper:]' '[:lower:]')
    if _ccr_val=$(read_secret "$_secret_name" "$_CCR_VAR"); then
        for rc in "${_USER_HOME}/.bashrc" "${_USER_HOME}/.zshrc"; do
            [ -f "$rc" ] || continue
            grep -q "export ${_CCR_VAR}=" "$rc" 2>/dev/null || \
                echo "export ${_CCR_VAR}=\"${_ccr_val}\"" >> "$rc"
        done
        echo "[setup-auth] ${_CCR_VAR} configured for claude-code-router"
        _CCR_KEY_CONFIGURED=true
        unset _ccr_val
    fi
done
if [ "$_CCR_KEY_CONFIGURED" = true ]; then
    AUTH_CONFIGURED=true
else
    echo "[setup-auth] No claude-code-router provider keys set"
fi
unset _CCR_VAR _CCR_KEY_CONFIGURED _secret_name

# --- Summary ---
if [ "$AUTH_CONFIGURED" = true ]; then
    echo "[setup-auth] Auth configuration complete"
else
    echo "[setup-auth] No secrets provided — auth configuration skipped"
    echo "[setup-auth] To configure, add secret files to .codeforge/secrets/ (one file per secret)"
fi
