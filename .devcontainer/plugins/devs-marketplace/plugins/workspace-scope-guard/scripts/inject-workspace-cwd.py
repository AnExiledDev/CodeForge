#!/usr/bin/env python3
"""
CWD context injector — injects working directory into Claude's context
on every session start, user prompt, tool call, and subagent spawn.

Worktree-aware: when CWD is inside .claude/worktrees/, injects the project
root as the scope boundary instead of the worktree-specific path.

Fires on: SessionStart, UserPromptSubmit, PreToolUse, SubagentStart
Always exits 0 (advisory, never blocking).
"""

import json
import os
import sys

# Must match the segment used in guard-workspace-scope.py
_WORKTREE_SEGMENT = "/.claude/worktrees/"


def resolve_scope_root(cwd: str) -> str:
    """Resolve CWD to project root when inside a worktree."""
    idx = cwd.find(_WORKTREE_SEGMENT)
    if idx != -1:
        return cwd[:idx]
    return cwd


def main():
    cwd = os.path.realpath(os.getcwd())
    try:
        input_data = json.load(sys.stdin)
        # Some hook events provide cwd override
        cwd = os.path.realpath(input_data.get("cwd", cwd))
        hook_event = input_data.get("hook_event_name", "PreToolUse")
    except (json.JSONDecodeError, ValueError):
        hook_event = "PreToolUse"

    scope_root = resolve_scope_root(cwd)

    context = (
        f"Working Directory: {cwd} — restrict all file operations to this directory unless explicitly instructed otherwise.\n"
        f"All file operations and commands MUST target paths within {scope_root}. "
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
