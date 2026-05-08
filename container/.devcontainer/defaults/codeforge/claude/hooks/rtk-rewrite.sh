#!/bin/bash
# RTK PreToolUse hook for Claude Code
# Rewrites supported Bash commands to use RTK compression proxy.
#
# Behavior:
#   - Intercepts Bash tool calls
#   - Rewrites supported commands by prepending "rtk"
#   - By default, does NOT auto-allow (lets normal permission flow handle it)
#   - Set RTK_AUTO_ALLOW=1 to restore upstream auto-allow behavior
#
# Requires: jq

set -euo pipefail

# Read hook input from stdin
INPUT=$(cat)

# Extract tool name and command
TOOL_NAME=$(echo "${INPUT}" | jq -r '.tool_name // empty')
COMMAND=$(echo "${INPUT}" | jq -r '.tool_input.command // empty')

# Only process Bash tool calls
if [ "${TOOL_NAME}" != "Bash" ] || [ -z "${COMMAND}" ]; then
	echo '{}'
	exit 0
fi

# Skip if rtk is not installed
if ! command -v rtk >/dev/null 2>&1; then
	echo '{}'
	exit 0
fi

# Skip if command already uses rtk
if echo "${COMMAND}" | grep -qE '^\s*rtk\s'; then
	echo '{}'
	exit 0
fi

# RTK-supported command prefixes
# Reference: https://github.com/rtk-ai/rtk#supported-commands
RTK_COMMANDS=(
	git npm npx yarn pnpm bun bunx cargo rustup pip pip3 uv uvx
	python python3 node deno go docker kubectl helm terraform
	aws gcloud az make cmake gradle mvn ant
	cat ls find grep rg fd tree file wc du df
	curl wget http httpie
	jq yq sed awk cut sort uniq head tail
	ps top htop free uptime who w id env printenv
	ping traceroute dig nslookup host ss netstat
	tar zip unzip gzip gunzip
	diff patch
	pytest jest vitest mocha
	eslint prettier biome ruff mypy pyright tsc
	gh
)

# Extract the base command (first word, ignoring env vars and leading whitespace)
BASE_CMD=$(echo "${COMMAND}" | sed -E 's/^[[:space:]]*//' | sed -E 's/^([A-Z_]+=[^ ]+ )*//' | awk '{print $1}')

# Check if it's a supported command
SUPPORTED=false
for cmd in "${RTK_COMMANDS[@]}"; do
	if [ "${BASE_CMD}" = "${cmd}" ]; then
		SUPPORTED=true
		break
	fi
done

if [ "${SUPPORTED}" != "true" ]; then
	echo '{}'
	exit 0
fi

# Rewrite the command by prepending rtk
REWRITTEN="rtk ${COMMAND}"

# Build response
if [ "${RTK_AUTO_ALLOW:-0}" = "1" ]; then
	# Auto-allow mode: skip permission prompt for rewritten commands
	jq -n \
		--arg cmd "${REWRITTEN}" \
		'{
			"updatedInput": {"command": $cmd},
			"permissionDecision": "allow",
			"permissionDecisionReason": "RTK auto-rewrite (RTK_AUTO_ALLOW=1)"
		}'
else
	# Default: rewrite only, let normal permission flow handle approval
	jq -n \
		--arg cmd "${REWRITTEN}" \
		'{"updatedInput": {"command": $cmd}}'
fi
