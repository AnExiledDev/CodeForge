#!/usr/bin/env python3
"""
Activity tracker — handles SubagentStart, SubagentStop, PreToolUse[Bash],
PostToolUse[Bash], and PostToolUseFailure[Bash] hooks.

Maintains a session-scoped file listing active background work items
(subagents and background bash commands). The quality-gate Stop hook
reads this file to skip blocking when background work is in progress.

Entry format: type:id:timestamp (one per line)
  - agent:{agent_id}:{unix_ts}
  - bash:{tool_use_id}:{unix_ts}

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


def _locked_remove(path: str, prefix: str) -> None:
    """Remove entries matching a type:id prefix from the file under an exclusive lock."""
    for attempt in range(_MAX_RETRIES):
        try:
            with open(path, "r+") as f:
                fcntl.flock(f.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                lines = [line.strip() for line in f if line.strip()]

                remaining = [entry for entry in lines if not entry.startswith(prefix)]

                if remaining == lines:
                    return  # Nothing matched

                if remaining:
                    f.seek(0)
                    f.truncate()
                    f.write("\n".join(remaining) + "\n")
                else:
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
    work_file = f"/tmp/claude-active-work-{session_id}"
    now = int(time.time())

    if event == "SubagentStart":
        agent_id = input_data.get("agent_id", "")
        if agent_id:
            _locked_append(work_file, f"agent:{agent_id}:{now}\n")

    elif event == "SubagentStop":
        agent_id = input_data.get("agent_id", "")
        if agent_id:
            _locked_remove(work_file, f"agent:{agent_id}:")

    elif event == "PreToolUse":
        tool_input = input_data.get("tool_input", {})
        if tool_input.get("run_in_background") is True:
            tool_use_id = input_data.get("tool_use_id", "")
            if tool_use_id:
                _locked_append(work_file, f"bash:{tool_use_id}:{now}\n")

    elif event in ("PostToolUse", "PostToolUseFailure"):
        tool_use_id = input_data.get("tool_use_id", "")
        if tool_use_id:
            _locked_remove(work_file, f"bash:{tool_use_id}:")

    sys.exit(0)


if __name__ == "__main__":
    main()
