#!/usr/bin/env python3
"""
Task lifecycle tracker — handles TaskCreated and TaskCompleted hooks.

Maintains a session-scoped file listing active background tasks.
The quality-gate Stop hook reads this file to skip blocking when
tasks are still running.

Always exits 0.
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

    session_id = input_data.get("session_id", "")
    if not session_id:
        sys.exit(0)

    event = input_data.get("hook_event_name", "")
    task_id = input_data.get("task_id", "") or input_data.get("id", "") or "unknown"
    tasks_file = f"/tmp/claude-active-tasks-{session_id}"

    if event == "TaskCreated":
        try:
            with open(tasks_file, "a") as f:
                f.write(task_id + "\n")
        except OSError:
            pass

    elif event == "TaskCompleted":
        try:
            with open(tasks_file) as f:
                lines = [line.strip() for line in f if line.strip()]
        except FileNotFoundError:
            sys.exit(0)
        except OSError:
            sys.exit(0)

        # Remove first occurrence of this task ID
        try:
            lines.remove(task_id)
        except ValueError:
            pass  # Task ID not found — may have been cleaned up

        if lines:
            try:
                with open(tasks_file, "w") as f:
                    f.write("\n".join(lines) + "\n")
            except OSError:
                pass
        else:
            # No more active tasks — clean up
            try:
                os.unlink(tasks_file)
            except OSError:
                pass

    sys.exit(0)


if __name__ == "__main__":
    main()
