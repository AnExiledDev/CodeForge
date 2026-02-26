# session-context

Claude Code plugin that injects contextual information at session boundaries. Provides git state awareness at session start, surfaces TODO/FIXME markers, and reminds about uncommitted changes when Claude finishes responding.

## What It Does

Four hooks that run automatically at session lifecycle boundaries:

| Phase | Script | What It Injects |
|-------|--------|-----------------|
| Session start | `git-state-injector.py` | Current branch, status, recent commits, uncommitted changes |
| Session start | `todo-harvester.py` | Count and top 10 TODO/FIXME/HACK/XXX markers in the codebase |
| PostToolUse (Edit/Write) | `collect-session-edits.py` | Tracks which files the session modified (tmp file) |
| Stop | `commit-reminder.py` | Advisory about uncommitted changes (only if session edited files) |

All hooks are non-blocking and cap their output to prevent context bloat.

### Git State Injection

Runs at session start and injects:
- Current branch name
- Working tree status (up to 20 lines)
- Recent commit log
- Diff stat of uncommitted changes (up to 15 lines)
- Total output capped at 2000 characters

### TODO Harvesting

Scans source files for tech debt markers and injects a summary:
- Searches for `TODO`, `FIXME`, `HACK`, `XXX` comments
- File types: `.py`, `.ts`, `.tsx`, `.js`, `.jsx`, `.go`, `.rs`, `.sh`, `.svelte`, `.vue`, `.rb`, `.java`, `.kt`
- Shows total count plus top 10 items
- Output capped at 800 characters

### Edit Tracking

Lightweight PostToolUse hook on Edit/Write that records file paths to `/tmp/claude-session-edits-{session_id}`. Used by the commit reminder to determine if this session actually modified files.

### Commit Reminder

Fires when Claude stops responding, using tiered logic based on change significance:
- Checks the session edit tracker — skips entirely if session was read-only
- **Meaningful changes** (3+ files, 2+ source files, or test files): suggests committing via advisory `systemMessage`
- **Small changes** (1-2 non-source files): silent, no output
- Output wrapped in `<system-reminder>` tags — advisory only, never blocks
- Instructs Claude not to commit without explicit user approval
- Uses a guard flag to prevent infinite loops

## How It Works

### Hook Lifecycle

```
Session starts
  |
  +-> SessionStart fires
  |     |
  |     +-> git-state-injector.py
  |     |     |
  |     |     +-> Runs git branch, status, log, diff --stat
  |     |     +-> Caps output, injects as additionalContext
  |     |
  |     +-> todo-harvester.py
  |           |
  |           +-> Greps codebase for TODO/FIXME/HACK/XXX
  |           +-> Injects count + top 10 as additionalContext
  |
  |  ... Claude works ...
  |     |
  |     +-> PostToolUse (Edit|Write) fires
  |           |
  |           +-> collect-session-edits.py
  |                 |
  |                 +-> Appends file path to /tmp/claude-session-edits-{session_id}
  |
Claude stops responding
  |
  +-> Stop fires
        |
        +-> commit-reminder.py
              |
              +-> Session edited files? (checks tmp file)
              +-> No edits this session? -> Silent (no output)
              +-> Has edits + uncommitted changes? -> Inject advisory systemMessage
```

### Exit Code Behavior

All four scripts exit 0 (advisory only). They never block operations.

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Not a git repository | Silent exit (no output) |
| Git command failure | Silent exit (no output) |
| JSON parse failure | Silent exit |

### Timeouts

| Hook | Timeout |
|------|---------|
| Git state injection | 10s |
| TODO harvesting | 8s |
| Edit tracking | 3s |
| Commit reminder | 8s |

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
       "session-context@<clone-path>/.devcontainer/plugins/devs-marketplace": true
     }
   }
   ```

   Replace `<clone-path>` with the absolute path to your CodeForge clone.

## Plugin Structure

```
session-context/
+-- .claude-plugin/
|   +-- plugin.json            # Plugin metadata
+-- hooks/
|   +-- hooks.json               # Hook registrations (SessionStart + PostToolUse + Stop)
+-- scripts/
|   +-- git-state-injector.py    # Git state context (SessionStart)
|   +-- todo-harvester.py        # Tech debt markers (SessionStart)
|   +-- collect-session-edits.py # Edit tracking (PostToolUse)
|   +-- commit-reminder.py       # Uncommitted changes advisory (Stop)
+-- README.md                  # This file
```

## Requirements

- Python 3.11+
- Git (for git state injection and commit reminders)
- Claude Code with plugin hook support
