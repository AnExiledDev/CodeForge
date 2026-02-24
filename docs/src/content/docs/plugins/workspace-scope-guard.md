---
title: Workspace Scope Guard
description: Nuclear workspace scope enforcement — blocks all operations outside the current project directory, permanently blacklists /workspaces/.devcontainer/.
sidebar:
  order: 8
---

The workspace scope guard enforces hard boundaries around your current project. In a multi-project workspace, it ensures that ALL file operations and bash commands target only the project you're working in — preventing reads, writes, and command execution outside the project directory.

## How It Works

The plugin registers hooks across multiple events:

| Hook Event | Script | Purpose |
|-----------|--------|---------|
| PreToolUse | `guard-workspace-scope.py` | Block out-of-scope file and bash operations |
| PreToolUse | `inject-workspace-cwd.py` | Inject CWD context alongside enforcement |
| SessionStart | `inject-workspace-cwd.py` | Set scope context at session begin |
| UserPromptSubmit | `inject-workspace-cwd.py` | Remind scope on every prompt |
| SubagentStart | `inject-workspace-cwd.py` | Ensure subagents know their scope |

The scope guard intercepts every file-related tool call (Read, Write, Edit, NotebookEdit, Glob, Grep) **and Bash commands**. Before the tool executes, `guard-workspace-scope.py` resolves target paths and checks whether they fall within the current working directory.

**All violations are hard-blocked** (exit code 2):

| Operation | Out-of-Scope Behavior |
|-----------|----------------------|
| **Write, Edit, NotebookEdit** | Blocked with error message |
| **Read, Glob, Grep** | Blocked with error message |
| **Bash** | Blocked — two-layer path detection |
| **Unknown tools** | Blocked — fail closed |

## Blacklisted Paths

`/workspaces/.devcontainer/` is **permanently blocked** for ALL operations — reads, writes, and bash commands. This is the single most common scope escape: Claude writing to the workspace-root devcontainer instead of the project's own `.devcontainer/`.

The blacklist:
- Runs **before** all other checks (scope, allowlist, cwd bypass)
- **Cannot be overridden**, even when cwd is `/workspaces`
- Blocks the exact path and everything under it

## Scope Rules

### What's In Scope

Everything under the current working directory:

```
/workspaces/projects/MyProject/          -- project root (cwd)
/workspaces/projects/MyProject/src/      -- in scope
/workspaces/projects/MyProject/tests/    -- in scope
/workspaces/projects/MyProject/.specs/   -- in scope
```

### What's Out of Scope

Anything outside the project root is blocked:

```
/workspaces/projects/OtherProject/       -- blocked (sibling project)
/workspaces/.devcontainer/               -- BLOCKED (blacklisted — always)
/workspaces/projects/MyProject2/         -- blocked (different project)
/home/vscode/                            -- blocked (outside workspace)
/etc/hosts                               -- blocked (system path)
```

:::tip[Working from Workspace Root]
When your current directory is `/workspaces` (the workspace root itself), the scope guard allows operations within `/workspaces/` — **except** for blacklisted paths. `/workspaces/.devcontainer/` remains blocked even from workspace root.
:::

### Allowlisted Paths

A minimal set of paths are always allowed:

| Allowed Path | Reason |
|-------------|--------|
| `/workspaces/.claude/` | Claude config, plans, rules |
| `/tmp/` | System temp directory |

## Bash Enforcement

Bash commands receive two-layer scope enforcement:

### Layer 1 — Write Target Extraction

20+ regex patterns extract file paths from write operations: redirects (`>`), cp, mv, touch, mkdir, rm, ln, rsync, chmod, chown, dd, wget -O, curl -o, tar -C, unzip -d, gcc -o, sqlite3, and more. Each extracted target is resolved and scope-checked.

**System command exemption:** Commands like `git`, `pip`, `npm` get a Layer 1 exemption ONLY when ALL write targets resolve to system paths (`/usr/`, `/bin/`, etc.). Any `/workspaces/` write target outside cwd cancels the exemption.

### Layer 2 — Workspace Path Scan

A regex scans the **entire command** for any `/workspaces/` path string. This catches everything Layer 1 misses:

- Inline scripts: `python3 -c "open('/workspaces/...')"`
- Variable assignments: `DIR=/workspaces/.devcontainer; ...`
- Quoted paths in any context
- Tool-specific flags: `pip install --target /workspaces/...`

Layer 2 **always runs** — no exemptions, no system command bypass.

### What Gets Through

```bash
# ALLOWED — no /workspaces/ paths, system commands
pip install requests
git status
npm test

# BLOCKED — writes to blacklisted path
echo test > /workspaces/.devcontainer/foo
cp file /workspaces/.devcontainer/

# BLOCKED — references blacklisted path (Layer 2)
python3 -c "open('/workspaces/.devcontainer/f','w')"
npm install --prefix /workspaces/.devcontainer/

# BLOCKED — workspace path outside cwd (Layer 2)
DIR=/workspaces/.devcontainer; echo > $DIR/foo
```

## Intercepted Tools

The guard inspects different fields per tool:

| Tool | Path Field Inspected |
|------|---------------------|
| Read | `file_path` |
| Write | `file_path` |
| Edit | `file_path` |
| NotebookEdit | `notebook_path` |
| Glob | `path` |
| Grep | `path` |
| Bash | `command` (multi-path extraction) |

When a tool doesn't specify a path (e.g., Glob without a `path` parameter), it defaults to the current working directory, which is always in scope.

## Error Handling

The guard **fails closed** on all errors:

| Scenario | Behavior |
|----------|----------|
| JSON parse failure | **Blocked** (exit 2) |
| Any exception | **Blocked** (exit 2) |
| Hook timeout | Fails open (Claude Code runtime limitation) — mitigated by 10s timeout and pure computation |

## CWD Context Injection

`inject-workspace-cwd.py` fires on SessionStart, UserPromptSubmit, PreToolUse, and SubagentStart to inject:

- The current working directory
- A reminder that `/workspaces/.devcontainer/` is blacklisted
- The correct project-relative path to use instead

This ensures Claude always knows the correct scope, even across subagent boundaries.

## Related

- [Dangerous Command Blocker](./dangerous-command-blocker/) — complements scope guard with command-level protection
- [Protected Files Guard](./protected-files-guard/) — guards specific files within the project
