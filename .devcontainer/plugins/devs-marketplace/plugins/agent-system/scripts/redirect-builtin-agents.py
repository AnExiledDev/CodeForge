#!/usr/bin/env python3
"""
Redirect built-in agents - PreToolUse hook for Task tool.

Intercepts Task tool calls and transparently redirects built-in agent
types to enhanced custom agents defined in the agent-system plugin.

Handles three cases:
- Built-in name (e.g. "claude-code-guide") → qualified custom name
- Unqualified custom name (e.g. "claude-guide") → qualified custom name
- Already-qualified name (e.g. "agent-system:claude-guide") → passthrough

The redirect preserves the original prompt — only the subagent_type
is changed. Model selection is left to the custom agent's YAML config.

Reads tool input from stdin (JSON). Returns JSON on stdout.
Exit 0: No redirect needed (passthrough) or redirect applied (with JSON output)
"""

import json
import os
import sys
from datetime import datetime, timezone

# Built-in agent type → custom agent name mapping
REDIRECT_MAP = {
    "Explore": "explorer",
    "Plan": "architect",
    "general-purpose": "generalist",
    "Bash": "bash-exec",
    "claude-code-guide": "claude-guide",
    "statusline-setup": "statusline-config",
}

# Plugin name prefix for fully-qualified agent references
PLUGIN_PREFIX = "agent-system"

# Unqualified custom name → fully-qualified custom name
# Handles cases where the model uses the short name directly
UNQUALIFIED_MAP = {v: f"{PLUGIN_PREFIX}:{v}" for v in REDIRECT_MAP.values()}

LOG_FILE = os.environ.get("AGENT_REDIRECT_LOG", "/tmp/agent-redirect.log")


def log(message: str) -> None:
    """Append a timestamped log entry if logging is enabled."""
    if not LOG_FILE:
        return
    try:
        with open(LOG_FILE, "a") as f:
            ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
            f.write(f"[{ts}] {message}\n")
    except OSError:
        pass


def main() -> None:
    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    tool_input = input_data.get("tool_input", {})
    subagent_type = tool_input.get("subagent_type", "")

    if subagent_type in REDIRECT_MAP:
        target = REDIRECT_MAP[subagent_type]
        qualified_name = f"{PLUGIN_PREFIX}:{target}"
    elif subagent_type in UNQUALIFIED_MAP:
        qualified_name = UNQUALIFIED_MAP[subagent_type]
    else:
        sys.exit(0)

    log(f"{subagent_type} → {qualified_name}")

    # Include all original fields in updatedInput — Claude Code may replace
    # rather than merge, so we must preserve prompt, description, etc.
    updated = {**tool_input, "subagent_type": qualified_name}

    response = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "allow",
            "permissionDecisionReason": f"Redirected {subagent_type} to {qualified_name}",
            "updatedInput": updated,
        }
    }

    json.dump(response, sys.stdout)
    sys.exit(0)


if __name__ == "__main__":
    main()
