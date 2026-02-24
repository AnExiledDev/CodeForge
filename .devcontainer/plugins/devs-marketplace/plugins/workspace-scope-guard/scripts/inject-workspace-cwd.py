#!/usr/bin/env python3
"""
CWD context injector — injects working directory into Claude's context
on every session start, user prompt, tool call, and subagent spawn.

Fires on: SessionStart, UserPromptSubmit, PreToolUse, SubagentStart
Always exits 0 (advisory, never blocking).
"""

import json
import os
import sys


def main():
    cwd = os.getcwd()
    try:
        input_data = json.load(sys.stdin)
        # Some hook events provide cwd override
        cwd = input_data.get("cwd", cwd)
        hook_event = input_data.get("hook_event_name", "PreToolUse")
    except (json.JSONDecodeError, ValueError):
        hook_event = "PreToolUse"

    context = (
        f"Working Directory: {cwd}\n"
        f"All file operations and commands MUST target paths within {cwd}. "
        f"Do not read, write, or execute commands against paths outside this directory."
    )

    json.dump(
        {
            "hookSpecificOutput": {
                "hookEventName": hook_event,
                "additionalContext": context,
            }
        },
        sys.stdout,
    )
    sys.exit(0)


if __name__ == "__main__":
    main()
