#!/usr/bin/env python3
"""
Enforce workspace scope for file operations.

Blocks write operations (Write, Edit, NotebookEdit) to files outside the
current working directory. Warns on read operations (Read, Glob, Grep)
outside the working directory. Allows unrestricted access when cwd is
/workspaces (the workspace root).

Exit code 2 blocks the operation with an error message.
Exit code 0 allows the operation to proceed (with optional warning context).
"""

import json
import os
import sys

# Paths that are always allowed regardless of working directory
ALLOWED_PREFIXES = [
    "/workspaces/.tmp/",
    "/tmp/",
    "/home/vscode/",
]

WRITE_TOOLS = {"Write", "Edit", "NotebookEdit"}
READ_TOOLS = {"Read", "Glob", "Grep"}

# Tool input field that contains the target path
PATH_FIELDS = {
    "Read": "file_path",
    "Write": "file_path",
    "Edit": "file_path",
    "NotebookEdit": "notebook_path",
    "Glob": "path",
    "Grep": "path",
}


def get_target_path(tool_name: str, tool_input: dict) -> str | None:
    """Extract the target path from tool input.

    Returns None if no path field is present or the field is empty,
    which means the tool defaults to cwd (always in scope).
    """
    field = PATH_FIELDS.get(tool_name)
    if not field:
        return None
    return tool_input.get(field) or None


def is_in_scope(resolved_path: str, cwd: str) -> bool:
    """Check if resolved_path is within the working directory."""
    cwd_prefix = cwd if cwd.endswith("/") else cwd + "/"
    return resolved_path == cwd or resolved_path.startswith(cwd_prefix)


def is_allowlisted(resolved_path: str) -> bool:
    """Check if resolved_path falls under an allowed prefix."""
    return any(resolved_path.startswith(prefix) for prefix in ALLOWED_PREFIXES)


def main():
    try:
        input_data = json.load(sys.stdin)
        tool_name = input_data.get("tool_name", "")
        tool_input = input_data.get("tool_input", {})

        cwd = os.getcwd()

        # Unrestricted when working from the workspace root
        if cwd == "/workspaces":
            sys.exit(0)

        target_path = get_target_path(tool_name, tool_input)

        # No path specified — tool defaults to cwd, which is in scope
        if target_path is None:
            sys.exit(0)

        resolved = os.path.realpath(target_path)

        if is_in_scope(resolved, cwd):
            sys.exit(0)

        if is_allowlisted(resolved):
            sys.exit(0)

        # Out of scope
        if tool_name in WRITE_TOOLS:
            print(
                json.dumps(
                    {
                        "error": (
                            f"Blocked: {tool_name} targets '{target_path}' which is "
                            f"outside the working directory ({cwd}). Move to that "
                            f"project's directory first or work from /workspaces."
                        )
                    }
                )
            )
            sys.exit(2)

        if tool_name in READ_TOOLS:
            print(
                json.dumps(
                    {
                        "additionalContext": (
                            f"Warning: {tool_name} targets '{target_path}' which is "
                            f"outside the working directory ({cwd}). This read is "
                            f"allowed but may indicate unintended cross-project access."
                        )
                    }
                )
            )
            sys.exit(0)

        # Unknown tool — allow by default
        sys.exit(0)

    except json.JSONDecodeError:
        # Can't parse input — allow by default
        sys.exit(0)
    except Exception as e:
        # Don't block on hook failure
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(0)


if __name__ == "__main__":
    main()
