# dangerous-command-blocker

Claude Code plugin that intercepts Bash tool calls and blocks destructive commands before they execute. Acts as a safety net against accidental or misguided destructive operations.

## What It Does

Inspects every Bash command Claude attempts to run against a set of dangerous patterns. If a match is found, the command is blocked with an error message explaining why. Safe commands pass through untouched.

### Blocked Patterns

| Category | Examples |
|----------|----------|
| Destructive filesystem deletion | `rm -rf /`, `rm -rf ~`, `rm -rf ../` |
| Privileged deletion | `sudo rm` |
| World-writable permissions | `chmod 777`, `chmod -R 777` |
| Force push to main/master | `git push --force origin main`, `git push -f origin master` |
| Bare force push | `git push -f`, `git push --force` (no branch specified) |
| Git history destruction | `git reset --hard origin/main`, `git clean -f` |
| System directory writes | `> /usr/`, `> /etc/`, `> /bin/`, `> /sbin/` |
| Disk formatting | `mkfs.*`, `dd of=/dev/` |
| Docker container escape | `docker run --privileged`, `docker run -v /:/...` |
| Destructive Docker operations | `docker stop`, `docker rm`, `docker kill`, `docker rmi` |
| Dangerous find operations | `find -exec rm`, `find -delete` |

## How It Works

### Hook Lifecycle

```
Claude calls the Bash tool
  │
  └─→ PreToolUse hook fires for Bash
       │
       └─→ block-dangerous.py reads the command from stdin
            │
            ├─→ Pattern match found → exit 2 (block with error)
            └─→ No match → exit 0 (allow)
```

### Exit Code Behavior

| Exit Code | Meaning |
|-----------|---------|
| 0 | Command is safe — allow execution |
| 2 | Command matches a dangerous pattern — block with error message |

### Error Handling

- **JSON parse failure**: Fails closed (exit 2) — if the input can't be read, the command is blocked
- **Other exceptions**: Fails open (exit 0) — logs the error to stderr but does not block

### Timeout

The hook has a 5-second timeout. If the script takes longer, Claude Code proceeds with the command.

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
       "dangerous-command-blocker@<clone-path>/.devcontainer/plugins/devs-marketplace": true
     }
   }
   ```

   Replace `<clone-path>` with the absolute path to your CodeForge clone.

## Plugin Structure

```
dangerous-command-blocker/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata
├── hooks/
│   └── hooks.json           # PreToolUse/Bash hook registration
├── scripts/
│   └── block-dangerous.py   # Pattern matcher (PreToolUse)
└── README.md                # This file
```

## Requirements

- Python 3.11+
- Claude Code with plugin hook support
