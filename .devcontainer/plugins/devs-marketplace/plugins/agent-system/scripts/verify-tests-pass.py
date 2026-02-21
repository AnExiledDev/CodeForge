#!/usr/bin/env python3
"""
Verify tests pass - Stop hook for test-writer agent.

Detects the project's test framework and runs the test suite to verify
that tests written by the agent actually pass.

Reads hook input from stdin (JSON). Returns JSON on stdout.
Non-blocking on detection failures: always exits 0 if no framework found.

Exit 0: Tests pass (or no test framework / runner not installed)
Exit 2: Tests fail (blocks agent from completing with broken tests)
"""

import json
import os
import subprocess
import sys


def detect_test_framework(cwd: str) -> tuple[str, list[str]]:
    """Detect which test framework is available in the project.

    Checks for: pytest, vitest, jest, mocha, go test, cargo test.
    Falls back to npm test if a test script is defined.

    Returns:
        Tuple of (framework_name, command_list) or ("", []) if none found.
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

            # mocha
            if "mocha" in dev_deps or "mocha" in deps:
                return ("mocha", ["npx", "mocha", "--reporter", "spec"])

            # Generic npm test script (skip default placeholder)
            test_script = pkg.get("scripts", {}).get("test", "")
            if test_script and "no test specified" not in test_script:
                return ("npm-test", ["npm", "test"])
        except (OSError, json.JSONDecodeError):
            pass

    # --- Go ---
    if "go.mod" in entries:
        return ("go", ["go", "test", "./...", "-count=1"])

    # --- Rust ---
    if "Cargo.toml" in entries:
        return ("cargo", ["cargo", "test"])

    return ("", [])


def main():
    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    cwd = os.getcwd()
    framework, cmd = detect_test_framework(cwd)

    if not framework:
        sys.exit(0)

    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=60,
        )
    except subprocess.TimeoutExpired:
        json.dump(
            {
                "additionalContext": f"[Tests] {framework} timed out after 60s. Consider running tests manually."
            },
            sys.stdout,
        )
        sys.exit(2)
    except FileNotFoundError:
        # Test runner not installed — non-critical
        sys.exit(0)
    except OSError:
        sys.exit(0)

    output = (result.stdout + "\n" + result.stderr).strip()
    if not output:
        output = "(no test output)"

    # Truncate to last 50 lines
    lines = output.splitlines()
    if len(lines) > 50:
        output = "...(truncated)\n" + "\n".join(lines[-50:])

    if result.returncode != 0:
        json.dump(
            {"error": f"Tests failed ({framework}):\n{output}"},
            sys.stdout,
        )
        sys.exit(2)

    json.dump(
        {"additionalContext": f"[Tests] All tests passed ({framework})"},
        sys.stdout,
    )
    sys.exit(0)


if __name__ == "__main__":
    main()
