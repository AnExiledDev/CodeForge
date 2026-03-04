#!/usr/bin/env python3
"""
Batch linter — runs as a Stop hook.

Reads file paths collected by collect-edited-files.py during the
conversation turn, deduplicates them, and lints each based on
extension:
  .py / .pyi         → Pyright (type checking) + Ruff check (style/correctness)
  .js/.jsx/.ts/…     → Biome lint
  .css/.graphql/…    → Biome lint
  .sh/.bash/.zsh/…   → ShellCheck
  .go                → go vet
  Dockerfile         → hadolint
  .rs                → clippy (conditional)

Outputs JSON with additionalContext containing lint warnings.
Always cleans up the temp file. Always exits 0.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

# ── Extension sets ──────────────────────────────────────────────────

PYTHON_EXTS = {".py", ".pyi"}
BIOME_EXTS = {
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".mjs",
    ".cjs",
    ".mts",
    ".cts",
    ".css",
    ".graphql",
    ".gql",
}
SHELL_EXTS = {".sh", ".bash", ".zsh", ".mksh", ".bats"}
GO_EXTS = {".go"}
RUST_EXTS = {".rs"}

SUBPROCESS_TIMEOUT = 10


# ── Tool resolution ─────────────────────────────────────────────────


def _which(name: str) -> str | None:
    """Check if a tool is available in PATH."""
    try:
        result = subprocess.run(["which", name], capture_output=True, text=True)
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return None


def _find_tool_upward(file_path: str, tool_name: str) -> str | None:
    """Walk up from file directory looking for node_modules/.bin/<tool>."""
    current = Path(file_path).parent
    for _ in range(20):
        candidate = current / "node_modules" / ".bin" / tool_name
        if candidate.is_file():
            return str(candidate)
        parent = current.parent
        if parent == current:
            break
        current = parent
    return None


def _find_biome(file_path: str) -> str | None:
    """Find biome binary: project-local first, then global."""
    local = _find_tool_upward(file_path, "biome")
    if local:
        return local
    return _which("biome")


# ── Diagnostic formatting ──────────────────────────────────────────


def _format_issues(filename: str, diagnostics: list[dict]) -> str:
    """Format a list of {severity, line, message} dicts into display text."""
    if not diagnostics:
        return ""

    issues = []
    for diag in diagnostics[:5]:
        severity = diag.get("severity", "info")
        message = diag.get("message", "")
        line = diag.get("line", 0)

        if severity == "error":
            icon = "\u2717"
        elif severity == "warning":
            icon = "!"
        else:
            icon = "\u2022"

        issues.append(f"  {icon} Line {line}: {message}")

    total = len(diagnostics)
    shown = min(5, total)
    header = f"  {filename}: {total} issue(s)"
    if total > shown:
        header += f" (showing first {shown})"

    return header + "\n" + "\n".join(issues)


# ── Linters ─────────────────────────────────────────────────────────


def lint_python_pyright(file_path: str) -> str:
    """Run Pyright type checker on a Python file."""
    pyright = _which("pyright")
    if not pyright:
        return ""

    try:
        result = subprocess.run(
            [pyright, "--outputjson", file_path],
            capture_output=True,
            text=True,
            timeout=SUBPROCESS_TIMEOUT,
        )

        try:
            output = json.loads(result.stdout)
        except json.JSONDecodeError:
            return ""

        diagnostics = output.get("generalDiagnostics", [])
        if not diagnostics:
            return ""

        parsed = [
            {
                "severity": d.get("severity", "info"),
                "line": d.get("range", {}).get("start", {}).get("line", 0) + 1,
                "message": d.get("message", ""),
            }
            for d in diagnostics
        ]
        return _format_issues(Path(file_path).name, parsed)

    except subprocess.TimeoutExpired:
        return f"  {Path(file_path).name}: pyright timed out"
    except Exception:
        return ""


def lint_python_ruff(file_path: str) -> str:
    """Run Ruff linter on a Python file."""
    ruff = _which("ruff")
    if not ruff:
        return ""

    try:
        result = subprocess.run(
            [ruff, "check", "--output-format=json", "--no-fix", file_path],
            capture_output=True,
            text=True,
            timeout=SUBPROCESS_TIMEOUT,
        )

        try:
            issues = json.loads(result.stdout)
        except json.JSONDecodeError:
            return ""

        if not issues:
            return ""

        parsed = [
            {
                "severity": "warning",
                "line": issue.get("location", {}).get("row", 0),
                "message": f"[{issue.get('code', '?')}] {issue.get('message', '')}",
            }
            for issue in issues
        ]
        return _format_issues(Path(file_path).name, parsed)

    except subprocess.TimeoutExpired:
        return f"  {Path(file_path).name}: ruff timed out"
    except Exception:
        return ""


def lint_biome(file_path: str) -> str:
    """Run Biome linter for JS/TS/CSS/GraphQL files."""
    biome = _find_biome(file_path)
    if not biome:
        return ""

    try:
        result = subprocess.run(
            [biome, "lint", "--reporter=json", file_path],
            capture_output=True,
            text=True,
            timeout=SUBPROCESS_TIMEOUT,
        )

        try:
            output = json.loads(result.stdout)
        except json.JSONDecodeError:
            return ""

        diagnostics = output.get("diagnostics", [])
        if not diagnostics:
            return ""

        parsed = [
            {
                "severity": d.get("severity", "warning"),
                "line": (
                    d.get("location", {}).get("span", {}).get("start", {})
                    if isinstance(
                        d.get("location", {}).get("span", {}).get("start"), int
                    )
                    else 0
                ),
                "message": d.get("description", d.get("message", "")),
            }
            for d in diagnostics
        ]
        return _format_issues(Path(file_path).name, parsed)

    except subprocess.TimeoutExpired:
        return f"  {Path(file_path).name}: biome lint timed out"
    except Exception:
        return ""


def lint_shellcheck(file_path: str) -> str:
    """Run ShellCheck on a shell script."""
    shellcheck = _which("shellcheck")
    if not shellcheck:
        return ""

    try:
        result = subprocess.run(
            [shellcheck, "--format=json", file_path],
            capture_output=True,
            text=True,
            timeout=SUBPROCESS_TIMEOUT,
        )

        try:
            issues = json.loads(result.stdout)
        except json.JSONDecodeError:
            return ""

        if not issues:
            return ""

        severity_map = {
            "error": "error",
            "warning": "warning",
            "info": "info",
            "style": "info",
        }
        parsed = [
            {
                "severity": severity_map.get(issue.get("level", "info"), "info"),
                "line": issue.get("line", 0),
                "message": f"[SC{issue.get('code', '?')}] {issue.get('message', '')}",
            }
            for issue in issues
        ]
        return _format_issues(Path(file_path).name, parsed)

    except subprocess.TimeoutExpired:
        return f"  {Path(file_path).name}: shellcheck timed out"
    except Exception:
        return ""


def lint_go_vet(file_path: str) -> str:
    """Run go vet on a Go file."""
    go = _which("go")
    if not go:
        return ""

    try:
        result = subprocess.run(
            [go, "vet", file_path],
            capture_output=True,
            text=True,
            timeout=SUBPROCESS_TIMEOUT,
        )

        # go vet outputs to stderr
        output = result.stderr.strip()
        if not output:
            return ""

        lines = output.splitlines()
        parsed = []
        for line in lines:
            # Format: file.go:LINE:COL: message
            parts = line.split(":", 3)
            if len(parts) >= 4:
                try:
                    line_num = int(parts[1])
                except ValueError:
                    line_num = 0
                parsed.append(
                    {
                        "severity": "warning",
                        "line": line_num,
                        "message": parts[3].strip(),
                    }
                )
            elif line.strip():
                parsed.append(
                    {
                        "severity": "warning",
                        "line": 0,
                        "message": line.strip(),
                    }
                )

        return _format_issues(Path(file_path).name, parsed)

    except subprocess.TimeoutExpired:
        return f"  {Path(file_path).name}: go vet timed out"
    except Exception:
        return ""


def lint_hadolint(file_path: str) -> str:
    """Run hadolint on a Dockerfile."""
    hadolint = _which("hadolint")
    if not hadolint:
        return ""

    try:
        result = subprocess.run(
            [hadolint, "--format", "json", file_path],
            capture_output=True,
            text=True,
            timeout=SUBPROCESS_TIMEOUT,
        )

        try:
            issues = json.loads(result.stdout)
        except json.JSONDecodeError:
            return ""

        if not issues:
            return ""

        severity_map = {
            "error": "error",
            "warning": "warning",
            "info": "info",
            "style": "info",
        }
        parsed = [
            {
                "severity": severity_map.get(issue.get("level", "info"), "info"),
                "line": issue.get("line", 0),
                "message": f"[{issue.get('code', '?')}] {issue.get('message', '')}",
            }
            for issue in issues
        ]
        return _format_issues(Path(file_path).name, parsed)

    except subprocess.TimeoutExpired:
        return f"  {Path(file_path).name}: hadolint timed out"
    except Exception:
        return ""


def lint_clippy(file_path: str) -> str:
    """Run clippy on a Rust file (conditional — only if cargo is in PATH)."""
    cargo = _which("cargo")
    if not cargo:
        return ""

    try:
        result = subprocess.run(
            [cargo, "clippy", "--message-format=json", "--", "-W", "clippy::all"],
            capture_output=True,
            text=True,
            timeout=SUBPROCESS_TIMEOUT,
            cwd=str(Path(file_path).parent),
        )

        lines = result.stdout.strip().splitlines()
        parsed = []
        target_name = Path(file_path).name

        for line in lines:
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue

            if msg.get("reason") != "compiler-message":
                continue
            inner = msg.get("message", {})
            level = inner.get("level", "")
            if level not in ("warning", "error"):
                continue

            # Match diagnostics to the target file
            spans = inner.get("spans", [])
            line_num = 0
            for span in spans:
                if span.get("is_primary") and target_name in span.get("file_name", ""):
                    line_num = span.get("line_start", 0)
                    break

            if line_num or not spans:
                parsed.append(
                    {
                        "severity": level,
                        "line": line_num,
                        "message": inner.get("message", ""),
                    }
                )

        return _format_issues(Path(file_path).name, parsed)

    except subprocess.TimeoutExpired:
        return f"  {Path(file_path).name}: clippy timed out"
    except Exception:
        return ""


# ── Main ────────────────────────────────────────────────────────────


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

    tmp_path = f"/tmp/claude-cq-lint-{session_id}"

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

    # Deduplicate, filter to existing files
    seen: set[str] = set()
    paths: list[str] = []
    for p in raw_paths:
        p = p.strip()
        if p and p not in seen and os.path.isfile(p):
            seen.add(p)
            paths.append(p)

    if not paths:
        sys.exit(0)

    # Collect results grouped by linter
    all_results: dict[str, list[str]] = {}

    for path in paths:
        ext = Path(path).suffix.lower()
        name = Path(path).name

        if ext in PYTHON_EXTS:
            msg = lint_python_pyright(path)
            if msg:
                all_results.setdefault("Pyright", []).append(msg)
            msg = lint_python_ruff(path)
            if msg:
                all_results.setdefault("Ruff", []).append(msg)

        elif ext in BIOME_EXTS:
            msg = lint_biome(path)
            if msg:
                all_results.setdefault("Biome", []).append(msg)

        elif ext in SHELL_EXTS:
            msg = lint_shellcheck(path)
            if msg:
                all_results.setdefault("ShellCheck", []).append(msg)

        elif ext in GO_EXTS:
            msg = lint_go_vet(path)
            if msg:
                all_results.setdefault("go vet", []).append(msg)

        elif name == "Dockerfile" or ext == ".dockerfile":
            msg = lint_hadolint(path)
            if msg:
                all_results.setdefault("hadolint", []).append(msg)

        elif ext in RUST_EXTS:
            msg = lint_clippy(path)
            if msg:
                all_results.setdefault("clippy", []).append(msg)

    if all_results:
        sections = []
        for linter_name, results in all_results.items():
            sections.append(
                f"[Auto-linter] {linter_name} results:\n" + "\n".join(results)
            )
        output = "\n\n".join(sections)
        print(json.dumps({"additionalContext": output}))

    sys.exit(0)


if __name__ == "__main__":
    main()
