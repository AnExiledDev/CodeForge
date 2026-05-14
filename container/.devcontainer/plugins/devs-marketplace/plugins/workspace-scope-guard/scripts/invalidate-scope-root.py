#!/usr/bin/env python3
"""
CwdChanged handler — invalidates the session-scoped scope-root cache
so that inject/guard scripts recompute from the new working directory.

Fires on: CwdChanged
Always exits 0 (advisory, never blocking).
"""
import json
import os
import sys


def main():
    try:
        input_data = json.load(sys.stdin)
        session_id = input_data.get("session_id")
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    if session_id:
        cache_path = f"/tmp/claude-scope-root-{session_id}"
        try:
            os.remove(cache_path)
        except FileNotFoundError:
            pass

    sys.exit(0)


if __name__ == "__main__":
    main()
