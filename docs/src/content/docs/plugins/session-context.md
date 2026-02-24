---
title: Session Context
description: The session context plugin injects useful runtime information — git state, TODOs, and commit reminders — into Claude Code sessions.
sidebar:
  order: 10
---

The session context plugin gives Claude a running awareness of your project's state. At session start, it injects the current git branch, working tree status, and any TODO items in your codebase. At the end of each turn, it reminds about uncommitted changes. This context helps Claude make better decisions without you having to repeat project state manually.

## How It Works

The plugin registers hooks at two lifecycle points:

| Hook Point | What Fires | Purpose |
|-----------|------------|---------|
| **SessionStart** | Git state injector + TODO harvester | Gives Claude full project awareness at the start of every session |
| **Stop** | Commit reminder | Prompts about uncommitted changes before the turn ends |

The SessionStart scripts (git state injector and TODO harvester) are purely advisory -- they inject context without making decisions. The commit reminder is different: it uses a "block" decision to keep Claude from finishing a turn when there are uncommitted changes.

## Git State Injection

The `git-state-injector.py` script runs at the beginning of every session and provides Claude with a snapshot of your repository:

### What Gets Injected

- **Working directory** -- The full path, with a reminder to restrict operations to this directory
- **Current branch** -- Branch name or detached HEAD indicator
- **Working tree status** -- Counts of modified, added, deleted, and untracked files, plus the short status output
- **Recent commits** -- The last 5 commits (one-line format)
- **Uncommitted diff stats** -- Summary of what's changed but not yet committed

### Example Output

Here's what Claude sees at the start of a session:

```
[Git State]
Working Directory: /workspaces/projects/MyAPI -- restrict all file
operations to this directory unless explicitly instructed otherwise.
Branch: feature/auth-refactor
Status: 3 modified, 1 untracked
 M src/auth/login.py
 M src/auth/tokens.py
 M tests/test_login.py
?? src/auth/oauth.py
Recent commits:
a1b2c3d Add token refresh endpoint
d4e5f6g Fix login rate limiting
7h8i9j0 Update auth middleware tests
Uncommitted changes:
 src/auth/login.py  | 12 ++++++------
 src/auth/tokens.py |  8 ++++----
 2 files changed, 10 insertions(+), 10 deletions(-)
```

:::tip[Why This Matters]
Without git state injection, Claude starts every session blind. It doesn't know what branch you're on, what files have changed, or what you've been working on. This context lets Claude make appropriate git operations, avoid conflicts, and understand the current state of work.
:::

### Safety Caps

The injector is careful not to bloat Claude's context:

| Limit | Value |
|-------|-------|
| Status lines | 20 lines max |
| Diff stat lines | 15 lines max |
| Total output | 2000 characters max |

### Non-Git Projects

If the working directory isn't a git repository, the injector still fires -- it injects just the working directory path with the scope restriction reminder.

## TODO Harvester

The `todo-harvester.py` script scans your codebase for tech debt markers at session start. It uses grep to find TODO, FIXME, HACK, and XXX comments across source files and surfaces a summary.

### Scanned File Types

The harvester searches across common source file types:

`.py`, `.ts`, `.tsx`, `.js`, `.jsx`, `.go`, `.rs`, `.sh`, `.svelte`, `.vue`, `.rb`, `.java`, `.kt`

### Excluded Directories

Build artifacts and dependencies are automatically excluded:

`node_modules`, `.git`, `__pycache__`, `.venv`, `venv`, `dist`, `build`, `vendor`, `.next`, `.nuxt`, `target`, `.mypy_cache`, `.pytest_cache`

### Example Output

```
[Tech Debt] 7 TODO/FIXME items found across 4 files
Top items:
  src/auth/login.py:42: # TODO: Add rate limiting per IP
  src/auth/tokens.py:15: # FIXME: Token expiry not checked
  src/api/routes.py:88: # TODO: Validate pagination params
  tests/test_auth.py:3: # HACK: Mock needs cleanup
```

The harvester shows up to 10 items with relative file paths and line numbers, capped at 800 characters total.

## Commit Reminder

The `commit-reminder.py` script fires at the Stop hook when Claude finishes a turn. It checks for uncommitted changes and, if any exist, blocks the stop with a summary so Claude can suggest committing.

### What It Reports

The reminder counts staged and unstaged changes separately:

```
[Uncommitted Changes] 5 files with changes (2 staged, 3 unstaged).
Consider asking the user if they'd like to commit before finishing.
```

### Loop Prevention

The commit reminder uses the `stop_hook_active` guard to prevent infinite loops. If another Stop hook has already blocked (like the advisory test runner), the commit reminder skips itself rather than stacking blocks.

:::note[Advisory, Not Mandatory]
The commit reminder blocks the Stop to give Claude a chance to mention uncommitted changes, but it doesn't force a commit. Claude will typically ask if you'd like to commit -- you can say no and continue.
:::

## Hook Registration

| Script | Hook | Purpose |
|--------|------|---------|
| `git-state-injector.py` | SessionStart | Injects git branch, status, and recent commits |
| `todo-harvester.py` | SessionStart | Surfaces TODO/FIXME/HACK/XXX comment counts |
| `commit-reminder.py` | Stop | Reminds about uncommitted changes at turn boundaries |

## Related

- [Notify Hook](./notify-hook/) -- desktop notifications complement session context
- [Agent System](./agent-system/) -- agents receive session context through these hooks
- [Hooks](../customization/hooks/) -- how SessionStart and Stop hooks work
