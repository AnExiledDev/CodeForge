#!/usr/bin/env python3
"""
Guard readonly bash - PreToolUse hook for read-only agents.

Ensures Bash commands are read-only by blocking write operations.
Supports two modes:
  --mode general-readonly: Blocks common write/modification commands
  --mode git-readonly: Only allows specific git read commands + safe utilities

Handles bypass vectors: command chaining (;, &&, ||), pipes (|),
command substitution ($(), backticks), backgrounding (&), redirections
(>, >>), eval/exec, inline scripting (python -c, node -e), and
path/backslash prefix bypasses (/usr/bin/rm, \\rm).

Reads tool input from stdin (JSON). Returns JSON on stdout.
Exit 0: Command is safe (allowed)
Exit 2: Command would modify state (blocked)
"""

import json
import re
import sys

# ---------------------------------------------------------------------------
# General-readonly blocklist
# ---------------------------------------------------------------------------

# Single-word commands that modify files or system state
WRITE_COMMANDS = frozenset(
    {
        # File system modification
        "rm",
        "mv",
        "cp",
        "mkdir",
        "rmdir",
        "touch",
        "chmod",
        "chown",
        "chgrp",
        "ln",
        "install",
        "mkfifo",
        "mknod",
        "truncate",
        "shred",
        "unlink",
        # Interactive editors
        "nano",
        "vi",
        "vim",
        "nvim",
        # Process management
        "kill",
        "pkill",
        "killall",
        # Dangerous utilities
        "dd",
        "sudo",
        "su",
        "tee",
        # Shell builtins that execute arbitrary code
        "eval",
        "exec",
        "source",
        # Can execute arbitrary commands as arguments
        "xargs",
    }
)

# Two-word command prefixes that are blocked (matched on word boundaries)
WRITE_PREFIXES = (
    # Docker writes
    "docker stop",
    "docker rm",
    "docker kill",
    "docker rmi",
    "docker exec",
    "docker-compose down",
    "docker compose down",
    # Git writes
    "git push",
    "git reset",
    "git clean",
    "git merge",
    "git rebase",
    "git commit",
    "git cherry-pick",
    "git revert",
    "git pull",
    "git checkout --",
    "git restore",
    "git stash drop",
    "git stash clear",
    "git stash pop",
    "git config",
    "git remote add",
    "git remote remove",
    "git remote rename",
    "git branch -d",
    "git branch -D",
    "git branch --delete",
    "git branch -m",
    "git branch -M",
    "git branch --move",
    "git tag -d",
    "git tag --delete",
    # Package managers (write operations)
    "pip install",
    "pip uninstall",
    "pip3 install",
    "pip3 uninstall",
    "uv pip",
    "npm install",
    "npm uninstall",
    "npm ci",
    "npm update",
    "npm link",
    "yarn add",
    "yarn remove",
    "yarn install",
    "pnpm add",
    "pnpm remove",
    "pnpm install",
    "apt install",
    "apt-get install",
    "apt remove",
    "apt-get remove",
    "cargo install",
    # sed in-place editing
    "sed -i",
    "sed --in-place",
)

# Interpreters that can execute arbitrary code
INTERPRETERS = frozenset(
    {
        "bash",
        "sh",
        "zsh",
        "dash",
        "ksh",
        "fish",
        "python",
        "python3",
        "node",
        "perl",
        "ruby",
    }
)

# Flags that trigger inline script execution per interpreter
INLINE_FLAGS = {
    "python": "-c",
    "python3": "-c",
    "node": "-e",
    "perl": "-e",
    "ruby": "-e",
    "bash": "-c",
    "sh": "-c",
    "zsh": "-c",
}


# ---------------------------------------------------------------------------
# Git-readonly allowlist
# ---------------------------------------------------------------------------

