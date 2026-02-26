#!/usr/bin/env python3
"""
Nuclear workspace scope enforcement.

Blocks ALL operations (read, write, bash) outside the current working directory.
Permanently blacklists /workspaces/.devcontainer/ — no exceptions, no bypass.
Bash enforcement via two-layer detection: write target extraction + workspace path scan.
Fails closed on any error.

Exit code 2 blocks the operation with an error message.
Exit code 0 allows the operation to proceed.
"""

import json
import os
import re
import shlex
import sys

# ---------------------------------------------------------------------------
# BLACKLIST — checked FIRST, overrides everything.
# Nothing touches these paths. Ever. No exceptions.
# Checked before allowlist, before scope check, before cwd bypass.
# ---------------------------------------------------------------------------
BLACKLISTED_PREFIXES = [
    "/workspaces/.devcontainer/",
    "/workspaces/.devcontainer",  # exact match (no trailing slash)
]

# Paths always allowed regardless of working directory
_home = os.environ.get("HOME", "/home/vscode")
ALLOWED_PREFIXES = [
    f"{_home}/.claude/",     # Claude config, plans, rules
    "/tmp/",                 # System scratch
]

WRITE_TOOLS = {"Write", "Edit", "NotebookEdit"}
READ_TOOLS = {"Read", "Glob", "Grep"}
ALL_FILE_TOOLS = WRITE_TOOLS | READ_TOOLS

# Tool input field that contains the target path
PATH_FIELDS = {
    "Read": "file_path",
    "Write": "file_path",
    "Edit": "file_path",
    "NotebookEdit": "notebook_path",
    "Glob": "path",
    "Grep": "path",
}

# ---------------------------------------------------------------------------
# Bash Layer 1: Write target patterns
# Ported from guard-protected-bash.py + new patterns
# ---------------------------------------------------------------------------
WRITE_PATTERNS = [
    # --- Ported from guard-protected-bash.py ---
    r"(?:>|>>)\s*([^\s;&|]+)",                                              # > file, >> file
    r"\btee\s+(?:-a\s+)?([^\s;&|]+)",                                       # tee file
    r"\b(?:cp|mv)\s+(?:-[^\s]+\s+)*[^\s]+\s+([^\s;&|]+)",                  # cp/mv src dest
    r'\bsed\s+-i[^\s]*\s+(?:\'[^\']*\'\s+|"[^"]*"\s+|[^\s]+\s+)*([^\s;&|]+)',  # sed -i
    r"\bcat\s+(?:<<[^\s]*\s+)?>\s*([^\s;&|]+)",                            # cat > file
    # --- New patterns ---
    r"\btouch\s+(?:-[^\s]+\s+)*([^\s;&|]+)",                               # touch file
    r"\bmkdir\s+(?:-[^\s]+\s+)*([^\s;&|]+)",                               # mkdir [-p] dir
    r"\brm\s+(?:-[^\s]+\s+)*([^\s;&|]+)",                                  # rm [-rf] path
    r"\bln\s+(?:-[^\s]+\s+)*[^\s]+\s+([^\s;&|]+)",                         # ln [-s] src dest
    r"\binstall\s+(?:-[^\s]+\s+)*[^\s]+\s+([^\s;&|]+)",                    # install src dest
    r"\brsync\s+(?:-[^\s]+\s+)*[^\s]+\s+([^\s;&|]+)",                      # rsync src dest
    r"\bchmod\s+(?:-[^\s]+\s+)*[^\s]+\s+([^\s;&|]+)",                      # chmod mode path
    r"\bchown\s+(?:-[^\s]+\s+)*[^\s:]+(?::[^\s]+)?\s+([^\s;&|]+)",         # chown owner[:group] path
    r"\bdd\b[^;|&]*\bof=([^\s;&|]+)",                                      # dd of=path
    r"\bwget\s+(?:-[^\s]+\s+)*-O\s+([^\s;&|]+)",                           # wget -O path
    r"\bcurl\s+(?:-[^\s]+\s+)*-o\s+([^\s;&|]+)",                           # curl -o path
    r"\btar\s+(?:-[^\s]+\s+)*-C\s+([^\s;&|]+)",                            # tar -C dir
    r"\bunzip\s+(?:-[^\s]+\s+)*-d\s+([^\s;&|]+)",                          # unzip -d dir
    r"\b(?:gcc|g\+\+|cc|c\+\+|clang)\s+(?:-[^\s]+\s+)*-o\s+([^\s;&|]+)",  # gcc -o out
    r"\bsqlite3\s+([^\s;&|]+)",                                            # sqlite3 dbpath
]

