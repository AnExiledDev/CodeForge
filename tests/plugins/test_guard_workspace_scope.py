"""Tests for workspace scope guard plugin.

Covers: is_blacklisted, is_in_scope, is_allowlisted, get_target_path,
        extract_primary_command, extract_write_targets, check_bash_scope.
"""

from unittest.mock import patch

import pytest

from tests.conftest import guard_workspace_scope


# ---------------------------------------------------------------------------
# is_blacklisted
# ---------------------------------------------------------------------------
class TestIsBlacklisted:
    @pytest.mark.parametrize(
        "path, expected",
        [
            ("/workspaces/.devcontainer", True),
            ("/workspaces/.devcontainer/scripts/setup.sh", True),
            ("/workspaces/myproject/src/app.py", False),
            ("/workspaces", False),
        ],
        ids=[
            "exact_devcontainer_dir",
            "file_inside_devcontainer",
            "project_source_file",
            "workspaces_root",
        ],
    )
    def test_blacklisted(self, path, expected):
        assert guard_workspace_scope.is_blacklisted(path) is expected


# ---------------------------------------------------------------------------
# is_in_scope
# ---------------------------------------------------------------------------
class TestIsInScope:
    @pytest.mark.parametrize(
        "resolved_path, cwd, expected",
        [
            ("/workspaces/proj/src/app.py", "/workspaces/proj", True),
            ("/workspaces/proj", "/workspaces/proj", True),
            ("/workspaces/other/file", "/workspaces/proj", False),
            ("/workspaces/project-foo", "/workspaces/project", False),
            ("/tmp/scratch", "/workspaces/proj", False),
        ],
        ids=[
            "file_inside_cwd",
            "exact_match_cwd",
            "different_project",
            "prefix_trap",
            "tmp_outside_scope",
        ],
    )
    def test_in_scope(self, resolved_path, cwd, expected):
        assert guard_workspace_scope.is_in_scope(resolved_path, cwd) is expected


# ---------------------------------------------------------------------------
# is_allowlisted
# ---------------------------------------------------------------------------
class TestIsAllowlisted:
    @pytest.mark.parametrize(
        "path, expected",
        [
            (f"{guard_workspace_scope._home}/.claude/rules/foo.md", True),
            ("/tmp/scratch.txt", True),
            ("/workspaces/proj/file", False),
            (f"{guard_workspace_scope._home}/.ssh/id_rsa", False),
        ],
        ids=[
            "claude_config_dir",
            "tmp_file",
            "project_file",
            "ssh_key",
        ],
    )
    def test_allowlisted(self, path, expected):
        assert guard_workspace_scope.is_allowlisted(path) is expected


# ---------------------------------------------------------------------------
# get_target_path
# ---------------------------------------------------------------------------
class TestGetTargetPath:
    @pytest.mark.parametrize(
        "tool_name, tool_input, expected",
        [
            ("Read", {"file_path": "/foo/bar"}, "/foo/bar"),
            ("Write", {"file_path": "/foo/bar"}, "/foo/bar"),
            ("Edit", {"file_path": "/foo/bar"}, "/foo/bar"),
            ("Glob", {"path": "/foo"}, "/foo"),
            ("Glob", {}, None),
            ("Bash", {"command": "ls"}, None),
            ("NotebookEdit", {"notebook_path": "/nb.ipynb"}, "/nb.ipynb"),
        ],
        ids=[
            "read_file_path",
            "write_file_path",
            "edit_file_path",
            "glob_with_path",
            "glob_no_path",
            "bash_no_file_field",
            "notebook_edit",
        ],
    )
    def test_target_path(self, tool_name, tool_input, expected):
        assert guard_workspace_scope.get_target_path(tool_name, tool_input) == expected


# ---------------------------------------------------------------------------
# extract_primary_command
# ---------------------------------------------------------------------------
class TestExtractPrimaryCommand:
    @pytest.mark.parametrize(
        "command, expected",
        [
            ("ls -la", "ls"),
            ("sudo rm -rf /tmp", "rm"),
            ("sudo -u root pip install foo", "pip"),
            ("env VAR=val python script.py", "python"),
            ("nohup python server.py", "python"),
            ("VAR=1 OTHER=2 make build", "make"),
        ],
        ids=[
            "simple_command",
            "sudo_prefix",
            "sudo_with_user_flag",
            "env_with_var",
            "nohup_prefix",
            "inline_var_assignments",
        ],
    )
    def test_primary_command(self, command, expected):
        assert guard_workspace_scope.extract_primary_command(command) == expected


# ---------------------------------------------------------------------------
# extract_write_targets
# ---------------------------------------------------------------------------
class TestExtractWriteTargets:
    @pytest.mark.parametrize(
        "command, expected",
        [
            ("echo x > output.txt", ["output.txt"]),
            ("tee -a log.txt", ["log.txt"]),
            ("cp src.py /workspaces/other/dest.py", ["/workspaces/other/dest.py"]),
            ("ls -la", []),
            (
                "curl -o /tmp/file.tar.gz https://example.com",
                ["/tmp/file.tar.gz"],
            ),
        ],
        ids=[
            "redirect_output",
            "tee_append",
            "cp_destination",
            "no_write_targets",
            "curl_output_file",
        ],
    )
    def test_write_targets(self, command, expected):
        assert guard_workspace_scope.extract_write_targets(command) == expected


# ---------------------------------------------------------------------------
# check_bash_scope — uses mock to control os.path.realpath
# ---------------------------------------------------------------------------
class TestCheckBashScope:
    """Test check_bash_scope which calls sys.exit(2) on violation.

    All tests mock os.path.realpath as an identity function so that paths
    resolve to themselves without filesystem interaction.
    """

    @pytest.mark.parametrize(
        "command, cwd",
        [
            ("echo x > /workspaces/.devcontainer/foo", "/workspaces/proj"),
            (
                "cat /workspaces/.devcontainer/scripts/setup.sh",
                "/workspaces/proj",
            ),
            ("echo x > /workspaces/other/file", "/workspaces/proj"),
            ("ls /workspaces/other/src", "/workspaces/proj"),
        ],
        ids=[
            "write_to_blacklisted",
            "reference_blacklisted",
            "write_outside_scope",
            "workspace_path_outside_scope",
        ],
    )
    def test_blocked(self, command, cwd):
        with (
            patch("os.path.realpath", side_effect=lambda p: p),
            pytest.raises(SystemExit) as exc_info,
        ):
            guard_workspace_scope.check_bash_scope(command, cwd)
        assert exc_info.value.code == 2

    @pytest.mark.parametrize(
        "command, cwd",
        [
            ("echo x > /workspaces/proj/out.txt", "/workspaces/proj"),
            ("echo hello", "/workspaces/proj"),
            ("echo x > /workspaces/other/file", "/workspaces"),
            ("echo x > /tmp/scratch", "/workspaces/proj"),
            ("", "/workspaces/proj"),
        ],
        ids=[
            "write_inside_scope",
            "no_paths",
            "cwd_is_workspaces_bypass",
            "allowlisted_tmp",
            "empty_command",
        ],
    )
    def test_allowed(self, command, cwd):
        with patch("os.path.realpath", side_effect=lambda p: p):
            # Should return None (no exception)
            result = guard_workspace_scope.check_bash_scope(command, cwd)
            assert result is None
