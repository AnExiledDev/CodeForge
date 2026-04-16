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

# Hook gate — check ~/.claude/disabled-hooks.json
_dh = os.path.join(os.path.expanduser("~"), ".claude", "disabled-hooks.json")
if os.path.exists(_dh):
    with open(_dh) as _f:
        if os.path.basename(__file__).replace(".py", "") in json.load(_f).get("disabled", []):
            sys.exit(0)

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


def get_stable_scope_root(session_id: str | None) -> str:
    """Return the persisted scope root, computing and caching on first call.

    Shares the same temp file as guard-workspace-scope.py so both scripts
    agree on the scope root for a given session.
    """
    tmp_path = f"/tmp/claude-scope-root-{session_id}" if session_id else None

    if tmp_path:
        try:
            with open(tmp_path, "r") as f:
                cached = f.read().strip()
            if cached:
                return cached
        except FileNotFoundError:
            pass

    # First invocation (or no session_id): compute from actual CWD
    cwd = os.path.realpath(os.getcwd())
    scope_root = resolve_scope_root(cwd)

    if tmp_path:
        try:
            with open(tmp_path, "w") as f:
                f.write(scope_root)
        except OSError:
            pass  # Best-effort; fall back to computed value

    return scope_root


def main():
    cwd = os.path.realpath(os.getcwd())
    try:
        input_data = json.load(sys.stdin)
        # Some hook events provide cwd override
        cwd = os.path.realpath(input_data.get("cwd", cwd))
        hook_event = input_data.get("hook_event_name", "PreToolUse")
        session_id = input_data.get("session_id")
    except (json.JSONDecodeError, ValueError):
        hook_event = "PreToolUse"
        session_id = None

    scope_root = get_stable_scope_root(session_id)

    context = (
        f"Working Directory: {scope_root} — restrict all file operations to this directory unless explicitly instructed otherwise.\n"
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