# ---------------------------------------------------------------------------
# Bash Layer 2: Workspace path scan (ALWAYS runs, never exempt)
# Stops at: whitespace, ;, |, &, >, ), <, ', "
# ---------------------------------------------------------------------------
WORKSPACE_PATH_RE = re.compile(r'/workspaces/[^\s;|&>)<\'"]+')

# ---------------------------------------------------------------------------
# System command exemption (Layer 1 only)
# ---------------------------------------------------------------------------
SYSTEM_COMMANDS = frozenset({
    "git", "pip", "pip3", "npm", "npx", "yarn", "pnpm",
    "apt-get", "apt", "cargo", "go", "docker", "make", "cmake",
    "node", "python3", "python", "ruby", "gem", "bundle",
})

SYSTEM_PATH_PREFIXES = (
    "/usr/", "/bin/", "/sbin/", "/lib/", "/opt/",
    "/proc/", "/sys/", "/dev/", "/var/", "/etc/",
)


# ---------------------------------------------------------------------------
# Core check functions
# ---------------------------------------------------------------------------

def is_blacklisted(resolved_path: str) -> bool:
    """Check if resolved_path is under a permanently blocked directory."""
    return (resolved_path == "/workspaces/.devcontainer"
            or resolved_path.startswith("/workspaces/.devcontainer/"))


def is_in_scope(resolved_path: str, cwd: str) -> bool:
    """Check if resolved_path is within the working directory."""
    cwd_prefix = cwd if cwd.endswith("/") else cwd + "/"
    return resolved_path == cwd or resolved_path.startswith(cwd_prefix)


def is_allowlisted(resolved_path: str) -> bool:
    """Check if resolved_path falls under an allowed prefix."""
    return any(resolved_path.startswith(prefix) for prefix in ALLOWED_PREFIXES)


def get_target_path(tool_name: str, tool_input: dict) -> str | None:
    """Extract the target path from tool input.

    Returns None if no path field is present or the field is empty,
    which means the tool defaults to cwd (always in scope).
    """
    field = PATH_FIELDS.get(tool_name)
    if not field:
        return None
    return tool_input.get(field) or None


# ---------------------------------------------------------------------------
# Bash enforcement
# ---------------------------------------------------------------------------

def extract_write_targets(command: str) -> list[str]:
    """Extract file paths that the command writes to (Layer 1)."""
    targets = []
    for pattern in WRITE_PATTERNS:
        for match in re.finditer(pattern, command):
            target = match.group(1).strip("'\"")
            if target:
                targets.append(target)
    return targets


def extract_primary_command(command: str) -> str:
    """Extract the primary command, stripping sudo/env/variable prefixes."""
    try:
        tokens = shlex.split(command)
    except ValueError:
        # Unclosed quotes or other parse errors — no exemption
        return ""
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        # Skip inline variable assignments: VAR=value
        if "=" in tok and not tok.startswith("-") and tok.split("=")[0].isidentifier():
            i += 1
            continue
        # Skip sudo and its flags
        if tok == "sudo":
            i += 1
            while i < len(tokens) and tokens[i].startswith("-"):
                flag = tokens[i]
                i += 1
                # Flags that consume the next token as an argument
                if flag in ("-u", "-g", "-C", "-D", "-R", "-T"):
                    i += 1  # skip the argument too
            continue
        # Skip env and its variable assignments
        if tok == "env":
            i += 1
            while i < len(tokens):
                if "=" in tokens[i] and not tokens[i].startswith("-"):
                    i += 1  # skip VAR=val
                elif tokens[i].startswith("-"):
                    i += 1  # skip env flags (-i, etc.)
                else:
                    break
            continue
        # Skip nohup, nice, time
        if tok in ("nohup", "nice", "time"):
            i += 1
            continue
        return tok
    return ""


