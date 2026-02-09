#!/usr/bin/env python3
"""
Git state injector — SessionStart hook that injects repo state as context.

Runs git commands to gather branch, status, recent commits, and uncommitted
changes. Injects the results as additionalContext so Claude starts every
session knowing the current git state.

Reads hook input from stdin (JSON). Returns JSON on stdout.
Always exits 0 (advisory, never blocking).
"""

import json
import os
import subprocess
import sys

GIT_CMD_TIMEOUT = 5
STATUS_LINE_CAP = 20
DIFF_STAT_LINE_CAP = 15
TOTAL_OUTPUT_CAP = 2000


def _run_git(args: list[str], cwd: str) -> str | None:
    """Run a git command and return stdout, or None on any failure."""
    try:
        result = subprocess.run(
            ["git"] + args,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=GIT_CMD_TIMEOUT,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except (FileNotFoundError, OSError, subprocess.TimeoutExpired):
        pass
    return None


def _cap_lines(text: str, limit: int) -> str:
    """Truncate text to a maximum number of lines."""
    lines = text.splitlines()
    if len(lines) <= limit:
        return text
    return "\n".join(lines[:limit]) + f"\n...({len(lines) - limit} more lines)"


def main():
    try:
        json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        pass

    cwd = os.getcwd()

    # Check if we're in a git repo at all
    branch = _run_git(["branch", "--show-current"], cwd)
    if branch is None:
        # Not a git repo or git not available
        sys.exit(0)

    sections = []
    sections.append(f"Branch: {branch or '(detached HEAD)'}")

    # Git status
    status = _run_git(["status", "--short"], cwd)
    if status:
        status_lines = status.splitlines()
        modified = sum(1 for l in status_lines if l.strip() and l[0:1] == "M")
        added = sum(1 for l in status_lines if l[0:1] == "A")
        deleted = sum(1 for l in status_lines if l[0:1] == "D")
        untracked = sum(1 for l in status_lines if l[0:2] == "??")

        counts = []
        if modified:
            counts.append(f"{modified} modified")
        if added:
            counts.append(f"{added} added")
        if deleted:
            counts.append(f"{deleted} deleted")
        if untracked:
            counts.append(f"{untracked} untracked")

        summary = ", ".join(counts) if counts else f"{len(status_lines)} changed"
        sections.append(f"Status: {summary}")
        sections.append(_cap_lines(status, STATUS_LINE_CAP))
    else:
        sections.append("Status: clean")

    # Recent commits
    log = _run_git(["log", "--oneline", "-5"], cwd)
    if log:
        sections.append(f"Recent commits:\n{log}")

    # Uncommitted diff stats
    diff_stat = _run_git(["diff", "--stat"], cwd)
    if diff_stat:
        sections.append(
            f"Uncommitted changes:\n{_cap_lines(diff_stat, DIFF_STAT_LINE_CAP)}"
        )

    output = "[Git State]\n" + "\n".join(sections)

    # Cap total output to avoid context bloat
    if len(output) > TOTAL_OUTPUT_CAP:
        output = output[:TOTAL_OUTPUT_CAP] + "\n...(truncated)"

    json.dump({"additionalContext": output}, sys.stdout)
    sys.exit(0)


if __name__ == "__main__":
    main()
