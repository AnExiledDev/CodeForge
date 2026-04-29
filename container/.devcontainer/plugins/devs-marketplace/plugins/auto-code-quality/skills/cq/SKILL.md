---
name: cq
description: "Run code quality checks: format, lint (with auto-fix), and test all files edited this session. Use after editing code to ensure quality before committing."
allowed-tools: Bash Read Glob Grep
---

# Code Quality (`/cq`)

Run formatting, linting, and tests on all files edited this session.

## Step 1: Gather edited files

Read the edited file lists:
- `/tmp/claude-cq-edited-{session_id}` — files to format and test
- `/tmp/claude-cq-lint-{session_id}` — files to lint

Where `{session_id}` is your current session ID (from the `SESSION_ID` environment variable, or extract from the temp files in `/tmp/claude-cq-*`).

If neither file exists, report "No files edited this session" and stop.

Deduplicate paths and filter out files that no longer exist on disk.

## Step 2: Format

Format each file based on its extension. Skip any tool that isn't installed — don't error on missing tools.

| Extension | Tool | Command |
|-----------|------|---------|
| `.py`, `.pyi` | ruff | `ruff format <file>` |
| `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.mts`, `.cts`, `.css`, `.json`, `.jsonc`, `.graphql`, `.gql`, `.html`, `.vue`, `.svelte`, `.astro` | biome | `<biome> check --write <file>` |
| `.go` | gofmt | `gofmt -w <file>` |
| `.sh`, `.bash`, `.zsh`, `.mksh`, `.bats` | shfmt | `shfmt -w <file>` |
| `.md`, `.markdown`, `.yaml`, `.yml`, `.toml`, `Dockerfile`, `.dockerfile` | dprint | `dprint fmt --config /usr/local/share/dprint/dprint.json <file>` |
| `.rs` | rustfmt | `rustfmt <file>` |

### Biome resolution

Find biome in this order:
1. Walk up from the file's directory looking for `node_modules/.bin/biome`
2. Fall back to `which biome`

If neither exists, skip biome-formatted files silently.

### dprint config

Only run dprint if `/usr/local/share/dprint/dprint.json` exists. Skip otherwise.

## Step 3: Lint with auto-fix

Run linters on each file. Apply safe auto-fixes where the tool supports it, then report remaining issues.

| Extension | Tool | Command | Auto-fix? |
|-----------|------|---------|-----------|
| `.py`, `.pyi` | ruff | `ruff check --fix <file>` | Yes (safe fixes only) |
| `.py`, `.pyi` | pyright | `pyright <file>` | No (report only) |
| `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.mts`, `.cts`, `.css`, `.graphql`, `.gql` | biome | `biome lint <file>` | No (report remaining after format step) |
| `.sh`, `.bash`, `.zsh`, `.mksh`, `.bats` | shellcheck | `shellcheck <file>` | No (report only) |
| `.go` | go vet | `go vet <file>` | No (report only) |
| `Dockerfile`, `.dockerfile` | hadolint | `hadolint <file>` | No (report only) |
| `.rs` | clippy | `cargo clippy` | No (report only, no `--fix`) |

Skip any tool that isn't installed. Don't treat missing tools as errors.

## Step 4: Run affected tests

Detect the project's test framework and run only tests affected by the edited files:

1. **pytest** (Python) — look for `pytest.ini`, `conftest.py`, `[tool.pytest` in pyproject.toml, or a `tests/` directory. Map source files to test files:
   - `src/foo/bar.py` → `tests/foo/test_bar.py`
   - Test files (`test_*.py`) run directly
   - `conftest.py` edits → run full suite
   - Command: `python3 -m pytest --tb=short -q <test_files>`

2. **vitest** (JS/TS) — look for `vitest.config.*`. Command: `npx vitest run --reporter=verbose --related <files>`

3. **jest** (JS/TS) — look for `jest.config.*` or `"jest"` in package.json. Command: `npx jest --verbose --findRelatedTests <files>`

4. **go test** — look for `go.mod`. Map edited `.go` files to package dirs. Command: `go test -count=1 <packages>`

5. **cargo test** (Rust) — look for `Cargo.toml`. Command: `cargo test`

6. **npm test** — fallback if package.json has a `test` script. Command: `npm test`

If no test framework is detected, skip testing and note it in the report.

## Step 5: Fix remaining issues

If linting or tests surfaced fixable issues:
- Review each error/warning
- Fix what you can directly (edit the source files)
- Re-run the specific linter or test to confirm the fix

Don't loop more than once — fix, verify, move on.

## Step 6: Clean up

Delete the temp files:
- `/tmp/claude-cq-edited-{session_id}`
- `/tmp/claude-cq-lint-{session_id}`

This ensures the quality gate Stop hook won't re-trigger on the next stop.

## Step 7: Report

Provide a concise summary:

```
## Code Quality Results

**Formatted:** <count> files (<tools used>)
**Lint:** <clean | N issues found, M fixed>
**Tests:** <passed | N failed | skipped (no framework)>

[Details of any remaining issues that need attention]
```

If everything is clean, keep it to one line: "All <N> files formatted, lint clean, tests passed."
