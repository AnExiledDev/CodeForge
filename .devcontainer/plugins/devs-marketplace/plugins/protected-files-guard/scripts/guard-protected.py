#!/usr/bin/env python3
"""
Block modifications to protected files.

Reads tool input from stdin, checks file path against protected patterns.
Exit code 2 blocks the edit with error message.
Exit code 0 allows the edit to proceed.
"""

import json
import re
import sys

# Patterns that should be protected from modification
PROTECTED_PATTERNS = [
    # Environment secrets
    (r"(^|/)\.env$", "Blocked: .env contains secrets - edit manually if needed"),
    (
        r"(^|/)\.env\.[^/]+$",
        "Blocked: .env.* files contain secrets - edit manually if needed",
    ),
    # Git internals
    (r"(^|/)\.git(/|$)", "Blocked: .git is managed by git"),
    # Lock files (should be modified via package manager)
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
    # Certificates and keys
    (r"\.pem$", "Blocked: .pem files contain sensitive cryptographic material"),
    (r"\.key$", "Blocked: .key files contain sensitive cryptographic material"),
    (r"\.crt$", "Blocked: .crt certificate files should not be edited directly"),
    (r"\.p12$", "Blocked: .p12 files contain sensitive cryptographic material"),
    (r"\.pfx$", "Blocked: .pfx files contain sensitive cryptographic material"),
    # Credential files
    (r"(^|/)credentials\.json$", "Blocked: credentials.json contains secrets"),
    (r"(^|/)secrets\.yaml$", "Blocked: secrets.yaml contains secrets"),
    (r"(^|/)secrets\.yml$", "Blocked: secrets.yml contains secrets"),
    (r"(^|/)secrets\.json$", "Blocked: secrets.json contains secrets"),
    (r"(^|/)\.secrets$", "Blocked: .secrets file contains secrets"),
    # Auth directories and files
    (r"(^|/)\.ssh/", "Blocked: .ssh/ contains sensitive authentication data"),
    (r"(^|/)\.aws/", "Blocked: .aws/ contains AWS credentials"),
    (r"(^|/)\.netrc$", "Blocked: .netrc contains authentication credentials"),
    (
        r"(^|/)\.npmrc$",
        "Blocked: .npmrc may contain auth tokens - edit manually if needed",
    ),
    (r"(^|/)\.pypirc$", "Blocked: .pypirc contains PyPI credentials"),
    # Other sensitive files
    (r"(^|/|-)id_rsa($|\.)", "Blocked: SSH private key file"),
    (r"(^|/)id_ed25519", "Blocked: SSH private key file"),
    (r"(^|/)id_ecdsa", "Blocked: SSH private key file"),
]


def check_path(file_path: str) -> tuple[bool, str]:
    """Check if file path matches any protected pattern.

    Returns:
        (is_protected, message)
    """
    # Normalize path for consistent matching
    normalized = file_path.replace("\\", "/")

    for pattern, message in PROTECTED_PATTERNS:
        if re.search(pattern, normalized, re.IGNORECASE):
            return True, message

    return False, ""


def main():
    try:
        input_data = json.load(sys.stdin)
        tool_input = input_data.get("tool_input", {})
        file_path = tool_input.get("file_path", "")

        if not file_path:
            sys.exit(0)

        is_protected, message = check_path(file_path)

        if is_protected:
            # Output error to stderr (exit 2 ignores stdout)
            print(message, file=sys.stderr)
            sys.exit(2)

        # Allow edit to proceed
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
