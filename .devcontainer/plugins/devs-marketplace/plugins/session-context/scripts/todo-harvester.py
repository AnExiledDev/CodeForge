#!/usr/bin/env python3
"""
TODO/FIXME harvester — SessionStart hook that surfaces tech debt markers.

Greps the codebase for TODO/FIXME/HACK/XXX comments and injects a count
plus the top items as additionalContext so Claude can proactively mention
tech debt when relevant.

Reads hook input from stdin (JSON). Returns JSON on stdout.
Always exits 0 (advisory, never blocking).
"""

import json
import os
import subprocess
import sys

GREP_TIMEOUT = 5
MAX_ITEMS = 10
TOTAL_OUTPUT_CAP = 800

SOURCE_INCLUDES = [
    "--include=*.py",
    "--include=*.ts",
    "--include=*.tsx",
    "--include=*.js",
    "--include=*.jsx",
    "--include=*.go",
    "--include=*.rs",
    "--include=*.sh",
    "--include=*.svelte",
    "--include=*.vue",
    "--include=*.rb",
    "--include=*.java",
    "--include=*.kt",
]

EXCLUDE_DIRS = [
    "--exclude-dir=node_modules",
    "--exclude-dir=.git",
    "--exclude-dir=__pycache__",
    "--exclude-dir=.venv",
    "--exclude-dir=venv",
    "--exclude-dir=dist",
    "--exclude-dir=build",
    "--exclude-dir=vendor",
    "--exclude-dir=.next",
    "--exclude-dir=.nuxt",
    "--exclude-dir=target",
    "--exclude-dir=.mypy_cache",
    "--exclude-dir=.pytest_cache",
]


def main():
    try:
        json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        pass

    cwd = os.getcwd()

    cmd = (
        ["grep", "-rn", "-E", r"\b(TODO|FIXME|HACK|XXX)\b"]
        + SOURCE_INCLUDES
        + EXCLUDE_DIRS
        + [cwd]
    )

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=GREP_TIMEOUT,
        )
    except (FileNotFoundError, OSError, subprocess.TimeoutExpired):
        sys.exit(0)

    # grep returns 1 for no matches — that's fine
    output = result.stdout.strip()
    if not output:
        sys.exit(0)

    lines = output.splitlines()
    total_count = len(lines)

    # Count unique files
    files_seen: set[str] = set()
    items: list[str] = []

    for line in lines:
        # Format: filepath:linenum:content
        parts = line.split(":", 2)
        if len(parts) >= 3:
            filepath = parts[0]
            files_seen.add(filepath)

            if len(items) < MAX_ITEMS:
                # Make path relative to cwd for readability
                rel_path = os.path.relpath(filepath, cwd)
                line_num = parts[1]
                content = parts[2].strip()

                # Trim long lines
                if len(content) > 80:
                    content = content[:77] + "..."

                items.append(f"  {rel_path}:{line_num}: {content}")

    file_count = len(files_seen)
    header = (
        f"[Tech Debt] {total_count} TODO/FIXME items found across {file_count} files"
    )

    if items:
        body = header + "\nTop items:\n" + "\n".join(items)
    else:
        body = header

    # Cap total output
    if len(body) > TOTAL_OUTPUT_CAP:
        body = body[:TOTAL_OUTPUT_CAP] + "\n...(truncated)"

    json.dump({"additionalContext": body}, sys.stdout)
    sys.exit(0)


if __name__ == "__main__":
    main()
