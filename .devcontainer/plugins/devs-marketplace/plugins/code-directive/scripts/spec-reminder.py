#!/usr/bin/env python3
"""
Spec reminder — Stop hook that advises about spec updates after code changes.

On Stop, checks if source code was modified but no .specs/ files were updated.
Injects an advisory reminder as additionalContext pointing the user to
/spec-update.

Only fires when a .specs/ directory exists (project uses the spec system).

Reads hook input from stdin (JSON). Returns JSON on stdout.
Always exits 0 (advisory, never blocking).
"""

import json
import os
import subprocess
import sys

GIT_CMD_TIMEOUT = 5

# Directories whose changes should trigger the spec reminder
CODE_DIRS = (
    "src/",
    "lib/",
    "app/",
    "pkg/",
    "internal/",
    "cmd/",
    "tests/",
    "api/",
    "frontend/",
    "backend/",
    "packages/",
    "services/",
    "components/",
    "pages/",
    "routes/",
)


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

    cwd = os.getcwd()

    # Only fire if this project uses the spec system
    if not os.path.isdir(os.path.join(cwd, ".specs")):
        sys.exit(0)

    # Get all changed files (staged + unstaged)
    diff_output = _run_git(["diff", "--name-only", "HEAD"])
    staged_output = _run_git(["diff", "--name-only", "--cached"])

    # Also include untracked files in source dirs
    untracked = _run_git(["ls-files", "--others", "--exclude-standard"])

    all_files: set[str] = set()
    for output in (diff_output, staged_output, untracked):
        if output:
            all_files.update(output.splitlines())

    if not all_files:
        sys.exit(0)

    # Check if any code directories have changes
    has_code_changes = any(f.startswith(d) for f in all_files for d in CODE_DIRS)

    if not has_code_changes:
        sys.exit(0)

    # Check if any spec files were also changed
    has_spec_changes = any(f.startswith(".specs/") for f in all_files)

    if has_spec_changes:
        # Specs were updated alongside code — no reminder needed
        sys.exit(0)

    # Code changed but specs didn't — inject reminder
    code_dirs_touched = sorted(
        {f.split("/")[0] + "/" for f in all_files if "/" in f}
        & {d.rstrip("/") + "/" for d in CODE_DIRS}
    )
    dirs_str = ", ".join(code_dirs_touched[:3])

    message = (
        f"[Spec Reminder] Code was modified in {dirs_str} "
        "but no specs were updated. "
        "Use /spec-update to update the relevant spec, "
        "/spec-new if no spec exists for this feature, "
        "or /spec-refine if the spec is still in draft status."
    )

    json.dump({"additionalContext": message}, sys.stdout)
    sys.exit(0)


if __name__ == "__main__":
    main()
