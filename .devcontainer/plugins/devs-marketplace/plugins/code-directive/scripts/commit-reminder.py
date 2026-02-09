#!/usr/bin/env python3
"""
Commit reminder — Stop hook that advises about uncommitted changes.

On Stop, checks for uncommitted changes (staged + unstaged) and injects
an advisory reminder as additionalContext. Claude sees it and can
naturally ask the user if they want to commit.

Reads hook input from stdin (JSON). Returns JSON on stdout.
Always exits 0 (advisory, never blocking).
"""

import json
import subprocess
import sys

GIT_CMD_TIMEOUT = 5


def _run_git(args: list[str]) -> str | None:
    """Run a git command and return stdout, or None on any failure."""
    try:
        result = subprocess.run(
            ["git"] + args,
            capture_output=True,
            text=True,
            timeout=GIT_CMD_TIMEOUT,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except (FileNotFoundError, OSError, subprocess.TimeoutExpired):
        pass
    return None


def main():
    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    # Skip if another Stop hook is already blocking
    if input_data.get("stop_hook_active"):
        sys.exit(0)

    # Check if there are any changes at all
    porcelain = _run_git(["status", "--porcelain"])
    if porcelain is None:
        # Not a git repo or git not available
        sys.exit(0)
    if not porcelain.strip():
        # Working tree clean
        sys.exit(0)

    lines = porcelain.strip().splitlines()
    total = len(lines)

    # Count staged vs unstaged
    staged = 0
    unstaged = 0
    for line in lines:
        index_status = line[0:1] if len(line) > 0 else " "
        worktree_status = line[1:2] if len(line) > 1 else " "

        if index_status not in (" ", "?"):
            staged += 1
        if worktree_status not in (" ", "?"):
            unstaged += 1
        if line[0:2] == "??":
            unstaged += 1

    parts = []
    if staged:
        parts.append(f"{staged} staged")
    if unstaged:
        parts.append(f"{unstaged} unstaged")

    summary = ", ".join(parts) if parts else f"{total} changed"

    message = (
        f"[Uncommitted Changes] {total} files with changes ({summary}).\n"
        "Consider asking the user if they'd like to commit before finishing."
    )

    json.dump({"additionalContext": message}, sys.stdout)
    sys.exit(0)


if __name__ == "__main__":
    main()
