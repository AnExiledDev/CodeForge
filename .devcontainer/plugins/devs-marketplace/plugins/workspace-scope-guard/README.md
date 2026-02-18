# workspace-scope-guard

Claude Code plugin that enforces working directory scope for all file operations. Blocks writes outside the current project directory and warns on reads outside it. Prevents accidental cross-project modifications in multi-project workspaces.

## What It Does

Intercepts file operations (Read, Write, Edit, NotebookEdit, Glob, Grep) and checks whether the target path is within the current working directory:

| Operation | Out-of-scope behavior |
|-----------|-----------------------|
| Write, Edit, NotebookEdit | **Blocked** (exit 2) with error message |
| Read, Glob, Grep | **Warned** (exit 0) with advisory context |

When the current working directory is `/workspaces` (the workspace root), all operations are unrestricted.

### Allowed Prefixes

These paths are always permitted regardless of working directory:

| Path | Reason |
|------|--------|
| `/workspaces/.claude/` | Claude Code configuration |
| `/workspaces/.tmp/` | Temporary files |
| `/workspaces/.devcontainer/` | Container configuration |
| `/tmp/` | System temp directory |
| `/home/vscode/` | User home directory |

## How It Works

### Hook Lifecycle

```
Claude calls Read, Write, Edit, NotebookEdit, Glob, or Grep
  │
  └─→ PreToolUse hook fires
       │
       └─→ guard-workspace-scope.py
            │
            ├─→ cwd is /workspaces? → allow (unrestricted)
            ├─→ No target path? → allow (tool defaults to cwd)
            ├─→ Resolve path via os.path.realpath() (handles symlinks/worktrees)
            ├─→ Path is within cwd? → allow
            ├─→ Path matches allowed prefix? → allow
            ├─→ Write tool + out of scope → exit 2 (block)
            └─→ Read tool + out of scope → exit 0 (warn via additionalContext)
```

### Symlink and Worktree Handling

Target paths are resolved with `os.path.realpath()` before scope checking. This correctly handles:
- Symbolic links that point outside the working directory
- Git worktree paths (`.git` file containing `gitdir:`)

### Path Field Mapping

The script extracts the target path from different tool input fields:

| Tool | Input Field |
|------|-------------|
| Read | `file_path` |
| Write | `file_path` |
| Edit | `file_path` |
| NotebookEdit | `notebook_path` |
| Glob | `path` |
| Grep | `path` |

### Error Handling

| Scenario | Behavior |
|----------|----------|
| JSON parse failure | Fails open (exit 0) |
| Other exceptions | Fails open (exit 0) — logs error to stderr |

### Timeout

The hook has a 5-second timeout.

## Plugin Structure

```
workspace-scope-guard/
├── .claude-plugin/
│   └── plugin.json                # Plugin metadata
├── hooks/
│   └── hooks.json                 # PreToolUse hook registration
├── scripts/
│   └── guard-workspace-scope.py   # Scope enforcement (PreToolUse)
└── README.md                      # This file
```

## Requirements

- Python 3.11+
- Claude Code with plugin hook support