def check_bash_scope(command: str, cwd: str) -> None:
    """Enforce scope on Bash commands. Calls sys.exit(2) on violation."""
    if not command:
        return

    # --- Extract paths from command ---
    write_targets = extract_write_targets(command)
    workspace_paths = WORKSPACE_PATH_RE.findall(command)

    # --- BLACKLIST check (FIRST — before cwd bypass, before everything) ---
    # Early exit on first blacklisted path found
    for target in write_targets:
        resolved = os.path.realpath(target.strip("'\""))
        if is_blacklisted(resolved):
            print(
                f"Blocked: Bash command writes to blacklisted path '{target}'. "
                f"/workspaces/.devcontainer/ is permanently blocked.",
                file=sys.stderr,
            )
            sys.exit(2)

    for path_str in workspace_paths:
        resolved = os.path.realpath(path_str)
        if is_blacklisted(resolved):
            print(
                f"Blocked: Bash command references blacklisted path '{path_str}'. "
                f"/workspaces/.devcontainer/ is permanently blocked.",
                file=sys.stderr,
            )
            sys.exit(2)

    # --- cwd=/workspaces bypass (blacklist already checked above) ---
    if cwd == "/workspaces":
        return

    # --- Layer 1: Write target scope check ---
    if write_targets:
        primary_cmd = extract_primary_command(command)
        is_system_cmd = primary_cmd in SYSTEM_COMMANDS

        resolved_targets = [
            (t, os.path.realpath(t.strip("'\""))) for t in write_targets
        ]

        # System command exemption: skip Layer 1 ONLY if ALL targets are system paths
        skip_layer1 = False
        if is_system_cmd:
            skip_layer1 = all(
                any(r.startswith(sp) for sp in SYSTEM_PATH_PREFIXES)
                for _, r in resolved_targets
            )
            # Override: if ANY target is under /workspaces/ outside cwd → NOT exempt
            if skip_layer1:
                for _, resolved in resolved_targets:
                    if resolved.startswith("/workspaces/") and not is_in_scope(resolved, cwd):
                        skip_layer1 = False
                        break

        if not skip_layer1:
            for target, resolved in resolved_targets:
                if not is_in_scope(resolved, cwd) and not is_allowlisted(resolved):
                    print(
                        f"Blocked: Bash command writes to '{target}' which is "
                        f"outside the working directory ({cwd}).",
                        file=sys.stderr,
                    )
                    sys.exit(2)

    # --- Layer 2: Workspace path scan (ALWAYS runs, never exempt) ---
    for path_str in workspace_paths:
        resolved = os.path.realpath(path_str)
        if not is_in_scope(resolved, cwd) and not is_allowlisted(resolved):
            print(
                f"Blocked: Bash command references '{path_str}' which is "
                f"outside the working directory ({cwd}).",
                file=sys.stderr,
            )
            sys.exit(2)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    try:
        input_data = json.load(sys.stdin)
        tool_name = input_data.get("tool_name", "")
        tool_input = input_data.get("tool_input", {})

        cwd = os.getcwd()

        # --- Bash tool: separate code path ---
        if tool_name == "Bash":
            check_bash_scope(tool_input.get("command", ""), cwd)
            sys.exit(0)

        # --- File tools ---
        target_path = get_target_path(tool_name, tool_input)

        # No path → tool defaults to cwd, always in scope (for known file tools)
        if target_path is None:
            if tool_name in ALL_FILE_TOOLS:
                sys.exit(0)
            # Unknown tool with no recognizable path → block
            print(
                f"Blocked: Unknown tool '{tool_name}' — not in scope guard allowlist.",
                file=sys.stderr,
            )
            sys.exit(2)

        resolved = os.path.realpath(target_path)

        # BLACKLIST — checked FIRST, before cwd bypass
        if is_blacklisted(resolved):
            print(
                f"Blocked: {tool_name} targets '{target_path}' which is under "
                f"blacklisted path /workspaces/.devcontainer/. This path is "
                f"permanently blocked for all operations.",
                file=sys.stderr,
            )
            sys.exit(2)

        # cwd=/workspaces bypass (blacklist already checked)
        if cwd == "/workspaces":
            sys.exit(0)

        # In-scope check
        if is_in_scope(resolved, cwd):
            sys.exit(0)

        # Allowlist check
        if is_allowlisted(resolved):
            sys.exit(0)

        # Out of scope — BLOCK for ALL tools
        print(
            f"Blocked: {tool_name} targets '{target_path}' which is outside "
            f"the working directory ({cwd}). Move to that project's directory "
            f"first or work from /workspaces.",
            file=sys.stderr,
        )
        sys.exit(2)

    except json.JSONDecodeError:
        sys.exit(2)
    except Exception as e:
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
