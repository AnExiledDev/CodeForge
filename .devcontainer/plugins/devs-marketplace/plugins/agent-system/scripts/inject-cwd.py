#!/usr/bin/env python3
"""
CWD injector — SubagentStart hook that tells subagents the working directory.

Reads hook input from stdin (JSON), extracts cwd, and returns it as
additionalContext so every subagent knows where to scope its work.

Always exits 0 (advisory, never blocking).
"""

import json
import os
import sys


def main():
    cwd = os.getcwd()
    try:
        input_data = json.load(sys.stdin)
        cwd = input_data.get("cwd", cwd)
    except (json.JSONDecodeError, ValueError):
        pass

    json.dump(
        {
            "additionalContext": (
                f"Working Directory: {cwd} — restrict all file operations to "
                f"this directory unless explicitly instructed otherwise."
            )
        },
        sys.stdout,
    )
    sys.exit(0)


if __name__ == "__main__":
    main()
