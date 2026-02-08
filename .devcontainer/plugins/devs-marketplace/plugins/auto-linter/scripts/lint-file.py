#!/usr/bin/env python3
"""
Batch linter — runs as a Stop hook.

Reads file paths collected by collect-edited-files.py during the
conversation turn, deduplicates them, and lints each based on
extension:
  .py / .pyi  → Pyright

Outputs JSON with additionalContext containing lint warnings.
Always cleans up the temp file. Always exits 0.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

PYTHON_EXTENSIONS = {".py", ".pyi"}


def lint_python(file_path: str) -> str:
    """Run pyright on a Python file. Returns diagnostic message or empty string."""
    pyright_cmd = "pyright"

    try:
        subprocess.run(["which", pyright_cmd], capture_output=True, check=True)
    except subprocess.CalledProcessError:
        return ""

    try:
        result = subprocess.run(
            [pyright_cmd, "--outputjson", file_path],
            capture_output=True,
            text=True,
            timeout=10,
        )

        try:
            output = json.loads(result.stdout)
            diagnostics = output.get("generalDiagnostics", [])

            if not diagnostics:
                return ""

            issues = []
            for diag in diagnostics[:5]:
                severity = diag.get("severity", "info")
                message = diag.get("message", "")
                line = diag.get("range", {}).get("start", {}).get("line", 0) + 1

                if severity == "error":
                    icon = "\u2717"
                elif severity == "warning":
                    icon = "!"
                else:
                    icon = "\u2022"

                issues.append(f"  {icon} Line {line}: {message}")

            total = len(diagnostics)
            shown = min(5, total)
            filename = Path(file_path).name
            header = f"  {filename}: {total} issue(s)"
            if total > shown:
                header += f" (showing first {shown})"

            return header + "\n" + "\n".join(issues)

        except json.JSONDecodeError:
            return ""

    except subprocess.TimeoutExpired:
        return f"  {Path(file_path).name}: pyright timed out"
    except Exception:
        return ""


def main():
    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    if input_data.get("stop_hook_active"):
        sys.exit(0)

    session_id = input_data.get("session_id", "")
    if not session_id:
        sys.exit(0)

    tmp_path = f"/tmp/claude-lint-files-{session_id}"

    try:
        with open(tmp_path) as f:
            raw_paths = f.read().splitlines()
    except FileNotFoundError:
        sys.exit(0)
    except OSError:
        sys.exit(0)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    # Deduplicate, filter to existing Python files
    seen: set[str] = set()
    paths: list[str] = []
    for p in raw_paths:
        p = p.strip()
        if p and p not in seen and os.path.isfile(p):
            ext = Path(p).suffix.lower()
            if ext in PYTHON_EXTENSIONS:
                seen.add(p)
                paths.append(p)

    if not paths:
        sys.exit(0)

    results = []
    for path in paths:
        msg = lint_python(path)
        if msg:
            results.append(msg)

    if results:
        output = "[Auto-linter] Pyright results:\n" + "\n".join(results)
        print(json.dumps({"additionalContext": output}))

    sys.exit(0)


if __name__ == "__main__":
    main()
