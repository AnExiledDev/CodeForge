# workspace-scope-guard

Nuclear workspace scope enforcement for Claude Code. Blocks ALL operations (read, write, bash) outside the current working directory. Permanently blacklists `/workspaces/.devcontainer/` — no exceptions, no bypass, even from workspace root.

## What It Does

Intercepts all file and bash operations and enforces strict scope boundaries:

| Operation | Out-of-scope behavior |
|-----------|-----------------------|
| Write, Edit, NotebookEdit | **Blocked** (exit 2) |
| Read, Glob, Grep | **Blocked** (exit 2) |
| Bash | **Blocked** (exit 2) — two-layer detection |
| Unknown tools | **Blocked** (exit 2) |

### Blacklisted Paths

`/workspaces/.devcontainer/` is permanently blocked for ALL operations — reads, writes, and bash commands. This blacklist:

- Runs BEFORE all other checks (scope, allowlist, cwd bypass)
- Cannot be overridden, even when cwd is `/workspaces`
- Prevents the most common scope escape: writing to the workspace-root devcontainer instead of the project's

### Allowlisted Paths

These paths are always permitted regardless of working directory:

| Path | Reason |
|------|--------|
| `~/.claude/` | Claude config, plans, rules |
| `/tmp/` | System temp directory |

### Worktree Support

When CWD is inside a `.claude/worktrees/<id>` directory (e.g., when an agent runs in a git worktree), the guard automatically expands scope to the **project root** — the parent of `.claude/worktrees/`.

This means:
- Sibling worktrees under the same project are **in-scope**
- The main project directory is **in-scope**
- Other projects remain **out-of-scope**

Example: if CWD is `/workspaces/projects/MyApp/.claude/worktrees/agent-abc123`, the scope root becomes `/workspaces/projects/MyApp/`. All paths under that root are permitted.

### Path Resolution

Both CWD and target paths are resolved via `os.path.realpath()` before comparison. This prevents false positives when paths involve symlinks or bind mounts.

### CWD Context Injection

The plugin injects working directory awareness on four hook events:

| Hook Event | Purpose |
|-----------|---------|
| SessionStart | Set scope context at session begin |
| UserPromptSubmit | Remind scope on every prompt |
| PreToolUse | Context alongside scope enforcement |
| SubagentStart | Ensure subagents know their scope |

When in a worktree, the injected context references the project root as the scope boundary.

## How It Works

### Hook Lifecycle (File Tools)

```
Claude calls Read, Write, Edit, NotebookEdit, Glob, or Grep
  │
  └─→ PreToolUse hook fires
       │
       └─→ guard-workspace-scope.py
            │
            ├─→ Resolve CWD via os.path.realpath()
            ├─→ Resolve scope root (worktree → project root)
            ├─→ Extract target path from tool input
            ├─→ Resolve target via os.path.realpath() (handles symlinks)
            ├─→ BLACKLIST check (first!) → exit 2 if blacklisted
            ├─→ scope root is /workspaces? → allow (bypass, blacklist already checked)
            ├─→ Path within scope root? → allow
            ├─→ Path on allowlist? → allow
            └─→ Out of scope → exit 2 (block with resolved path details)
```

### Hook Lifecycle (Bash)

```
Claude calls Bash
  │
  └─→ PreToolUse hook fires
       │
       └─→ guard-workspace-scope.py
            │
            ├─→ Resolve CWD + scope root (worktree-aware)
            ├─→ Extract write targets (Layer 1) + workspace paths (Layer 2)
            ├─→ BLACKLIST check on ALL extracted paths → exit 2 if any blacklisted
            ├─→ scope root is /workspaces? → allow (bypass, blacklist already checked)
            ├─→ Layer 1: Check write targets against scope root
            │    ├─→ System command exemption (only if ALL targets are system paths)
            │    └─→ exit 2 if any write target out of scope
            └─→ Layer 2: Scan ALL /workspaces/ paths in command (ALWAYS runs)
                 └─→ exit 2 if any workspace path out of scope
```

### Bash Two-Layer Detection

**Layer 1 — Write target extraction:** 20+ regex patterns extract file paths from write operations (redirects, cp, mv, touch, mkdir, rm, ln, rsync, chmod, chown, dd, wget, curl, tar, unzip, gcc, sqlite3, etc.). Each target is resolved and scope-checked.

System commands (git, pip, npm, etc.) get a Layer 1 exemption ONLY when ALL write targets resolve to system paths (`/usr/`, `/bin/`, `/sbin/`, `/lib/`, `/opt/`, `/proc/`, `/sys/`, `/dev/`, `/var/`, `/etc/`). Any `/workspaces/` write target outside cwd cancels the exemption.

**Layer 2 — Workspace path scan (ALWAYS runs):** Regex scans the entire command for any `/workspaces/` path string. Catches paths in inline scripts (`python3 -c`), variable assignments, quoted strings, and anything Layer 1 misses. No exemptions, no bypass.

### Path Field Mapping

| Tool | Input Field |
|------|-------------|
| Read | `file_path` |
| Write | `file_path` |
| Edit | `file_path` |
| NotebookEdit | `notebook_path` |
| Glob | `path` |
| Grep | `path` |
| Bash | `command` (multi-path extraction) |

### Error Handling

| Scenario | Behavior |
|----------|----------|
| JSON parse failure | **Blocked** (exit 2) — fail closed |
| Any exception | **Blocked** (exit 2) — fail closed |
| Hook timeout | Fails open (Claude Code runtime limitation) — mitigated by 10s timeout and pure computation (no I/O) |

## Known Limitations

| Limitation | Why It's Accepted |
|-----------|-------------------|
| Pre-set env vars (`$OUTDIR/file` from prior command) | Layer 2 only catches literal `/workspaces/` strings. Variable set in same command IS caught. |
| Base64-encoded paths | Not an accidental misuse pattern |
| Bash brace expansion | Not an accidental directory construction pattern |
| Variable concatenation across statements | No single literal path exists to match |
| Hook timeout fails open | Mitigated: 10s timeout, pure computation, no I/O |

## Installation

### CodeForge DevContainer

Pre-installed and activated automatically — no setup needed.

### From GitHub

Use this plugin in any Claude Code setup:

1. Clone the [CodeForge](https://github.com/AnExiledDev/CodeForge) repository:

   ```bash
   git clone https://github.com/AnExiledDev/CodeForge.git
   ```

2. Enable the plugin in your `.claude/settings.json`:

   ```json
   {
     "enabledPlugins": {
       "workspace-scope-guard@<clone-path>/.devcontainer/plugins/devs-marketplace": true
     }
   }
   ```

   Replace `<clone-path>` with the absolute path to your CodeForge clone.

## Plugin Structure

```
workspace-scope-guard/
├── .claude-plugin/
│   └── plugin.json                  # Plugin metadata
├── hooks/
│   └── hooks.json                   # Hook registrations (6 events)
├── scripts/
│   ├── guard-workspace-scope.py     # Scope enforcement (PreToolUse)
│   └── inject-workspace-cwd.py      # CWD context injection (4 events)
└── README.md                        # This file
```

## Requirements

- Python 3.11+
- Claude Code with plugin hook support
