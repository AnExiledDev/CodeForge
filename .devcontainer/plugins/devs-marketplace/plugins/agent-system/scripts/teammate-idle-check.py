#!/usr/bin/env python3
"""
TeammateIdle quality gate — checks if teammate has incomplete tasks.

Runs when a teammate is about to go idle. Queries the shared task list
directory for tasks assigned to this teammate that aren't yet completed.

Exit 0: Allow idle (no incomplete tasks or unable to determine)
Exit 2: Send feedback via stderr (incomplete tasks found)
"""

import json
import os
import sys


def find_incomplete_tasks(teammate_name: str) -> list[str]:
    """Scan task directories for incomplete tasks owned by this teammate."""
    config_dir = os.environ.get("CLAUDE_CONFIG_DIR", os.path.expanduser("~/.claude"))
    tasks_base = os.path.join(config_dir, "tasks")

    if not os.path.isdir(tasks_base):
        return []

    incomplete = []
    for entry in os.listdir(tasks_base):
        team_dir = os.path.join(tasks_base, entry)
        if not os.path.isdir(team_dir):
            continue

        for filename in sorted(os.listdir(team_dir)):
            if not filename.endswith(".json"):
                continue

            task_path = os.path.join(team_dir, filename)
            try:
                with open(task_path, "r", encoding="utf-8") as f:
                    task = json.load(f)

                owner = task.get("owner", "")
                status = task.get("status", "")
                subject = task.get("subject", filename)

                if owner == teammate_name and status in ("pending", "in_progress"):
                    incomplete.append(subject)
            except (OSError, json.JSONDecodeError, ValueError):
                continue

    return incomplete


def main():
    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    teammate_name = (
        input_data.get("teammate_name")
        or input_data.get("agent_name")
        or ""
    )
    if not teammate_name:
        sys.exit(0)

    incomplete = find_incomplete_tasks(teammate_name)
    if not incomplete:
        sys.exit(0)

    task_list = "; ".join(incomplete[:5])
    suffix = f" (and {len(incomplete) - 5} more)" if len(incomplete) > 5 else ""
    print(
        f"You have {len(incomplete)} incomplete task(s): {task_list}{suffix}. "
        f"Check TaskList and continue working before going idle.",
        file=sys.stderr,
    )
    sys.exit(2)


if __name__ == "__main__":
    main()
