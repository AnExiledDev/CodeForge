"""Tests for the protected-files-guard bash command blocker.

Validates extract_write_targets (regex-based write target extraction from bash
commands) and check_path (protected pattern matching), plus integration of both.

Known source bugs (documented, not worked around):
  - BUG: append redirect (>>) is not correctly parsed. The regex ``(?:>|>>)``
    matches ``>`` first (greedy alternation), so ``echo x >> file.txt``
    captures ``>`` (the second character) as the "file path" instead of
    ``file.txt``.  See guard-protected-bash.py:61.
  - BUG: ``cat > file.txt`` matches both the generic redirect pattern and
    the cat-specific pattern, producing duplicate entries in the target list.
    See guard-protected-bash.py:61,69.
"""

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

    def test_append_redirect_has_regex_bug(self):
        """BUG: >> is parsed as > followed by >filename.

        The regex alternation ``(?:>|>>)`` matches the first ``>`` greedily,
        so ``>>`` is never reached.  The captured "target" is ``>`` (the
        second character), not the actual filename.
        """
        result = guard_protected_bash.extract_write_targets("echo x >> file.txt")
        # Actual (buggy) behavior — the second > is captured as the target
        assert result == [">"]


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
