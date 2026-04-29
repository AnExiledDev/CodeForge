#!/usr/bin/env python3
"""
Task lifecycle tracker — handles TaskCreated and TaskCompleted hooks.

Maintains a session-scoped file listing active background tasks.
The quality-gate Stop hook reads this file to skip blocking when
tasks are still running.

Always exits 0.
"""

import fcntl
import json
import os
import sys
import time

# Hook gate — check ~/.claude/disabled-hooks.json
_dh = os.path.join(os.path.expanduser("~"), ".claude", "disabled-hooks.json")
if os.path.exists(_dh):
    with open(_dh) as _f:
        if os.path.basename(__file__).replace(".py", "") in json.load(_f).get(
            "disabled", []
        ):
            sys.exit(0)


_MAX_RETRIES = 3
_RETRY_DELAY = 0.1  # 100ms


def _locked_append(path: str, data: str) -> None:
    """Append data to file under an exclusive lock."""
    for attempt in range(_MAX_RETRIES):
        try:
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                os.write(fd, data.encode())
                return
            finally:
                os.close(fd)
        except BlockingIOError:
            if attempt < _MAX_RETRIES - 1:
                time.sleep(_RETRY_DELAY)
        except OSError:
            return


def _locked_remove(path: str, task_id: str) -> None:
    """Remove a task ID from the file under an exclusive lock."""
    for attempt in range(_MAX_RETRIES):
        try:
            with open(path, "r+") as f:
                fcntl.flock(f.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                lines = [line.strip() for line in f if line.strip()]

                try:
                    lines.remove(task_id)
                except ValueError:
                    return  # Task ID not found — may have been cleaned up

                if lines:
                    f.seek(0)
                    f.truncate()
                    f.write("\n".join(lines) + "\n")
                else:
                    # No more active tasks — remove file after releasing lock
                    f.close()
                    try:
                        os.unlink(path)
                    except OSError:
                        pass
                return
        except FileNotFoundError:
            return
        except BlockingIOError:
            if attempt < _MAX_RETRIES - 1:
                time.sleep(_RETRY_DELAY)
        except OSError:
            return


def main():
    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    session_id = input_data.get("session_id", "")
    if not session_id:
        sys.exit(0)

    event = input_data.get("hook_event_name", "")
    if event not in ("TaskCreated", "TaskCompleted"):
        sys.exit(0)

    task_id = input_data.get("task_id", "") or input_data.get("id", "") or "unknown"
    tasks_file = f"/tmp/claude-active-tasks-{session_id}"

    if event == "TaskCreated":
        _locked_append(tasks_file, task_id + "\n")
    elif event == "TaskCompleted":
        _locked_remove(tasks_file, task_id)

    sys.exit(0)


if __name__ == "__main__":
    main()
