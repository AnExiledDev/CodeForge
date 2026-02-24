---
title: Auto Code Quality
description: The auto code quality plugin runs formatting and linting checks automatically during development sessions.
sidebar:
  order: 6
---

The auto code quality plugin keeps your code clean without any manual effort. Every file you edit gets automatically formatted and linted at the end of each assistant turn, so you never need to remember to run your formatters or worry about style inconsistencies creeping in.

## How It Works

The plugin operates in four phases during a session, each triggered by a different hook:

1. **On every edit** (PostToolUse) -- When Claude writes or edits a file, the plugin records the file path and validates data file syntax immediately.
2. **At the end of each turn** (Stop) -- All edited files are batch-formatted using the appropriate tool for each language.
3. **After formatting** (Stop) -- All edited files are linted and any issues are reported.
4. **After linting** (Stop) -- If a test framework is detected, affected tests are run automatically.

This "collect, then batch process" approach avoids running formatters on every keystroke while ensuring nothing slips through.

### The Advisory Pattern

Quality checks run as advisory hooks -- they report findings without blocking your workflow. Formatting is applied silently, while lint warnings and test failures are surfaced as context that Claude can act on. If tests fail, the hook blocks the Stop so Claude addresses the failures before finishing.

## Phase 1: Syntax Validation

When you edit a data file (JSON, JSONC, YAML, or TOML), the `syntax-validator.py` script validates it immediately. This catches broken configuration files the moment they're saved rather than waiting for something downstream to fail.

Validated formats:

| Format | Validation |
|--------|------------|
| `.json` | JSON parse check |
| `.jsonc` | Comment-stripped JSON parse check |
| `.yaml` / `.yml` | YAML safe_load (requires PyYAML) |
| `.toml` | TOML parse check (Python 3.11+) |

## Phase 2: Auto-Formatting

At the end of each turn, `format-on-stop.py` processes every file that was edited during the conversation. It selects the right formatter based on file extension:

| Formatter | Languages / Extensions | Notes |
|-----------|----------------------|-------|
| **Ruff** (or Black fallback) | `.py`, `.pyi` | Ruff preferred; falls back to Black if unavailable |
| **gofmt** | `.go` | Standard Go formatting |
| **Biome** | `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.mts`, `.cts`, `.css`, `.json`, `.jsonc`, `.graphql`, `.gql`, `.html`, `.vue`, `.svelte`, `.astro` | Checks project-local install first, then global |
| **shfmt** | `.sh`, `.bash`, `.zsh`, `.mksh`, `.bats` | Shell script formatting |
| **dprint** | `.md`, `.markdown`, `.yaml`, `.yml`, `.toml`, `Dockerfile` | Uses global dprint config |
| **rustfmt** | `.rs` | Conditional -- only runs if installed |

:::tip[Project-Local Tools]
For Biome, the formatter checks your project's `node_modules/.bin/` first before falling back to the global install. This means your project's Biome version and configuration are respected automatically.
:::

## Phase 3: Auto-Linting

After formatting, `lint-file.py` runs language-appropriate linters on the same set of edited files:

| Linter | Languages | What It Catches |
|--------|-----------|-----------------|
| **Pyright** | Python | Type errors, missing imports, incorrect signatures |
| **Ruff** | Python | Style violations, unused imports, correctness issues |
| **Biome** | JS/TS/CSS/GraphQL | Lint rules, accessibility, suspicious patterns |
| **ShellCheck** | Shell scripts | Common shell scripting pitfalls, quoting issues |
| **go vet** | Go | Suspicious constructs, printf format mismatches |
| **hadolint** | Dockerfile | Dockerfile best practices, security issues |
| **clippy** | Rust | Idiomatic Rust patterns, performance, correctness |

Lint results appear as context messages with per-file summaries showing up to 5 issues each, including line numbers and severity levels.

## Phase 4: Advisory Test Runner

The `advisory-test-runner.py` script is the final quality gate. It detects your project's test framework, identifies which tests are affected by your changes, and runs only those tests.

### Supported Test Frameworks

| Framework | Detection | Targeted Testing |
|-----------|-----------|-----------------|
| **pytest** | `pytest.ini`, `conftest.py`, `pyproject.toml`, `tests/` dir | Maps source files to `test_*.py` counterparts |
| **vitest** | `vitest.config.*` or `test` in `vite.config.*` | Uses `--related` for dependency-graph analysis |
| **jest** | `jest.config.*` or `jest` in `package.json` | Uses `--findRelatedTests` |
| **mocha** | `mocha` in dependencies | Runs full suite |
| **npm test** | `scripts.test` in `package.json` | Runs full suite |
| **go test** | `go.mod` | Maps `.go` files to package directories |
| **cargo test** | `Cargo.toml` | Runs full suite |

### What Happens When Tests Fail

When tests pass, you see a brief confirmation message. When tests fail, the hook blocks the Stop with the last 30 lines of test output, giving Claude the information needed to fix the failures before finishing. Tests have a 15-second timeout to keep the feedback loop fast.

:::caution[Full Suite Triggers]
Editing `conftest.py` in a pytest project triggers a full test suite run rather than targeted tests, since conftest changes can affect any test. The same applies to frameworks without granular test selection (mocha, cargo).
:::

## Hook Registration

| Script | Hook | Trigger | Purpose |
|--------|------|---------|---------|
| `collect-edited-files.py` | PostToolUse | Edit, Write | Records which files were modified |
| `syntax-validator.py` | PostToolUse | Edit, Write | Validates JSON/YAML/TOML syntax immediately |
| `format-on-stop.py` | Stop | End of turn | Batch-formats all edited files |
| `lint-file.py` | Stop | End of turn | Batch-lints all edited files |
| `advisory-test-runner.py` | Stop | End of turn | Runs affected tests |

## Configuration

The plugin works out of the box with no configuration needed. It automatically detects which tools are available and skips any that aren't installed. To disable specific quality checks, you can modify the plugin's `hooks.json` to remove individual scripts.

See [Configuration](../customization/configuration/) for details on adjusting plugin settings.

## Related

- [Tools Reference](../features/tools/) -- details on each formatting and linting tool
- [Code Intelligence](../features/code-intelligence/) -- AST-based analysis complements lint checks
- [Hooks](../customization/hooks/) -- how advisory and blocking hooks work
