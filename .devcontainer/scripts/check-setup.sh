#!/bin/bash
# Verify CodeForge setup is working correctly
# Run anytime with: check-setup

echo "CodeForge Setup Check"
echo "━━━━━━━━━━━━━━━━━━━━"

PASS=0
FAIL=0
WARN=0

check() {
	local label="$1" cmd="$2"
	if eval "$cmd" >/dev/null 2>&1; then
		printf "  ✓ %s\n" "$label"
		PASS=$((PASS + 1))
	else
		printf "  ✗ %s\n" "$label"
		FAIL=$((FAIL + 1))
	fi
}

warn_check() {
	local label="$1" cmd="$2"
	if eval "$cmd" >/dev/null 2>&1; then
		printf "  ✓ %s\n" "$label"
		PASS=$((PASS + 1))
	else
		printf "  ⚠ %s\n" "$label"
		WARN=$((WARN + 1))
	fi
}

echo ""
echo "Core:"
check "Claude Code installed" "command -v claude"
warn_check "Claude native binary" "[ -x /usr/local/bin/claude ]"
check "cc alias configured" "grep -q 'alias cc=' ~/.bashrc 2>/dev/null || grep -q 'alias cc=' ~/.zshrc 2>/dev/null"
check "Config directory exists" "[ -d '${CLAUDE_CONFIG_DIR:-/workspaces/.claude}' ]"
check "Settings file exists" "[ -f '${CLAUDE_CONFIG_DIR:-/workspaces/.claude}/settings.json' ]"

echo ""
echo "Authentication:"
warn_check "GitHub CLI authenticated" "gh auth status"
warn_check "Git user configured" "git config --global user.name"

echo ""
echo "Tools:"
check "Node.js" "command -v node"
check "Python" "command -v python3"
check "uv" "command -v uv"
warn_check "Go" "command -v go"
warn_check "Bun" "command -v bun"
warn_check "Docker" "command -v docker"

echo ""
echo "Development:"
warn_check "biome" "command -v biome"
warn_check "ruff" "command -v ruff"
warn_check "ast-grep" "command -v ast-grep"
warn_check "tmux" "command -v tmux"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━"
echo "  $PASS passed, $FAIL failed, $WARN warnings"

if [ $FAIL -gt 0 ]; then
	echo ""
	echo "  Run 'cc-tools' for detailed version info."
	exit 1
fi
