#!/usr/bin/env python3
"""
Advisory test runner — Stop hook that injects test results as context.

Reads the list of files edited this session (written by collect-edited-files.py),
maps them to affected test files, and runs only those tests. Skips entirely
if no files were edited. Results are returned as additionalContext so Claude
sees pass/fail info without being blocked.

Reads hook input from stdin (JSON). Returns JSON on stdout.
Always exits 0 (advisory, never blocking).
"""

import json
import os
import subprocess
import sys

TIMEOUT_SECONDS = 15


def get_edited_files(session_id: str) -> list[str]:
    """Read the list of files edited this session.

    Relies on collect-edited-files.py writing paths to a temp file.
    Returns deduplicated list of paths that still exist on disk.
    """
    tmp_path = f"/tmp/claude-edited-files-{session_id}"
    try:
        with open(tmp_path, "r") as f:
            raw = f.read()
    except OSError:
        return []

    seen: set[str] = set()
    result: list[str] = []
    for line in raw.strip().splitlines():
        path = line.strip()
        if path and path not in seen and os.path.isfile(path):
            seen.add(path)
            result.append(path)
    return result


def detect_test_framework(cwd: str) -> tuple[str, list[str]]:
    """Detect which test framework is available in the project.

    Returns:
        Tuple of (framework_name, base_command) or ("", []) if none found.
    """
    try:
        entries = set(os.listdir(cwd))
    except OSError:
        return ("", [])

    # --- Python: pytest ---
    if "pytest.ini" in entries or "conftest.py" in entries:
        return ("pytest", ["python3", "-m", "pytest", "--tb=short", "-q"])

    for cfg_name in ("pyproject.toml", "setup.cfg", "tox.ini"):
        cfg_path = os.path.join(cwd, cfg_name)
        if os.path.isfile(cfg_path):
            try:
                with open(cfg_path, "r", encoding="utf-8") as f:
                    content = f.read()
                if (
                    "[tool.pytest" in content
                    or "[pytest]" in content
                    or "[tool:pytest]" in content
                ):
                    return ("pytest", ["python3", "-m", "pytest", "--tb=short", "-q"])
            except OSError:
                pass

    if "tests" in entries and os.path.isdir(os.path.join(cwd, "tests")):
        return ("pytest", ["python3", "-m", "pytest", "--tb=short", "-q"])

    for entry in entries:
        if entry.startswith("test_") and entry.endswith(".py"):
            return ("pytest", ["python3", "-m", "pytest", "--tb=short", "-q"])

    # --- JavaScript: vitest ---
    for name in entries:
        if name.startswith("vitest.config"):
            return ("vitest", ["npx", "vitest", "run", "--reporter=verbose"])

    for vite_cfg in ("vite.config.ts", "vite.config.js"):
        cfg_path = os.path.join(cwd, vite_cfg)
        if os.path.isfile(cfg_path):
            try:
                with open(cfg_path, "r", encoding="utf-8") as f:
                    if "test" in f.read():
                        return (
                            "vitest",
                            ["npx", "vitest", "run", "--reporter=verbose"],
                        )
            except OSError:
                pass

    # --- JavaScript: jest ---
    for name in entries:
        if name.startswith("jest.config"):
            return ("jest", ["npx", "jest", "--verbose"])

    pkg_json = os.path.join(cwd, "package.json")
    if os.path.isfile(pkg_json):
        try:
            with open(pkg_json, "r", encoding="utf-8") as f:
                pkg = json.loads(f.read())

            if "jest" in pkg:
                return ("jest", ["npx", "jest", "--verbose"])

            dev_deps = pkg.get("devDependencies", {})
            deps = pkg.get("dependencies", {})

            if "mocha" in dev_deps or "mocha" in deps:
                return ("mocha", ["npx", "mocha", "--reporter", "spec"])

            test_script = pkg.get("scripts", {}).get("test", "")
            if test_script and "no test specified" not in test_script:
                return ("npm-test", ["npm", "test"])
        except (OSError, json.JSONDecodeError):
            pass

    # --- Go ---
    if "go.mod" in entries:
        return ("go", ["go", "test", "-count=1"])

    # --- Rust ---
    if "Cargo.toml" in entries:
        return ("cargo", ["cargo", "test"])

    return ("", [])


