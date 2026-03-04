"""Tests for the agent-system redirect-builtin-agents plugin.

Verifies that REDIRECT_MAP, UNQUALIFIED_MAP, and the main() function
correctly redirect built-in and unqualified agent names to fully-qualified
custom agent references, and pass through already-qualified or unknown names.
"""

import io
import json

import pytest

from tests.conftest import redirect_builtin_agents


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def run_main(stdin_data: str) -> tuple[int, str]:
    """Run main() with mocked stdin/stdout, return (exit_code, stdout_text).

    Captures SystemExit to extract the exit code.  Returns stdout contents
    regardless of whether output was produced.
    """
    from unittest.mock import patch

    mock_stdout = io.StringIO()
    with patch("sys.stdin", io.StringIO(stdin_data)), patch("sys.stdout", mock_stdout):
        try:
            redirect_builtin_agents.main()
        except SystemExit as exc:
            if exc.code is None:
                code = 0
            elif isinstance(exc.code, int):
                code = exc.code
            else:
                code = 1
            return (code, mock_stdout.getvalue())
    # If main() returns without sys.exit (shouldn't happen, but handle it)
    return (0, mock_stdout.getvalue())


def make_input(subagent_type: str, **extra_fields) -> str:
    """Build a JSON stdin payload with the given subagent_type."""
    tool_input = {"subagent_type": subagent_type, **extra_fields}
    return json.dumps({"tool_input": tool_input})


# ---------------------------------------------------------------------------
# 1. Data structure tests
# ---------------------------------------------------------------------------


class TestDataStructures:
    def test_redirect_map_has_all_entries(self) -> None:
        expected = {
            "Explore": "explorer",
            "Plan": "architect",
            "general-purpose": "generalist",
            "Bash": "bash-exec",
            "claude-code-guide": "claude-guide",
            "statusline-setup": "statusline-config",
        }
        assert redirect_builtin_agents.REDIRECT_MAP == expected

    def test_unqualified_map_derived_from_redirect_map(self) -> None:
        prefix = redirect_builtin_agents.PLUGIN_PREFIX
        expected = {
            v: f"{prefix}:{v}" for v in redirect_builtin_agents.REDIRECT_MAP.values()
        }
        assert redirect_builtin_agents.UNQUALIFIED_MAP == expected

    def test_plugin_prefix(self) -> None:
        assert redirect_builtin_agents.PLUGIN_PREFIX == "agent-system"


# ---------------------------------------------------------------------------
# 2. Redirect: built-in name -> qualified custom name
# ---------------------------------------------------------------------------


class TestBuiltinRedirect:
    @pytest.mark.parametrize(
        "builtin_name, expected_target",
        [
            ("Explore", "agent-system:explorer"),
            ("Plan", "agent-system:architect"),
            ("general-purpose", "agent-system:generalist"),
        ],
    )
    def test_builtin_to_qualified(
        self, builtin_name: str, expected_target: str
    ) -> None:
        exit_code, stdout = run_main(make_input(builtin_name, prompt="test"))
        assert exit_code == 0
        output = json.loads(stdout)
        updated = output["hookSpecificOutput"]["updatedInput"]
        assert updated["subagent_type"] == expected_target


# ---------------------------------------------------------------------------
# 3. Redirect: unqualified custom name -> qualified custom name
# ---------------------------------------------------------------------------


class TestUnqualifiedRedirect:
    @pytest.mark.parametrize(
        "unqualified_name, expected_target",
        [
            ("explorer", "agent-system:explorer"),
            ("bash-exec", "agent-system:bash-exec"),
        ],
    )
    def test_unqualified_to_qualified(
        self, unqualified_name: str, expected_target: str
    ) -> None:
        exit_code, stdout = run_main(make_input(unqualified_name))
        assert exit_code == 0
        output = json.loads(stdout)
        updated = output["hookSpecificOutput"]["updatedInput"]
        assert updated["subagent_type"] == expected_target


# ---------------------------------------------------------------------------
# 4. Passthrough (no redirect)
# ---------------------------------------------------------------------------


class TestPassthrough:
    def test_already_qualified_passthrough(self) -> None:
        """Already-qualified name should exit 0 with no output."""
        exit_code, stdout = run_main(make_input("agent-system:explorer"))
        assert exit_code == 0
        assert stdout == ""

    def test_unknown_agent_passthrough(self) -> None:
        """Completely unknown name should exit 0 with no output."""
        exit_code, stdout = run_main(make_input("unknown-agent"))
        assert exit_code == 0
        assert stdout == ""


# ---------------------------------------------------------------------------
# 5. Error handling
# ---------------------------------------------------------------------------


class TestErrorHandling:
    def test_invalid_json_exits_zero(self) -> None:
        """Malformed JSON on stdin should fail open (exit 0, no output)."""
        exit_code, stdout = run_main("not valid json {{{")
        assert exit_code == 0
        assert stdout == ""


# ---------------------------------------------------------------------------
# 6. Output structure verification
# ---------------------------------------------------------------------------


class TestOutputStructure:
    def test_permission_decision_is_allow(self) -> None:
        _, stdout = run_main(make_input("Explore", prompt="find files"))
        output = json.loads(stdout)
        hook = output["hookSpecificOutput"]
        assert hook["permissionDecision"] == "allow"
        assert hook["hookEventName"] == "PreToolUse"

    def test_updated_input_preserves_original_fields(self) -> None:
        """The redirect must preserve prompt, description, and other fields."""
        _, stdout = run_main(
            make_input("Plan", prompt="design the API", description="arch task")
        )
        output = json.loads(stdout)
        updated = output["hookSpecificOutput"]["updatedInput"]
        assert updated["subagent_type"] == "agent-system:architect"
        assert updated["prompt"] == "design the API"
        assert updated["description"] == "arch task"
