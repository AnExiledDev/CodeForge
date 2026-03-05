"""Tests for the dangerous-command-blocker plugin.

Verifies that check_command() correctly identifies dangerous shell commands
and allows safe commands through without false positives.
"""

import pytest

from tests.conftest import block_dangerous


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def assert_blocked(command: str, *, substr: str | None = None) -> None:
    """Assert the command is blocked, optionally checking the message."""
    is_dangerous, message = block_dangerous.check_command(command)
    assert is_dangerous is True, f"Expected blocked: {command!r}"
    assert message, f"Blocked command should have a message: {command!r}"
    if substr:
        assert substr.lower() in message.lower(), (
            f"Expected {substr!r} in message {message!r}"
        )


def assert_allowed(command: str) -> None:
    """Assert the command is allowed (not dangerous)."""
    is_dangerous, message = block_dangerous.check_command(command)
    assert is_dangerous is False, f"Expected allowed: {command!r} (got: {message})"
    assert message == "", f"Allowed command should have empty message: {command!r}"


# ---------------------------------------------------------------------------
# 1. Destructive rm patterns
# ---------------------------------------------------------------------------


class TestDestructiveRm:
    @pytest.mark.parametrize(
        "cmd",
        [
            "rm -rf /",
            "rm -rf ~",
            "rm -rf ../",
            "rm -fr /",
            "rm -rfi /",
        ],
    )
    def test_rm_rf_dangerous_paths(self, cmd: str) -> None:
        assert_blocked(cmd, substr="rm")


# ---------------------------------------------------------------------------
# 2. sudo rm
# ---------------------------------------------------------------------------


class TestSudoRm:
    @pytest.mark.parametrize(
        "cmd",
        [
            "sudo rm file.txt",
            "sudo rm -rf /var",
            "sudo rm -r dir",
        ],
    )
    def test_sudo_rm_blocked(self, cmd: str) -> None:
        assert_blocked(cmd, substr="sudo rm")


# ---------------------------------------------------------------------------
# 3. chmod 777
# ---------------------------------------------------------------------------


class TestChmod777:
    @pytest.mark.parametrize(
        "cmd",
        [
            "chmod 777 file.txt",
            "chmod -R 777 /var/www",
            "chmod 777 .",
        ],
    )
    def test_chmod_777_blocked(self, cmd: str) -> None:
        assert_blocked(cmd, substr="chmod 777")


# ---------------------------------------------------------------------------
# 4. Force push to main/master
# ---------------------------------------------------------------------------


class TestForcePush:
    @pytest.mark.parametrize(
        "cmd",
        [
            "git push --force origin main",
            "git push -f origin master",
            "git push --force origin master",
            "git push -f origin main",
        ],
    )
    def test_force_push_to_main_master(self, cmd: str) -> None:
        assert_blocked(cmd, substr="force push")

    @pytest.mark.parametrize(
        "cmd",
        [
            "git push -f",
            "git push --force",
        ],
    )
    def test_bare_force_push(self, cmd: str) -> None:
        assert_blocked(cmd, substr="force push")


# ---------------------------------------------------------------------------
# 5. Disk operations
# ---------------------------------------------------------------------------


class TestDiskOperations:
    def test_mkfs(self) -> None:
        assert_blocked("mkfs.ext4 /dev/sda1", substr="disk formatting")

    def test_dd_to_device(self) -> None:
        assert_blocked("dd if=/dev/zero of=/dev/sda bs=1M", substr="dd")


# ---------------------------------------------------------------------------
# 7. Git history destruction
# ---------------------------------------------------------------------------


class TestGitHistoryDestruction:
    def test_git_reset_hard_origin_main(self) -> None:
        assert_blocked("git reset --hard origin/main", substr="hard reset")

    def test_git_reset_hard_origin_master(self) -> None:
        assert_blocked("git reset --hard origin/master", substr="hard reset")

    @pytest.mark.parametrize(
        "cmd",
        [
            "git clean -f",
            "git clean -fd",
            "git clean -fdx",
        ],
    )
    def test_git_clean_blocked(self, cmd: str) -> None:
        assert_blocked(cmd, substr="git clean")


# ---------------------------------------------------------------------------
# 8. Docker dangerous operations
# ---------------------------------------------------------------------------


class TestDockerDangerous:
    def test_docker_run_privileged(self) -> None:
        assert_blocked("docker run --privileged ubuntu", substr="privileged")

    def test_docker_run_mount_root(self) -> None:
        assert_blocked("docker run -v /:/host ubuntu", substr="root filesystem")

    @pytest.mark.parametrize(
        "cmd",
        [
            "docker stop my-container",
            "docker rm my-container",
            "docker kill my-container",
            "docker rmi my-image",
        ],
    )
    def test_docker_destructive_ops(self, cmd: str) -> None:
        assert_blocked(cmd, substr="docker operation")


