"""Tests for the protected-files-guard plugin (guard-protected.py).

Validates that check_path correctly identifies protected file paths
and allows safe paths through.
"""

import pytest

from tests.conftest import guard_protected


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def assert_protected(file_path: str) -> None:
    """Assert path is blocked and returns a non-empty message."""
    is_protected, message = guard_protected.check_path(file_path)
    assert is_protected is True, f"Expected {file_path!r} to be protected"
    assert message, f"Expected non-empty message for {file_path!r}"


def assert_safe(file_path: str) -> None:
    """Assert path is allowed and returns an empty message."""
    is_protected, message = guard_protected.check_path(file_path)
    assert is_protected is False, f"Expected {file_path!r} to be safe, got: {message}"
    assert message == "", f"Expected empty message for safe path {file_path!r}"


# ---------------------------------------------------------------------------
# Environment files
# ---------------------------------------------------------------------------


class TestEnvFiles:
    @pytest.mark.parametrize(
        "path",
        [
            ".env",
            ".env.local",
            ".env.production",
            "path/to/.env",
            "path/to/.env.local",
        ],
    )
    def test_env_files_are_protected(self, path: str) -> None:
        assert_protected(path)


# ---------------------------------------------------------------------------
# Git internals
# ---------------------------------------------------------------------------


class TestGitInternals:
    @pytest.mark.parametrize(
        "path",
        [
            ".git",
            ".git/config",
            "path/.git/hooks/pre-commit",
        ],
    )
    def test_git_paths_are_protected(self, path: str) -> None:
        assert_protected(path)


# ---------------------------------------------------------------------------
# Lock files
# ---------------------------------------------------------------------------


class TestLockFiles:
    @pytest.mark.parametrize(
        "path",
        [
            "package-lock.json",
            "yarn.lock",
            "pnpm-lock.yaml",
            "Gemfile.lock",
            "poetry.lock",
            "Cargo.lock",
            "composer.lock",
            "uv.lock",
        ],
    )
    def test_lock_files_are_protected(self, path: str) -> None:
        assert_protected(path)

    @pytest.mark.parametrize(
        "path",
        [
            "subdir/package-lock.json",
            "deep/nested/yarn.lock",
            "path/to/pnpm-lock.yaml",
            "vendor/Gemfile.lock",
            "libs/poetry.lock",
            "crates/Cargo.lock",
            "deps/composer.lock",
            "project/uv.lock",
        ],
    )
    def test_lock_files_with_prefix_are_protected(self, path: str) -> None:
        assert_protected(path)


# ---------------------------------------------------------------------------
# Certificates and keys
# ---------------------------------------------------------------------------


class TestCertificatesAndKeys:
    @pytest.mark.parametrize(
        "path",
        [
            "server.pem",
            "private.key",
            "cert.crt",
            "store.p12",
            "cert.pfx",
        ],
    )
    def test_cert_key_files_are_protected(self, path: str) -> None:
        assert_protected(path)


# ---------------------------------------------------------------------------
# Credential files
# ---------------------------------------------------------------------------


class TestCredentialFiles:
    @pytest.mark.parametrize(
        "path",
        [
            "credentials.json",
            ".credentials.json",
            "secrets.yaml",
            "secrets.yml",
            "secrets.json",
            ".secrets",
        ],
    )
    def test_credential_files_are_protected(self, path: str) -> None:
        assert_protected(path)


# ---------------------------------------------------------------------------
# Auth directories and SSH keys
# ---------------------------------------------------------------------------


class TestAuthDirectories:
    @pytest.mark.parametrize(
        "path",
        [
            ".ssh/id_rsa",
            ".aws/credentials",
            ".netrc",
            ".npmrc",
            ".pypirc",
        ],
    )
    def test_auth_paths_are_protected(self, path: str) -> None:
        assert_protected(path)


class TestSSHKeys:
    @pytest.mark.parametrize(
        "path",
        [
            "id_rsa",
            "id_rsa.pub",
            "id_ed25519",
            "id_ecdsa",
        ],
    )
    def test_ssh_key_files_are_protected(self, path: str) -> None:
        assert_protected(path)


# ---------------------------------------------------------------------------
# Safe paths (false-positive checks)
# ---------------------------------------------------------------------------


class TestSafePaths:
    @pytest.mark.parametrize(
        "path",
        [
            "src/app.py",
            "README.md",
            "package.json",
            ".envrc",
            "config/settings.json",
            ".github/workflows/ci.yml",
            "src/env.ts",
            "lock.js",
        ],
    )
    def test_safe_paths_are_not_blocked(self, path: str) -> None:
        assert_safe(path)


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


class TestEdgeCases:
    def test_windows_backslash_path(self) -> None:
        assert_protected("path\\.env")

    @pytest.mark.parametrize(
        "path",
        [
            ".ENV",
            "SECRETS.YAML",
        ],
    )
    def test_case_insensitive_matching(self, path: str) -> None:
        assert_protected(path)
