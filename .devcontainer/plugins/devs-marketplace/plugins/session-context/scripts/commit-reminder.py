#!/usr/bin/env python3
"""
Commit reminder — Stop hook that advises about uncommitted changes.

On Stop, checks whether this session edited any files (via the tmp file
written by collect-session-edits.py) and whether uncommitted changes exist.
Uses tiered logic: meaningful changes (3+ files, 2+ source files, or test
files touched) get an advisory suggestion; small changes are silent.

Output is a systemMessage wrapped in <system-reminder> tags — advisory only,
never blocks. The stop_hook_active guard prevents loops.
"""

import json
import os
import subprocess
import sys

GIT_CMD_TIMEOUT = 5

# Extensions considered source code (not config/docs)
SOURCE_EXTS = frozenset((
    ".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs",
    ".java", ".kt", ".rb", ".svelte", ".vue", ".c", ".cpp", ".h",
))

# Patterns that indicate test files
TEST_PATTERNS = ("test_", "_test.", ".test.", ".spec.", "/tests/", "/test/")


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


def _read_session_edits(session_id: str) -> list[str]:
    """Read the list of files edited this session."""
    tmp_path = f"/tmp/claude-session-edits-{session_id}"
    try:
        with open(tmp_path, "r") as f:
            raw = f.read()
    except OSError:
        return []

    seen: set[str] = set()
    result: list[str] = []
    for line in raw.strip().splitlines():
        path = line.strip()
        if path and path not in seen:
            seen.add(path)
            result.append(path)
    return result


def _is_source_file(path: str) -> bool:
    """Check if a file path looks like source code."""
    _, ext = os.path.splitext(path)
    return ext.lower() in SOURCE_EXTS


def _is_test_file(path: str) -> bool:
    """Check if a file path looks like a test file."""
    lower = path.lower()
    return any(pattern in lower for pattern in TEST_PATTERNS)


def _is_meaningful(edited_files: list[str]) -> bool:
    """Determine if the session's edits are meaningful enough to suggest committing.

    Meaningful when any of:
    - 3+ total files edited
    - 2+ source code files edited
    - Any test files edited (suggests feature work)
    """
    if len(edited_files) >= 3:
        return True

    source_count = sum(1 for f in edited_files if _is_source_file(f))
    if source_count >= 2:
        return True

    if any(_is_test_file(f) for f in edited_files):
        return True

    return False


def main():
    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    # Skip if another Stop hook is already blocking
    if input_data.get("stop_hook_active"):
        sys.exit(0)

    # Only fire if this session actually edited files
    session_id = input_data.get("session_id", "")
    if not session_id:
        sys.exit(0)

    edited_files = _read_session_edits(session_id)
    if not edited_files:
        sys.exit(0)

    # Small changes — stay silent
    if not _is_meaningful(edited_files):
        sys.exit(0)

    # Check if there are any uncommitted changes
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
        "<system-reminder>\n"
        f"[Session Summary] Modified {total} files ({summary}). "
        "This looks like a complete unit of work.\n"
        "Consider asking the user if they would like to commit.\n"
        "Do NOT commit without explicit user approval.\n"
        "</system-reminder>"
    )

    json.dump({"systemMessage": message}, sys.stdout)
    sys.exit(0)


if __name__ == "__main__":
    main()