# Git subcommands that are safe (read-only)
GIT_SAFE_SUBCOMMANDS = frozenset(
    {
        "log",
        "blame",
        "show",
        "diff",
        "bisect",
        "reflog",
        "shortlog",
        "rev-parse",
        "rev-list",
        "branch",
        "tag",
        "remote",
        "status",
        "ls-files",
        "ls-tree",
        "cat-file",
        "describe",
        "name-rev",
        "grep",
        "for-each-ref",
        "count-objects",
        "fsck",
        "verify-commit",
        "verify-tag",
        "fetch",
        "stash",
        "notes",
        "worktree",
        "config",
        "help",
        "version",
    }
)

# Flags/subcommands that make an otherwise-safe git command destructive
GIT_RESTRICTED_ARGS = {
    "branch": {"-d", "-D", "-m", "-M", "--delete", "--move", "--copy", "-c", "-C"},
    "tag": {"-d", "--delete", "-f", "--force"},
    "remote": {"add", "remove", "rename", "set-url", "set-head", "prune"},
    "stash": {"drop", "clear", "pop", "apply", "push", "save", "create", "store"},
    "worktree": {"add", "remove", "prune", "repair", "move", "lock", "unlock"},
    "notes": {"add", "append", "copy", "edit", "merge", "prune", "remove"},
    "config": set(),  # blocked by default — only --get/--list allowed
}

# Non-git commands allowed in git-readonly mode
READONLY_UTILITIES = frozenset(
    {
        # File reading
        "cat",
        "head",
        "tail",
        "less",
        "more",
        "bat",
        # Text processing (non-destructive — sed without -i, awk)
        "wc",
        "sort",
        "uniq",
        "cut",
        "tr",
        "paste",
        "column",
        "fold",
        "sed",
        "awk",
        "gawk",
        # Search
        "grep",
        "egrep",
        "fgrep",
        "rg",
        "ag",
        "ack",
        # File/directory listing
        "find",
        "ls",
        "tree",
        "file",
        "stat",
        "du",
        "df",
        # Output
        "echo",
        "printf",
        # Comparison
        "diff",
        "comm",
        "cmp",
        # JSON/YAML processing
        "jq",
        "yq",
        # Path utilities
        "basename",
        "dirname",
        "realpath",
        "readlink",
        # System information
        "date",
        "cal",
        "env",
        "printenv",
        "id",
        "whoami",
        "uname",
        "hostname",
        "pwd",
        "uptime",
        "nproc",
        "arch",
        # Conditionals and builtins
        "true",
        "false",
        "test",
        "[",
        # Lookup
        "which",
        "type",
        "command",
        # Numeric/sequencing
        "seq",
        "expr",
        "bc",
        # Terminal
        "tput",
        "clear",
        # Checksums
        "md5sum",
        "sha256sum",
        "sha1sum",
        # Binary inspection
        "xxd",
        "od",
        "hexdump",
        "strings",
        # Network (stdout by default)
        "curl",
        # Remote access
        "ssh",
        # Code search
        "ast-grep",
        "sg",
    }
)


# ---------------------------------------------------------------------------
# Command parsing helpers
# ---------------------------------------------------------------------------


def _split_segments(command: str) -> list[str]:
    """Split command on ;  &&  ||  & (background) into segments.

    Handles line continuations (backslash-newline).  Does not attempt
    to parse quoted strings — intentionally over-splits for safety.
    """
    command = command.replace("\\\n", " ")
    # Split on ;  &&  ||  and lone & (not &&)
    segments = re.split(r"\s*(?:;|&&|\|\||(?<![&])&(?![&]))\s*", command)
    return [s.strip() for s in segments if s.strip()]


def _split_pipes(segment: str) -> list[str]:
    """Split a segment on | (single pipe, not ||)."""
    parts = re.split(r"(?<!\|)\|(?!\|)", segment)
    return [p.strip() for p in parts if p.strip()]


