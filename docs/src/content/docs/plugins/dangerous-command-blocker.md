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

### Dangerous Permissions

Commands that create security vulnerabilities through overly permissive file modes:

| Pattern | Example | Why It's Blocked |
|---------|---------|-----------------|
| `chmod 0777` / `chmod a=rwx` | `chmod 0777 app.py` | Creates world-writable files |
| `chmod u+s` / `chmod g+s` | `chmod u+s script` | Sets setuid/setgid bits, privilege escalation risk |

### Additional Git Safety

Commands that rewrite or destroy git history beyond basic force pushes:

| Pattern | Example | Why It's Blocked |
|---------|---------|-----------------|
| `--force-with-lease` | `git push --force-with-lease` | Safer force push but still rewrites history |
| `--force-if-includes` | `git push --force-if-includes` | Conditional force push still rewrites history |
| `git filter-branch` | `git filter-branch --tree-filter ...` | Rewrites entire repository history |
| Plus-refspec push | `git push origin +main` | Force push via refspec syntax |
| Branch deletion | `git push origin :branch` or `--delete` | Deletes remote branches |

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
| `docker system prune` | `docker system prune -a` | Removes all unused containers, images, networks |
| `docker volume rm` | `docker volume rm data` | Deletes persistent volume data |

## What Happens When a Command Is Blocked

When the blocker catches a dangerous command, you see a clear message explaining what was blocked and why:

```
Blocked: force push to main/master destroys history
```

The command never executes. Claude receives the block message and can suggest a safer alternative.

## Fail-Safe Behavior

The blocker follows a strict "fail closed" principle:

- If it can't parse the hook input JSON, it **blocks** the command (exit code 2) rather than allowing something it couldn't inspect.
- If an unexpected error occurs during pattern matching, it **blocks** the command (exit code 2). The blocker never allows a command through when it cannot verify safety.

## Overriding Blocks

The blocker uses exit code 2 to block commands, which is a **hard block** in Claude Code's hook system. Unlike exit code 1 (which can be overridden via the permission prompt), exit code 2 blocks cannot be bypassed through the UI. If you genuinely need to run a blocked command, you must either modify the plugin's `hooks.json` to adjust the patterns, or disable the plugin entirely in your `settings.json`.

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
