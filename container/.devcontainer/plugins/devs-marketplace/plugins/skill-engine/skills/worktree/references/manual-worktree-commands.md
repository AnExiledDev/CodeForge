# Git Worktree Command Reference

Complete reference for `git worktree` subcommands with flags, path conventions, and troubleshooting.

---

## `git worktree add`

Create a new worktree linked to the current repository.

```bash
# New branch from HEAD
git worktree add <path> -b <new-branch>

# Existing branch
git worktree add <path> <existing-branch>

# Detached HEAD at specific commit
git worktree add --detach <path> <commit>

# Track a remote branch
git worktree add <path> --track -b <local-name> origin/<remote-branch>
```

### Common Flags

| Flag | Purpose |
|------|---------|
| `-b <branch>` | Create and checkout a new branch |
| `-B <branch>` | Create or reset and checkout a branch |
| `--detach` | Checkout in detached HEAD state |
| `--track` | Set up tracking for the new branch |
| `--no-checkout` | Create worktree without checking out files (fast, populate later) |
| `--lock` | Lock the worktree immediately after creation |
| `-f` / `--force` | Override safeguards (e.g., allow checking out a branch already in another worktree) |
| `--orphan` | Create worktree with a new orphan branch (no parent commits) |

### Path Conventions

**Claude Code native convention (recommended for Claude sessions):**
```bash
# Automatic — handled by --worktree flag or EnterWorktree
# Path: <repo>/.claude/worktrees/<name>/
# Branch: worktree-<name>
claude --worktree feature-auth
```

**Legacy CodeForge convention (for manual management):**
```bash
# Container directory .worktrees/ sibling to repos
mkdir -p /workspaces/projects/.worktrees
git worktree add /workspaces/projects/.worktrees/<name> -b <branch>
```

**General best practice:**
- Keep worktrees in a predictable location
- Use the same naming pattern for worktree directories and branches
- Add the worktree directory to `.gitignore` if it lives inside the repo

---

## `git worktree list`

Show all worktrees linked to the repository.

```bash
# Default format
git worktree list

# Porcelain format (machine-readable)
git worktree list --porcelain
```

**Default output:**
```text
/workspaces/projects/CodeForge            d2ba55e [main]
/workspaces/projects/.worktrees/feature-a abc1234 [feature-a]
/workspaces/projects/.worktrees/bugfix-b  def5678 [bugfix-b] locked
```

**Porcelain output:**
```text
worktree /workspaces/projects/CodeForge
HEAD d2ba55eabc1234def5678901234567890abcdef
branch refs/heads/main

worktree /workspaces/projects/.worktrees/feature-a
HEAD abc1234def5678901234567890abcdef01234567
branch refs/heads/feature-a
```

---

## `git worktree remove`

Remove a worktree and its administrative files. **Destructive — confirm before executing.**

```bash
# Remove (fails if there are uncommitted changes)
git worktree remove <path>

# Force remove (discards uncommitted changes)
git worktree remove --force <path>
```

**Safety notes:**
- Without `--force`, refuses to remove worktrees with modified or untracked files
- Does NOT delete the branch — use `git branch -d <branch>` separately
- The main worktree (the original checkout) cannot be removed

---

## `git worktree prune`

Clean up stale worktree administrative data. Run this when a worktree directory was deleted manually without using `git worktree remove`.

```bash
# Prune stale references
git worktree prune

# Dry run — show what would be pruned
git worktree prune --dry-run

# Verbose — show details
git worktree prune --verbose
```

**When to use:**
- After manually deleting a worktree directory (e.g., `rm -rf`)
- When `git worktree list` shows a worktree that no longer exists on disk
- During routine repository maintenance

---

## `git worktree move`

Relocate an existing worktree to a new path.

```bash
git worktree move <old-path> <new-path>

# Force move (even if locked)
git worktree move --force <old-path> <new-path>
```

**Notes:**
- The main worktree cannot be moved
- Updates the `.git` file in the worktree and the metadata in the main repo
- Locked worktrees require `--force`

---

## `git worktree lock` / `unlock`

Prevent a worktree from being pruned (useful for worktrees on removable media or network shares).

```bash
# Lock with reason
git worktree lock --reason "on USB drive" <path>

# Unlock
git worktree unlock <path>
```

---

## Worktree `.git` File Anatomy

The main repository has a `.git` **directory**. Each worktree has a `.git` **file** (not directory) containing a pointer:

```text
gitdir: /workspaces/projects/CodeForge/.git/worktrees/feature-a
```

This pointer tells git where the worktree metadata is stored within the main repository's `.git/worktrees/` directory. The metadata includes:
- `HEAD` — current commit reference
- `commondir` — path back to the shared `.git` directory
- `gitdir` — path to the worktree's working directory

**Detection pattern:** To check if a directory is a worktree (not a standalone repo):
```bash
[ -f "$dir/.git" ] && grep -q "gitdir:" "$dir/.git"
```

---

## Troubleshooting

### "fatal: '<branch>' is already checked out"

A branch can only be checked out in one worktree at a time.

**Fix:** Use a different branch name, or remove the worktree that has it checked out:
```bash
git worktree list  # find which worktree has the branch
git worktree remove <path>  # remove it
```

### "fatal: '<path>' is a missing but locked worktree"

The worktree directory was deleted but the lock prevents pruning.

**Fix:**
```bash
git worktree unlock <path>
git worktree prune
```

### Stale worktree references after directory deletion

`git worktree list` shows worktrees that no longer exist on disk.

**Fix:**
```bash
git worktree prune --verbose
```

### Worktree not detected by `setup-projects.sh`

CodeForge auto-detection scans `.worktrees/` directories. Ensure:
1. The worktree is inside a `.worktrees/` directory
2. The worktree has a `.git` file with `gitdir:` (not a standalone repo)
3. Run `check-setup` to re-trigger project detection

### Shared state issues between worktrees

Worktrees share:
- The `.git` database (commits, branches, refs, stash)
- Git configuration (`.git/config`)
- Hooks (`.git/hooks/`)

Worktrees do NOT share:
- Working tree files
- Index (staging area)
- `node_modules/`, `.venv/`, `target/` (dependency directories)
- `.env` files (unless `.worktreeinclude` copies them)

If one worktree's operations seem to affect another, check for shared state leaks through the `.git` database (e.g., `git stash` is shared across all worktrees).