def _get_cmd_words(stage: str) -> list[str]:
    """Extract command words from a pipe stage, skipping env-var assignments."""
    words = stage.split()
    result = []
    for word in words:
        # Skip leading VAR=value assignments (but not flags like --foo=bar)
        if "=" in word and not word.startswith("-") and not result:
            continue
        result.append(word)
    return result


def _base_name(cmd: str) -> str:
    """Get base command name, stripping path prefix and leading backslash.

    Examples: /usr/bin/rm -> rm, \\rm -> rm, ./script.sh -> script.sh
    """
    cmd = cmd.lstrip("\\")
    return cmd.rsplit("/", 1)[-1] if "/" in cmd else cmd


def _resolve_prefix(words: list[str]) -> tuple[str, list[str]]:
    """Resolve through 'command' and 'builtin' prefixes.

    E.g. ``command rm file`` -> base='rm', words=['rm', 'file'].
    """
    if not words:
        return ("", [])
    base = _base_name(words[0])
    if base in ("command", "builtin"):
        rest = words[1:]
        # Skip flags belonging to command/builtin (e.g. command -v)
        while rest and rest[0].startswith("-"):
            rest = rest[1:]
        if rest:
            return (_base_name(rest[0]), rest)
        return ("", [])
    return (base, words)


def _has_redirect(command: str) -> bool:
    """Detect output redirections (> or >>) excluding >/dev/null.

    Returns True if the command writes to a file via shell redirection.
    May produce false positives for '>' inside quoted strings — this is
    intentional (safe-side).
    """
    # Strip harmless /dev/null redirections first
    cleaned = re.sub(r"[12]?>{1,2}\s*/dev/null", "", command)
    return bool(re.search(r"(?:^|[\s)])(?:[12])?>{1,2}\s*[^\s&|;]", cleaned))


def _has_command_substitution(command: str) -> bool:
    """Check if command contains $() or backtick command substitution."""
    return "$(" in command or "`" in command


def _extract_substitution_commands(command: str) -> list[str]:
    """Extract inner commands from $() and backtick substitutions."""
    inner: list[str] = []
    for m in re.finditer(r"\$\(([^)]+)\)", command):
        inner.append(m.group(1))
    for m in re.finditer(r"`([^`]+)`", command):
        inner.append(m.group(1))
    return inner


def _has_sed_inplace(words: list[str]) -> bool:
    """Check if a sed invocation uses in-place editing (-i)."""
    for w in words[1:]:
        if w == "-i" or w == "--in-place" or w.startswith("-i"):
            return True
        # Combined short flags like -ni
        if w.startswith("-") and not w.startswith("--") and "i" in w:
            return True
    return False


def _matches_prefix(cmd_words: list[str], prefix: str) -> bool:
    """Check if command words match a blocked prefix on word boundaries."""
    pwords = prefix.split()
    if len(cmd_words) < len(pwords):
        return False
    return cmd_words[: len(pwords)] == pwords


# ---------------------------------------------------------------------------
# Mode checkers
# ---------------------------------------------------------------------------


def check_general_readonly(command: str) -> str | None:
    """Block write commands in general-readonly mode.

    Returns:
        Error message if blocked, None if allowed.
    """
    # Global checks on the raw command string
    if _has_redirect(command):
        return "Blocked: output redirection (> or >>) is not allowed in read-only mode"

    # Recursively check command substitutions
    if _has_command_substitution(command):
        for inner in _extract_substitution_commands(command):
            result = check_general_readonly(inner)
            if result:
                return "Blocked: command substitution contains a write operation"

    # Check each segment and pipe stage
    for segment in _split_segments(command):
        for i, stage in enumerate(_split_pipes(segment)):
            words = _get_cmd_words(stage)
            if not words:
                continue

            base, words = _resolve_prefix(words)
            if not base:
                continue

            # Single-word blocked commands
            if base in WRITE_COMMANDS:
                return f"Blocked: '{base}' is not allowed in read-only mode"

            # Two-word blocked prefixes
            cmd_words = [base] + [w for w in words[1:]]
            for wp in WRITE_PREFIXES:
                if _matches_prefix(cmd_words, wp):
                    return f"Blocked: '{wp}' is not allowed in read-only mode"

            # Block piping into interpreters (e.g. curl ... | bash)
            if i > 0 and base in INTERPRETERS:
                return f"Blocked: piping into '{base}' is not allowed in read-only mode"

            # Block inline script execution (e.g. python3 -c "os.remove(...)")
            if base in INLINE_FLAGS:
                flag = INLINE_FLAGS[base]
                if flag in words[1:]:
                    return f"Blocked: '{base} {flag}' inline execution is not allowed in read-only mode"

    return None