def resolve_pytest_tests(edited_files: list[str], cwd: str) -> tuple[list[str], bool]:
    """Map edited Python files to their corresponding pytest test files.

    Returns:
        (test_files, run_all) — if run_all is True, run the whole suite
        (e.g. conftest.py was edited).
    """
    test_files: list[str] = []

    for path in edited_files:
        if not path.endswith(".py"):
            continue

        basename = os.path.basename(path)

        # conftest changes can affect anything — run full suite
        if basename == "conftest.py":
            return ([], True)

        # Already a test file — include directly
        if basename.startswith("test_") or "/tests/" in path:
            if os.path.isfile(path):
                test_files.append(path)
            continue

        # Map source → test via directory mirroring
        # e.g. src/engine/db/sessions.py → tests/engine/db/test_sessions.py
        # e.g. src/engine/api/routes/github.py → tests/engine/api/test_routes_github.py
        rel = os.path.relpath(path, cwd)
        parts = rel.split(os.sep)

        # Strip leading "src/" if present
        if parts and parts[0] == "src":
            parts = parts[1:]

        if not parts:
            continue

        module = parts[-1]  # e.g. "sessions.py"
        module_name = module.removesuffix(".py")
        parent_parts = parts[:-1]  # e.g. ["engine", "db"]

        # Standard mapping: tests/<parent>/test_<module>.py
        test_path = os.path.join(cwd, "tests", *parent_parts, f"test_{module_name}.py")
        if os.path.isfile(test_path):
            test_files.append(test_path)
            continue

        # Routes mapping: src/engine/api/routes/github.py
        # → tests/engine/api/test_routes_github.py
        if len(parent_parts) >= 2 and parent_parts[-1] == "routes":
            route_test = os.path.join(
                cwd,
                "tests",
                *parent_parts[:-1],
                f"test_routes_{module_name}.py",
            )
            if os.path.isfile(route_test):
                test_files.append(route_test)

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for t in test_files:
        if t not in seen:
            seen.add(t)
            unique.append(t)

    return (unique, False)


def resolve_affected_tests(
    edited_files: list[str], cwd: str, framework: str
) -> tuple[list[str], bool]:
    """Resolve edited files to framework-specific test arguments.

    Returns:
        (extra_args, run_all) — extra_args to append to the base command.
        If run_all is True, run the whole suite (no extra args needed).
        If extra_args is empty and run_all is False, skip testing entirely.
    """
    if framework == "pytest":
        test_files, run_all = resolve_pytest_tests(edited_files, cwd)
        return (test_files, run_all)

    if framework == "vitest":
        # vitest --related does dep-graph analysis natively
        source_files = [
            f
            for f in edited_files
            if not f.endswith(
                (".md", ".json", ".yaml", ".yml", ".toml", ".txt", ".css")
            )
        ]
        if not source_files:
            return ([], False)
        return (["--related"] + source_files, False)

    if framework == "jest":
        source_files = [
            f
            for f in edited_files
            if not f.endswith(
                (".md", ".json", ".yaml", ".yml", ".toml", ".txt", ".css")
            )
        ]
        if not source_files:
            return ([], False)
        return (["--findRelatedTests"] + source_files, False)

    if framework == "go":
        # Map edited .go files to their package directories
        pkgs: set[str] = set()
        for path in edited_files:
            if path.endswith(".go"):
                pkg_dir = os.path.dirname(path)
                rel = os.path.relpath(pkg_dir, cwd)
                pkgs.add(f"./{rel}")
        if not pkgs:
            return ([], False)
        return (sorted(pkgs), False)

    # cargo, mocha, npm-test — no granular selection, run full suite
    code_files = [
        f
        for f in edited_files
        if not f.endswith((".md", ".json", ".yaml", ".yml", ".toml", ".txt"))
    ]
    if not code_files:
        return ([], False)
    return ([], True)


def main():
    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    # Skip if another Stop hook is already blocking
    if input_data.get("stop_hook_active"):
        sys.exit(0)

    session_id = input_data.get("session_id", "")
    if not session_id:
        sys.exit(0)

    # No files edited this session — nothing to test
    edited_files = get_edited_files(session_id)
    if not edited_files:
        sys.exit(0)

    cwd = os.getcwd()
    framework, base_cmd = detect_test_framework(cwd)

    if not framework:
        sys.exit(0)

    extra_args, run_all = resolve_affected_tests(edited_files, cwd, framework)

    # No affected tests and not a run-all situation — skip
    if not extra_args and not run_all:
        sys.exit(0)

    cmd = base_cmd + extra_args

    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired:
        json.dump(
            {
                "additionalContext": f"[Tests] {framework} timed out after {TIMEOUT_SECONDS}s"
            },
            sys.stdout,
        )
        sys.exit(0)
    except (FileNotFoundError, OSError):
        sys.exit(0)

    output = (result.stdout + "\n" + result.stderr).strip()

    if result.returncode == 0:
        json.dump(
            {"additionalContext": f"[Tests] All tests passed ({framework})"},
            sys.stdout,
        )
        sys.exit(0)

    # Tests failed — truncate to last 30 lines
    if not output:
        output = "(no test output)"

    lines = output.splitlines()
    if len(lines) > 30:
        output = "...(truncated)\n" + "\n".join(lines[-30:])

    json.dump(
        {"additionalContext": (f"[Tests] Some tests FAILED ({framework}):\n{output}")},
        sys.stdout,
    )
    sys.exit(0)


if __name__ == "__main__":
    main()
