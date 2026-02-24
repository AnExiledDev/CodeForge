#!/bin/bash
# Configure Git (GitHub CLI) and NPM authentication from .secrets file or environment variables.
# Environment variables override .secrets values, supporting Codespaces secrets and localEnv.
# Auth failure should not block other setup steps, so set -e is intentionally omitted.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEVCONTAINER_DIR="$(dirname "$SCRIPT_DIR")"
SECRETS_FILE="$DEVCONTAINER_DIR/.secrets"

# Source .secrets file if it exists (env vars take precedence via :- defaults below)
if [ -f "$SECRETS_FILE" ]; then
    echo "[setup-auth] Loading tokens from .secrets file"
    set -a
    source "$SECRETS_FILE"
    set +a
else
    echo "[setup-auth] No .secrets file found, using environment variables only"
fi

AUTH_CONFIGURED=false

# --- GitHub CLI auth ---
if [ -n "$GH_TOKEN" ]; then
    echo "[setup-auth] Authenticating GitHub CLI..."
    # Capture token value then unset env var — gh refuses --with-token when
    # GH_TOKEN is already exported (it says "use the env var instead").
    _gh_token="$GH_TOKEN"
    unset GH_TOKEN
    if gh auth login --with-token <<< "$_gh_token" 2>/dev/null; then
        echo "[setup-auth] GitHub CLI authenticated"
        gh auth setup-git 2>/dev/null && echo "[setup-auth] Git credential helper configured"
        AUTH_CONFIGURED=true
    else
        echo "[setup-auth] WARNING: GitHub CLI authentication failed"
    fi
    unset _gh_token
else
    echo "[setup-auth] GH_TOKEN not set, skipping GitHub CLI auth"
fi

# --- Git user config ---
if [ -n "$GH_USERNAME" ]; then
    git config --global user.name "$GH_USERNAME"
    echo "[setup-auth] Git user.name set to $GH_USERNAME"
    unset GH_USERNAME
fi

if [ -n "$GH_EMAIL" ]; then
    git config --global user.email "$GH_EMAIL"
    echo "[setup-auth] Git user.email set to $GH_EMAIL"
    unset GH_EMAIL
fi

# --- NPM auth ---
if [ -n "$NPM_TOKEN" ]; then
    echo "[setup-auth] Configuring NPM registry auth..."
    if npm config set "//registry.npmjs.org/:_authToken=$NPM_TOKEN" 2>/dev/null; then
        echo "[setup-auth] NPM auth token configured"
        AUTH_CONFIGURED=true
    else
        echo "[setup-auth] WARNING: NPM auth configuration failed"
    fi
    unset NPM_TOKEN
else
    echo "[setup-auth] NPM_TOKEN not set, skipping NPM auth"
fi

# --- Claude auth token (from 'claude setup-token') ---
# Long-lived tokens only — generated via: claude setup-token
# Note: After unset, the token remains visible in /proc/<pid>/environ for the
# lifetime of this process. This is a platform limitation of environment variables.
CLAUDE_CRED_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
CLAUDE_CRED_FILE="$CLAUDE_CRED_DIR/.credentials.json"
if [ -n "$CLAUDE_AUTH_TOKEN" ]; then
    # Validate token format (claude setup-token produces sk-ant-* tokens)
    if [[ ! "$CLAUDE_AUTH_TOKEN" =~ ^sk-ant- ]]; then
        echo "[setup-auth] WARNING: CLAUDE_AUTH_TOKEN doesn't match expected format (sk-ant-*), skipping"
    elif [ -f "$CLAUDE_CRED_FILE" ]; then
        echo "[setup-auth] .credentials.json already exists, skipping token injection"
        # Verify permissions haven't been tampered with
        perms=$(stat -c %a "$CLAUDE_CRED_FILE" 2>/dev/null)
        if [ -n "$perms" ] && [ "$perms" != "600" ]; then
            echo "[setup-auth] WARNING: .credentials.json has permissions $perms (expected 600), fixing"
            chmod 600 "$CLAUDE_CRED_FILE"
        fi
    else
        echo "[setup-auth] Creating .credentials.json from CLAUDE_AUTH_TOKEN..."
        mkdir -p "$CLAUDE_CRED_DIR"
        # Write credentials with restrictive permissions from the start (no race window).
        # Uses printf '%s' to avoid shell expansion of token value (defense against
        # metacharacters in the token string — backticks, $(), quotes).
        ( umask 077; printf '{\n  "claudeAiOauth": {\n    "accessToken": "%s",\n    "refreshToken": "%s",\n    "expiresAt": 9999999999999,\n    "scopes": ["user:inference", "user:profile"]\n  }\n}\n' "$CLAUDE_AUTH_TOKEN" "$CLAUDE_AUTH_TOKEN" > "$CLAUDE_CRED_FILE" )
        echo "[setup-auth] Claude auth token configured"
        AUTH_CONFIGURED=true
    fi
    unset CLAUDE_AUTH_TOKEN
else
    echo "[setup-auth] CLAUDE_AUTH_TOKEN not set, skipping Claude auth"
fi

# --- Summary ---
if [ "$AUTH_CONFIGURED" = true ]; then
    echo "[setup-auth] Auth configuration complete"
else
    echo "[setup-auth] No tokens provided — auth configuration skipped"
    echo "[setup-auth] To configure, copy .secrets.example to .secrets and fill in your tokens"
fi