def check_git_readonly(command: str) -> str | None:
    """Only allow git read commands and safe utilities (strict allowlist).

    Returns:
        Error message if blocked, None if allowed.
    """
    if _has_redirect(command):
        return "Blocked: output redirection is not allowed in read-only mode"

    if _has_command_substitution(command):
        for inner in _extract_substitution_commands(command):
            result = check_git_readonly(inner)
            if result:
                return "Blocked: command substitution contains a blocked operation"

    for segment in _split_segments(command):
        for i, stage in enumerate(_split_pipes(segment)):
            words = _get_cmd_words(stage)
            if not words:
                continue

            base, words = _resolve_prefix(words)
            if not base:
                continue

            # --- Git commands ---
            if base == "git":
                if len(words) < 2:
                    continue  # bare "git" is harmless

                # Resolve git global flags to find the real subcommand
                # e.g. git -C /path --no-pager log -> subcommand is "log"
                sub = None
                skip_next = False
                for w in words[1:]:
                    if skip_next:
                        skip_next = False
                        continue
                    if w in ("-C", "-c", "--git-dir", "--work-tree"):
                        skip_next = True
                        continue
                    if w.startswith("-"):
                        continue
                    sub = w
                    break

                if sub is None:
                    continue  # all flags, no subcommand — harmless

                if sub not in GIT_SAFE_SUBCOMMANDS:
                    return f"Blocked: 'git {sub}' is not allowed in read-only mode"

                # Check restricted arguments for certain subcommands
                if sub in GIT_RESTRICTED_ARGS:
                    restricted = GIT_RESTRICTED_ARGS[sub]

                    if sub == "config":
                        # Only allow --get, --get-all, --list, --get-regexp
                        safe_flags = {
                            "--get",
                            "--get-all",
                            "--list",
                            "-l",
                            "--get-regexp",
                        }
                        if not (set(words[2:]) & safe_flags):
                            return "Blocked: 'git config' is only allowed with --get or --list"

                    elif sub == "stash":
                        # Only allow "stash list" and "stash show"
                        if len(words) > 2 and words[2] not in ("list", "show"):
                            return f"Blocked: 'git stash {words[2]}' is not allowed in read-only mode"

                    else:
                        for w in words[2:]:
                            if w in restricted:
                                return f"Blocked: 'git {sub} {w}' is not allowed in read-only mode"

            # --- Allowed utilities ---
            elif base in READONLY_UTILITIES:
                # Special case: sed -i is destructive even though sed is allowed
                if base == "sed" and _has_sed_inplace(words):
                    return "Blocked: 'sed -i' (in-place edit) is not allowed in read-only mode"
                continue

            # --- Everything else is blocked ---
            else:
                return f"Blocked: '{base}' is not in the read-only allowlist"

    return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    mode = "general-readonly"
    for i, arg in enumerate(sys.argv):
        if arg == "--mode" and i + 1 < len(sys.argv):
            mode = sys.argv[i + 1]
            break

    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    tool_input = input_data.get("tool_input", {})
    command = tool_input.get("command", "")

    if not command or not command.strip():
        sys.exit(0)

    if mode == "git-readonly":
        error = check_git_readonly(command)
    else:
        error = check_general_readonly(command)

    if error:
        json.dump({"error": error}, sys.stdout)
        sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
