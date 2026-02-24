#!/usr/bin/env python3
"""
Block bash commands that write to protected files.

Reads tool input from stdin, checks the command field for write operations
targeting protected file patterns.
Exit code 2 blocks the command with error message.
Exit code 0 allows the command to proceed.
"""

import json
import re
import sys

# Same patterns as guard-protected.py
PROTECTED_PATTERNS = [
    (r"(^|/)\.env$", "Blocked: .env contains secrets - edit manually if needed"),
    (
        r"(^|/)\.env\.[^/]+$",
        "Blocked: .env.* files contain secrets - edit manually if needed",
    ),
    (r"(^|/)\.git(/|$)", "Blocked: .git is managed by git"),
    (
        r"(^|/)package-lock\.json$",
        "Blocked: package-lock.json - use npm install instead",
    ),
    (r"(^|/)yarn\.lock$", "Blocked: yarn.lock - use yarn install instead"),
    (r"(^|/)pnpm-lock\.yaml$", "Blocked: pnpm-lock.yaml - use pnpm install instead"),
    (r"(^|/)Gemfile\.lock$", "Blocked: Gemfile.lock - use bundle install instead"),
    (r"(^|/)poetry\.lock$", "Blocked: poetry.lock - use poetry install instead"),
    (r"(^|/)Cargo\.lock$", "Blocked: Cargo.lock - use cargo build instead"),
    (r"(^|/)composer\.lock$", "Blocked: composer.lock - use composer install instead"),
    (r"(^|/)uv\.lock$", "Blocked: uv.lock - use uv sync instead"),
    (r"\.pem$", "Blocked: .pem files contain sensitive cryptographic material"),
    (r"\.key$", "Blocked: .key files contain sensitive cryptographic material"),
    (r"\.crt$", "Blocked: .crt certificate files should not be edited directly"),
    (r"\.p12$", "Blocked: .p12 files contain sensitive cryptographic material"),
    (r"\.pfx$", "Blocked: .pfx files contain sensitive cryptographic material"),
    (r"(^|/)credentials\.json$", "Blocked: credentials.json contains secrets"),
    (r"(^|/)secrets\.yaml$", "Blocked: secrets.yaml contains secrets"),
    (r"(^|/)secrets\.yml$", "Blocked: secrets.yml contains secrets"),
    (r"(^|/)secrets\.json$", "Blocked: secrets.json contains secrets"),
    (r"(^|/)\.secrets$", "Blocked: .secrets file contains secrets"),
    (r"(^|/)\.ssh/", "Blocked: .ssh/ contains sensitive authentication data"),
    (r"(^|/)\.aws/", "Blocked: .aws/ contains AWS credentials"),
    (r"(^|/)\.netrc$", "Blocked: .netrc contains authentication credentials"),
    (
        r"(^|/)\.npmrc$",
        "Blocked: .npmrc may contain auth tokens - edit manually if needed",
    ),
    (r"(^|/)\.pypirc$", "Blocked: .pypirc contains PyPI credentials"),
    (r"(^|/|-)id_rsa($|\.)", "Blocked: SSH private key file"),
    (r"(^|/)id_ed25519", "Blocked: SSH private key file"),
    (r"(^|/)id_ecdsa", "Blocked: SSH private key file"),
]

# Patterns that indicate a bash command is writing to a file
# Each captures the target file path for checking against PROTECTED_PATTERNS
WRITE_PATTERNS = [
    # Redirect: > file, >> file
    r"(?:>|>>)\s*([^\s;&|]+)",
    # tee: tee file, tee -a file
    r"\btee\s+(?:-a\s+)?([^\s;&|]+)",
    # cp/mv: cp src dest, mv src dest
    r"\b(?:cp|mv)\s+(?:-[^\s]+\s+)*[^\s]+\s+([^\s;&|]+)",
    # sed -i: sed -i '' file
    r'\bsed\s+-i[^\s]*\s+(?:\'[^\']*\'\s+|"[^"]*"\s+|[^\s]+\s+)*([^\s;&|]+)',
    # cat > file (heredoc style)
    r"\bcat\s+(?:<<[^\s]*\s+)?>\s*([^\s;&|]+)",
]


def extract_write_targets(command: str) -> list[str]:
    """Extract file paths that the command writes to."""
    targets = []
    for pattern in WRITE_PATTERNS:
        for match in re.finditer(pattern, command):
            target = match.group(1).strip("'\"")
            if target:
                targets.append(target)
    return targets


def check_path(file_path: str) -> tuple[bool, str]:
    """Check if file path matches any protected pattern."""
    normalized = file_path.replace("\\", "/")
    for pattern, message in PROTECTED_PATTERNS:
        if re.search(pattern, normalized, re.IGNORECASE):
            return True, message
    return False, ""


def main():
    try:
        input_data = json.load(sys.stdin)
        tool_input = input_data.get("tool_input", {})
        command = tool_input.get("command", "")

        if not command:
            sys.exit(0)

        targets = extract_write_targets(command)

        for target in targets:
            is_protected, message = check_path(target)
            if is_protected:
                print(f"{message} (via bash command)", file=sys.stderr)
                sys.exit(2)

        sys.exit(0)

    except json.JSONDecodeError:
        # Fail closed: can't parse means can't verify safety
        sys.exit(2)
    except Exception as e:
        # Log error but don't block on hook failure
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(0)


if __name__ == "__main__":
    main()
