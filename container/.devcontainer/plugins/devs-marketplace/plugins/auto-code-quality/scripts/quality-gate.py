#!/usr/bin/env python3
"""
Quality gate — lightweight Stop hook.

Checks whether files were edited this session and whether background
tasks are still running. If edits exist and no tasks are active,
blocks the stop and tells Claude to run /cq.

Always exits 0 (no block) or outputs a block decision.
Runs in <10ms (just file reads).
"""

import json
import os
import sys

# Hook gate — check ~/.claude/disabled-hooks.json
_dh = os.path.join(os.path.expanduser("~"), ".claude", "disabled-hooks.json")
if os.path.exists(_dh):
    with open(_dh) as _f:
        if os.path.basename(__file__).replace(".py", "") in json.load(_f).get(
            "disabled", []
        ):
            sys.exit(0)


def main():
    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    # Skip if another stop hook is already active (prevents re-entry)
    if input_data.get("stop_hook_active"):
        sys.exit(0)

    session_id = input_data.get("session_id", "")
    if not session_id:
        sys.exit(0)

    # Skip if background tasks are still running
    tasks_file = f"/tmp/claude-active-tasks-{session_id}"
    try:
        with open(tasks_file) as f:
            entries = [line.strip() for line in f if line.strip()]
        if entries:
            sys.exit(0)
    except FileNotFoundError:
        pass  # No tasks file means no active tasks
    except OSError:
        pass

    # Check if any files were edited this session
    edited_file = f"/tmp/claude-cq-edited-{session_id}"
    try:
        with open(edited_file) as f:
            raw_paths = f.read().splitlines()
    except FileNotFoundError:
        sys.exit(0)
    except OSError:
        sys.exit(0)

    # Deduplicate and filter to existing files
    seen: set[str] = set()
    paths: list[str] = []
    for p in raw_paths:
        p = p.strip()
        if p and p not in seen and os.path.isfile(p):
            seen.add(p)
            paths.append(p)

    if not paths:
        # Clean up empty/stale temp file
        try:
            os.unlink(edited_file)
        except OSError:
            pass
        sys.exit(0)

    # Block and tell Claude to run /cq
    # Delete temp files so the NEXT stop (after /cq runs) exits clean
    for prefix in ("claude-cq-edited", "claude-cq-lint"):
        try:
            os.unlink(f"/tmp/{prefix}-{session_id}")
        except OSError:
            pass

    file_list = "\n".join(f"  - {p}" for p in paths)
    json.dump(
        {
            "decision": "block",
            "reason": (
                "Files were edited this session. Run /cq to format, lint, "
                "and test before completing.\n\n"
                f"Edited files:\n{file_list}"
            ),
        },
        sys.stdout,
    )
    sys.exit(0)


if __name__ == "__main__":
    main()
