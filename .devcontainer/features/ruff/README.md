# Ruff

Fast Python linter and formatter, replacing Black + Flake8.

## What It Does

Installs [Ruff](https://docs.astral.sh/ruff/) via `uv tool install`. Ruff is an extremely fast Python linter and formatter written in Rust, compatible with Flake8, isort, and Black rules.

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `version` | `latest` | Ruff version to install. Set `"none"` to skip. |
| `username` | `automatic` | Container user to install for. |

## Usage

```bash
ruff check .              # lint
ruff check --fix .        # lint and auto-fix
ruff format .             # format (Black-compatible)
```

## Configuration

Used by both `auto-formatter` (formatting) and `auto-linter` (linting) plugins for Python files. For project-specific config, add a `[tool.ruff]` section to `pyproject.toml` or create a `ruff.toml`. See [Ruff docs](https://docs.astral.sh/ruff/configuration/).
