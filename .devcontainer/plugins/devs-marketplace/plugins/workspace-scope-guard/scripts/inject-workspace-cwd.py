#!/usr/bin/env python3
"""
CWD context injector — injects working directory into Claude's context
on every session start, user prompt, tool call, and subagent spawn.

Worktree-aware: when CWD is inside .claude/worktrees/, injects the project
root as the scope boundary instead of the worktree-specific path.
Git-root-aware: walks up from CWD to find .git, expanding scope to repository root.

Fires on: SessionStart, UserPromptSubmit, PreToolUse, SubagentStart
Always exits 0 (advisory, never blocking).
"""

import json
import os
import sys

# Must match the segment used in guard-workspace-scope.py
_WORKTREE_SEGMENT = "/.claude/worktrees/"


def resolve_scope_root(cwd: str) -> str:
    """Resolve CWD to the effective scope root.

    Priority:
    1. Worktree detection: if CWD is inside .claude/worktrees/<id>, scope root
       is the project root (parent of .claude/worktrees/).
    2. Git root detection: walk up from CWD looking for .git directory/file.
       Stops at / or /workspaces to prevent scope from escaping the workspace.
    3. Fallback: CWD unchanged (non-git directories).
    """
    # 1. Worktree detection
    idx = cwd.find(_WORKTREE_SEGMENT)
    if idx != -1:
        return cwd[:idx]

    # 2. Git root detection — walk up looking for .git
    current = cwd
    while True:
        if os.path.exists(os.path.join(current, ".git")):
            return current
        parent = os.path.dirname(current)
        # Safety ceiling: stop at filesystem root or /workspaces
        if parent == current or current == "/workspaces":
            break
        current = parent

    # 3. Fallback — no git root found
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
