#!/usr/bin/env python3
"""
Ticket linker — UserPromptSubmit hook that auto-fetches GitHub issues/PRs.

When the user's prompt contains #123 or a full GitHub issue/PR URL,
fetches the ticket body via `gh` and injects it as additionalContext
so Claude has the full ticket context without the user copy-pasting.

Reads hook input from stdin (JSON). Returns JSON on stdout.
Always exits 0 (advisory, never blocking).
"""

import json
import re
import subprocess
import sys

GH_CMD_TIMEOUT = 5
MAX_REFS = 3
BODY_CHAR_CAP = 1500
TOTAL_OUTPUT_CAP = 3000

# Short refs: #123 (but not inside URLs or hex colors)
SHORT_REF_RE = re.compile(r"(?<![/\w])#(\d+)\b")

# Full GitHub URLs: github.com/owner/repo/issues/123 or .../pull/123
URL_REF_RE = re.compile(r"github\.com/[^/\s]+/[^/\s]+/(?:issues|pull)/(\d+)")


def extract_refs(prompt: str) -> list[int]:
    """Extract deduplicated issue/PR numbers from the prompt."""
    seen: set[int] = set()
    refs: list[int] = []

    for match in SHORT_REF_RE.finditer(prompt):
        num = int(match.group(1))
        if num not in seen and num > 0:
            seen.add(num)
            refs.append(num)

    for match in URL_REF_RE.finditer(prompt):
        num = int(match.group(1))
        if num not in seen and num > 0:
            seen.add(num)
            refs.append(num)

    return refs[:MAX_REFS]


def fetch_ticket(number: int) -> str | None:
    """Fetch a GitHub issue/PR via gh CLI. Returns formatted string or None."""
    try:
        result = subprocess.run(
            [
                "gh",
                "issue",
                "view",
                str(number),
                "--json",
                "number,title,body,state,labels",
            ],
            capture_output=True,
            text=True,
            timeout=GH_CMD_TIMEOUT,
        )
    except (FileNotFoundError, OSError, subprocess.TimeoutExpired):
        return None

    if result.returncode != 0:
        return None

    try:
        data = json.loads(result.stdout)
    except (json.JSONDecodeError, ValueError):
        return None

    title = data.get("title", "(no title)")
    state = data.get("state", "UNKNOWN")
    body = data.get("body", "") or ""
    labels = data.get("labels", [])

    label_names = [lb.get("name", "") for lb in labels if lb.get("name")]
    label_str = ", ".join(label_names) if label_names else "none"

    # Truncate body
    if len(body) > BODY_CHAR_CAP:
        body = body[:BODY_CHAR_CAP] + "\n...(truncated)"

    parts = [
        f"[Ticket #{number}] {title}",
        f"State: {state} | Labels: {label_str}",
    ]
    if body.strip():
        parts.append(body.strip())

    return "\n".join(parts)


def main():
    raw = sys.stdin.read().strip()
    if not raw:
        sys.exit(0)

    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    prompt = data.get("prompt", "")
    if not prompt:
        sys.exit(0)

    refs = extract_refs(prompt)
    if not refs:
        sys.exit(0)

    tickets: list[str] = []
    for number in refs:
        ticket = fetch_ticket(number)
        if ticket:
            tickets.append(ticket)

    if not tickets:
        sys.exit(0)

    output = "\n\n---\n\n".join(tickets)

    # Cap total output
    if len(output) > TOTAL_OUTPUT_CAP:
        output = output[:TOTAL_OUTPUT_CAP] + "\n...(truncated)"

    json.dump({"additionalContext": output}, sys.stdout)
    sys.exit(0)


if __name__ == "__main__":
    main()