# ---------------------------------------------------------------------------
# 9. Find delete
# ---------------------------------------------------------------------------


class TestFindDelete:
    def test_find_exec_rm(self) -> None:
        assert_blocked("find . -exec rm {} \\;", substr="find")

    def test_find_delete(self) -> None:
        assert_blocked("find /tmp -name '*.log' -delete", substr="find")


# ---------------------------------------------------------------------------
# 10. Safe commands (false positive checks)
# ---------------------------------------------------------------------------


class TestSafeCommands:
    @pytest.mark.parametrize(
        "cmd",
        [
            "rm file.txt",
            "git push origin feature-branch",
            "chmod 644 file",
            "docker ps",
            "docker logs container",
            "ls /usr/bin",
            "cat /etc/hosts",
            "echo hello",
            "git status",
            "echo '> /usr/local/bin/foo' | gh pr create --body-file -",
            "echo x > /usr/local/bin/tool",
            "echo x > /etc/myconfig",
        ],
    )
    def test_safe_commands_allowed(self, cmd: str) -> None:
        assert_allowed(cmd)


# ---------------------------------------------------------------------------
# 10b. Force push with lease (intentionally blocked)
# ---------------------------------------------------------------------------


class TestForceWithLease:
    def test_force_with_lease_blocked(self) -> None:
        """--force-with-lease is intentionally blocked alongside all force
        push variants to prevent agents from using it as a workaround."""
        assert_blocked(
            "git push --force-with-lease origin feature",
            substr="force push",
        )


# ---------------------------------------------------------------------------
# 11. Remote branch deletion
# ---------------------------------------------------------------------------


class TestRemoteBranchDeletion:
    @pytest.mark.parametrize(
        "cmd",
        [
            "git push origin --delete feature-branch",
            "git push --delete feature-branch",
        ],
    )
    def test_push_delete_blocked(self, cmd: str) -> None:
        assert_blocked(cmd, substr="deleting remote branches")

    def test_colon_refspec_blocked(self) -> None:
        assert_blocked(
            "git push origin :feature-branch",
            substr="colon-refspec",
        )


# ---------------------------------------------------------------------------
# 12. Command prefix bypass vectors
# ---------------------------------------------------------------------------


class TestCommandPrefixBypass:
    """Prefixes like backslash, 'command', and 'env' should not bypass blocks."""

    @pytest.mark.parametrize(
        "cmd",
        [
            "\\rm -rf /",
            "command rm -rf /",
            "env rm -rf /",
            "env VAR=x rm -rf /",
        ],
        ids=[
            "backslash-prefix",
            "command-prefix",
            "env-prefix",
            "env-with-variable",
        ],
    )
    def test_prefix_bypass_still_blocked(self, cmd: str) -> None:
        assert_blocked(cmd, substr="rm")


# ---------------------------------------------------------------------------
# 13. Symbolic chmod and setuid/setgid patterns
# ---------------------------------------------------------------------------


class TestChmodExtended:
    @pytest.mark.parametrize(
        "cmd, substr",
        [
            ("chmod a=rwx file", "chmod a=rwx"),
            ("chmod 0777 file", "chmod 0777"),
            ("chmod u+s /usr/bin/something", "SetUID"),
            ("chmod g+s /usr/bin/something", "SetGID"),
        ],
        ids=[
            "symbolic-a-equals-rwx",
            "octal-0777",
            "setuid-bit",
            "setgid-bit",
        ],
    )
    def test_chmod_variants_blocked(self, cmd: str, substr: str) -> None:
        assert_blocked(cmd, substr=substr)


# ---------------------------------------------------------------------------
# 14. Docker system/volume destructive operations
# ---------------------------------------------------------------------------


class TestDockerExtended:
    def test_docker_system_prune(self) -> None:
        assert_blocked("docker system prune -af", substr="docker system prune")

    def test_docker_volume_rm(self) -> None:
        assert_blocked("docker volume rm myvolume", substr="docker volume rm")


# ---------------------------------------------------------------------------
# 15. Git history rewriting and force push variants
# ---------------------------------------------------------------------------


class TestGitExtended:
    def test_git_filter_branch(self) -> None:
        assert_blocked(
            "git filter-branch --tree-filter 'rm -f passwords.txt' HEAD",
            substr="filter-branch",
        )

    def test_plus_refspec_push(self) -> None:
        assert_blocked(
            "git push origin +main",
            substr="plus-refspec",
        )

    def test_force_if_includes(self) -> None:
        assert_blocked(
            "git push --force-if-includes origin main",
            substr="force push",
        )
