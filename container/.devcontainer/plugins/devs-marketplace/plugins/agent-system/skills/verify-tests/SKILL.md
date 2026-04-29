---
name: verify-tests
description: "Run the project test suite and report results. Use after agent work completes or before committing to verify nothing is broken."
argument-hint: "[test files, directory, or framework hint]"
allowed-tools: Bash Read Glob Grep
---

# /verify-tests

Run the project test suite, report results, and optionally fix failures.

## Step 1: Detect Test Framework

Check the project for test infrastructure. Use the first match:

| Indicator | Command |
|-----------|---------|
| `pytest.ini`, `conftest.py`, or `pyproject.toml` with `[tool.pytest` | `python3 -m pytest --tb=short -q` |
| `vitest.config.*` | `npx vitest run --reporter=verbose` |
| `jest.config.*` or `package.json` with `"jest"` | `npx jest --verbose` |
| `package.json` with `"mocha"` | `npx mocha --reporter spec` |
| `go.mod` | `go test ./... -count=1` |
| `Cargo.toml` | `cargo test` |
| `package.json` with `"test"` script | `npm test` |

If `$ARGUMENTS` specifies files or a framework, use those instead of auto-detection.

If no test framework is detected, report: "No test framework detected in this project."

## Step 2: Run Tests

Execute the detected command. If specific files were passed via `$ARGUMENTS`, scope the run to those files.

## Step 3: Report Results

Format output as:

```
## Test Results
**Framework:** <name>
**Result:** passed | N failed, M passed
**Duration:** <time>
```

Include failure details if any tests failed.

## Step 4: Fix Failures

If tests failed:
1. Review each failure — read the failing test and the source code it exercises.
2. Fix what's fixable (test bugs, obvious source issues).
3. Re-run to confirm the fix.
4. Maximum one fix cycle — if still failing after one round, report the remaining failures.

## Step 5: Summary

- **All passed**: One-line confirmation.
- **Issues remain**: List each unresolved failure with file path and reason.
