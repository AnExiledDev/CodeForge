#!/usr/bin/env python3
"""
Block dangerous bash commands before execution.

Reads tool input from stdin, checks against dangerous patterns.
Exit code 2 blocks the command with error message.
Exit code 0 allows the command to proceed.
"""

import json
import re
import sys

DANGEROUS_PATTERNS = [
    # Destructive filesystem deletion
    (
        r"\brm\s+.*-[^\s]*r[^\s]*f[^\s]*\s+[/~](?:\s|$)",
        "Blocked: rm -rf on root or home directory",
    ),
    (
        r"\brm\s+.*-[^\s]*f[^\s]*r[^\s]*\s+[/~](?:\s|$)",
        "Blocked: rm -rf on root or home directory",
    ),
    (r"\brm\s+-rf\s+/(?:\s|$)", "Blocked: rm -rf /"),
    (r"\brm\s+-rf\s+~(?:\s|$)", "Blocked: rm -rf ~"),
    # Root-level file removal
    (r"\bsudo\s+rm\b", "Blocked: sudo rm - use caution with privileged deletion"),
    # World-writable permissions
    (r"\bchmod\s+777\b", "Blocked: chmod 777 creates security vulnerability"),
    (
        r"\bchmod\s+-R\s+777\b",
        "Blocked: recursive chmod 777 creates security vulnerability",
    ),
    # Force push to main/master
    (
        r"\bgit\s+push\s+.*--force.*\s+(origin\s+)?(main|master)\b",
        "Blocked: force push to main/master destroys history",
    ),
    (
        r"\bgit\s+push\s+.*-f\s+.*\s+(origin\s+)?(main|master)\b",
        "Blocked: force push to main/master destroys history",
    ),
    (
        r"\bgit\s+push\s+-f\s+(origin\s+)?(main|master)\b",
        "Blocked: force push to main/master destroys history",
    ),
    (
        r"\bgit\s+push\s+--force\s+(origin\s+)?(main|master)\b",
        "Blocked: force push to main/master destroys history",
    ),
    # System directory modification
    (r">\s*/usr/", "Blocked: writing to /usr system directory"),
    (r">\s*/etc/", "Blocked: writing to /etc system directory"),
    (r">\s*/bin/", "Blocked: writing to /bin system directory"),
    (r">\s*/sbin/", "Blocked: writing to /sbin system directory"),
    # Disk formatting
    (r"\bmkfs\.\w+", "Blocked: disk formatting command"),
    (r"\bdd\s+.*of=/dev/", "Blocked: dd writing to device"),
    # History manipulation
    (
        r"\bgit\s+reset\s+--hard\s+origin/(main|master)\b",
        "Blocked: hard reset to remote main/master - destructive operation",
    ),
    # Docker container escape
    (
        r"\bdocker\s+run\s+.*--privileged",
        "Blocked: docker run --privileged allows container escape",
    ),
    (
        r"\bdocker\s+run\s+.*-v\s+/:/\w",
        "Blocked: docker run mounting host root filesystem",
    ),
    # Destructive Docker operations
    (
        r"\bdocker\s+(stop|rm|kill|rmi)\s+",
        "Blocked: destructive docker operation - use with caution",
    ),
    # Additional rm patterns
    (r"\brm\s+.*-[^\s]*r[^\s]*f[^\s]*\s+\.\./", "Blocked: rm -rf on parent directory"),
    (r"\bfind\s+.*-exec\s+rm\b", "Blocked: find -exec rm is dangerous"),
    (r"\bfind\s+.*-delete\b", "Blocked: find -delete is dangerous"),
    # Git history destruction
    (r"\bgit\s+push\s+-f\b", "Blocked: bare force push - specify remote and branch"),
    (
        r"\bgit\s+push\s+--force\b",
        "Blocked: bare force push - specify remote and branch",
    ),
    (
        r"\bgit\s+clean\s+-[^\s]*f",
        "Blocked: git clean -f removes untracked files permanently",
    ),
]


def check_command(command: str) -> tuple[bool, str]:
    """Check if command matches any dangerous pattern.

    Returns:
        (is_dangerous, message)
    """
    for pattern, message in DANGEROUS_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            return True, message
    return False, ""


def main():
    try:
        input_data = json.load(sys.stdin)
        tool_input = input_data.get("tool_input", {})
        command = tool_input.get("command", "")

        if not command:
            sys.exit(0)

        is_dangerous, message = check_command(command)

        if is_dangerous:
            # Output error to stderr (exit 2 ignores stdout)
            print(message, file=sys.stderr)
            sys.exit(2)

        # Allow command to proceed
        sys.exit(0)

    except json.JSONDecodeError:
        # Fail closed: can't parse means can't verify safety
        sys.exit(2)
    except Exception as e:
        # Fail closed: unexpected errors should block, not allow
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
