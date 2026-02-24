---
title: Dangerous Command Blocker
description: The dangerous command blocker plugin prevents execution of destructive shell commands during Claude Code sessions.
sidebar:
  order: 7
---

The dangerous command blocker is your safety net against catastrophic shell commands. It intercepts every Bash command before execution and blocks patterns known to cause irreversible damage -- things like `rm -rf /`, force-pushing to main, or writing to system directories.

## How It Works

The plugin registers a PreToolUse hook that fires before every Bash tool call. The `block-dangerous.py` script checks the command against a set of regex patterns. If a match is found, the command is blocked with exit code 2 and a clear explanation of why it was stopped.

Commands that don't match any dangerous pattern pass through untouched with zero overhead.

## Blocked Command Categories

### Destructive File Deletion

Commands that could wipe out large portions of the filesystem:

| Pattern | Example | Why It's Blocked |
|---------|---------|-----------------|
| `rm -rf /` | `rm -rf /` | Deletes the entire filesystem |
| `rm -rf ~` | `rm -rf ~/` | Deletes the user's home directory |
| `rm -rf ../` | `rm -rf ../../` | Escapes up the directory tree |
| `sudo rm` | `sudo rm -rf /var/log` | Privileged deletion bypasses permissions |
| `find -exec rm` | `find . -exec rm {} \;` | Recursive deletion via find |
| `find -delete` | `find /tmp -delete` | Bulk deletion via find |

### Git History Destruction

Commands that destroy or overwrite git history in ways that are difficult to recover:

| Pattern | Example | Why It's Blocked |
|---------|---------|-----------------|
| Force push to main/master | `git push --force origin main` | Overwrites shared history |
| Bare force push | `git push -f` | Force push without specifying target |
| Hard reset to remote | `git reset --hard origin/main` | Discards all local work |
| git clean -f | `git clean -fd` | Permanently removes untracked files |

:::caution[Force Push Safety]
Even `git push -f` without specifying a branch is blocked, because it could unintentionally force-push to the current branch. The blocker requires you to be explicit about what you're doing.
:::

### System Modification

Commands that modify critical system directories or create security vulnerabilities:

| Pattern | Example | Why It's Blocked |
|---------|---------|-----------------|
| `chmod 777` | `chmod 777 app.py` | Creates world-writable files |
| `chmod -R 777` | `chmod -R 777 /var/www` | Recursively weakens permissions |
| Write to system dirs | `> /usr/local/bin/script` | Modifies system binaries |
| Write to `/etc/` | `echo "config" > /etc/hosts` | Modifies system configuration |
| Write to `/bin/` or `/sbin/` | `> /bin/script` | Modifies core system binaries |

### Disk and Device Operations

Commands that could destroy disk contents:

| Pattern | Example | Why It's Blocked |
|---------|---------|-----------------|
| `mkfs.*` | `mkfs.ext4 /dev/sda1` | Formats a disk partition |
| `dd of=/dev/` | `dd if=/dev/zero of=/dev/sda` | Overwrites a device |

### Container Security

Commands that could break container isolation:

| Pattern | Example | Why It's Blocked |
|---------|---------|-----------------|
| `docker run --privileged` | `docker run --privileged ubuntu` | Allows container escape |
| Mount host root | `docker run -v /:/host ubuntu` | Exposes host filesystem |
| Destructive docker ops | `docker rm container_id` | Stops, removes, or kills containers and images (`docker rmi`) |

## What Happens When a Command Is Blocked

When the blocker catches a dangerous command, you see a clear message explaining what was blocked and why:

```
Blocked: force push to main/master destroys history
```

The command never executes. Claude receives the block message and can suggest a safer alternative.

## Fail-Safe Behavior

The blocker follows a "fail closed" principle for its own errors:

- If it can't parse the hook input JSON, it blocks the command (exit code 2) rather than allowing something it couldn't inspect.
- If an unexpected error occurs during pattern matching, it logs the error but allows the command through to avoid blocking legitimate work on a hook bug.

## Overriding Blocks

The blocker is designed to catch accidental destructive commands, not to prevent intentional operations. If you genuinely need to run a blocked command, you can use the Claude Code permission prompt to explicitly approve it. The blocker respects user intent -- it's a guardrail, not a cage.

:::note[Complementary Guards]
This plugin handles command-level safety. For file-path-level protection, see the [Workspace Scope Guard](./workspace-scope-guard/) and [Protected Files Guard](./protected-files-guard/), which cover different attack surfaces.
:::

## Hook Registration

| Script | Hook | Matcher | Purpose |
|--------|------|---------|---------|
| `block-dangerous.py` | PreToolUse | Bash | Inspects and blocks dangerous shell commands |

## Related

- [Workspace Scope Guard](./workspace-scope-guard/) -- complements command blocking with path enforcement
- [Protected Files Guard](./protected-files-guard/) -- protects specific files from modification
- [Hooks](../customization/hooks/) -- how PreToolUse hooks intercept commands
