"""
Pytest shim that verifies bun tests pass.

This project uses Bun's test runner (bun test), not pytest.
This file exists solely to satisfy the pytest-based task completion hook.
"""

import subprocess


def test_bun_tests_pass():
    result = subprocess.run(
        ["bun", "test"],
        capture_output=True,
        text=True,
        cwd="/workspaces/projects/CodeForge/cli",
    )
    assert result.returncode == 0, f"bun test failed:\n{result.stdout}\n{result.stderr}"
    assert "0 fail" in result.stderr or "0 fail" in result.stdout, (
        f"bun tests had failures:\n{result.stdout}\n{result.stderr}"
    )
