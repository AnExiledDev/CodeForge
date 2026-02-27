---
name: worktree
description: >-
  Guides git worktree creation, management, and cleanup for parallel
  development workflows including EnterWorktree usage, .worktreeinclude
  setup, and worktree lifecycle. USE WHEN the user asks to "create a
  worktree", "work in a worktree", "set up parallel branches", "isolate
  my work", "clean up worktrees", "list worktrees", "enter worktree",
  "worktree include", or works with git worktree commands, EnterWorktree,
  or parallel development patterns. DO NOT USE for routine git branching
  or single-branch workflows.
version: 0.1.0
allowed-tools: Bash, Read, Grep, Glob, EnterWorktree
---

# Git Worktrees

## Mental Model

A git worktree is a parallel checkout of the same repository. One `.git` database, multiple working directories, each on a different branch. Think of it as having multiple monitors for code — same project, different contexts, simultaneously active.

The key difference from branches: a branch is a pointer to a commit; a worktree is a full working directory with its own index and working tree. Switching branches requires stashing, committing, or discarding changes. Switching worktrees means walking to a different directory.

Use worktrees when:
- **Parallel features** — work on two features without context-switching overhead
- **Safe experimentation** — try a risky refactor without touching the main checkout
- **Code review** — review a PR in one worktree while continuing work in another
- **Hotfixes** — address an urgent bug without stashing mid-feature work
- **Agent isolation** — give Claude Code agents their own working directory to prevent file conflicts

---

## Creating Worktrees

### Primary: EnterWorktree Tool (In-Session)

The fastest way to create a worktree during a Claude Code session. Call `EnterWorktree` with a descriptive name:

```text
EnterWorktree: feature-auth-oauth2
```

**Behavior:**
- Creates worktree at `<repo>/.claude/worktrees/<name>/`
- Branches from current HEAD
- Auto-names the branch `worktree-<name>`
- Session moves into the worktree directory
- **Auto-cleanup:** If no changes are made, the worktree and branch are removed on session exit. If changes exist, Claude prompts to keep or remove.

### CLI Flag: `--worktree`

Start a new Claude Code session directly in a worktree:

```bash
# Named worktree
claude --worktree feature-auth-oauth2

# Auto-generated name
claude --worktree

# Combined with tmux for background work
claude --worktree feature-auth-oauth2 --tmux
```

The worktree is created at `<repo>/.claude/worktrees/<name>/` with the same auto-cleanup behavior as `EnterWorktree`.

### Manual: `git worktree add`

For worktrees outside of Claude Code sessions, or when precise control over path and branch is needed:

```bash
# Create worktree with new branch
git worktree add /path/to/worktree -b feature-branch-name

# Create worktree tracking existing branch
git worktree add /path/to/worktree existing-branch
```

> **Deep dive:** See `references/manual-worktree-commands.md` for the full command reference with all flags, path conventions, and troubleshooting.

### Naming Conventions

- **Kebab-case, descriptive:** `feature-auth-oauth2`, `bugfix-login-timeout`, `spike-new-db`
- **Prefix with category:** `feature-`, `bugfix-`, `spike-`, `chore-`
- **Claude Code auto-naming:** Branches created by `--worktree` or `EnterWorktree` are prefixed `worktree-`

---

## Environment Setup

### `.worktreeinclude` File

New worktrees start with only tracked files. Environment files (`.env`, `.env.local`) are typically `.gitignore`-excluded and will be missing. The `.worktreeinclude` file solves this.

Place at the project root. It lists `.gitignore`-excluded files that should be **copied into every new worktree** automatically:

```gitignore
.env
.env.local
.env.*
**/.claude/settings.local.json
```

**Rules:**
- Uses `.gitignore` pattern syntax
- Only files matching **both** `.worktreeinclude` and `.gitignore` are copied
- Tracked files are never duplicated (they come from the checkout itself)
- Commit `.worktreeinclude` to the repo so the team benefits

**If `.worktreeinclude` doesn't exist:** Copy environment files manually after worktree creation, or create the file first.

### Post-Creation Checklist

After creating a worktree, the working directory needs initialization:

1. **Install dependencies** — `npm install`, `uv sync`, `cargo build`, or whatever the project requires. Worktrees share the git database but not `node_modules/`, `.venv/`, or `target/`.
2. **Run `/init`** — in a new Claude Code session within the worktree, run `/init` to orient Claude to the worktree context.
3. **Verify the dev environment** — run the test suite or start the dev server to confirm everything works.

---

## Managing Worktrees

### Listing

```bash
git worktree list
```

Output shows each worktree's path, HEAD commit, and branch:

```text
/workspaces/projects/CodeForge            d2ba55e [main]
/workspaces/projects/.worktrees/feature-a abc1234 [feature-a]
```

### Switching Context

Worktrees are directories. To switch context:
- **Terminal:** Open a new terminal and `cd` to the worktree path
- **VS Code Project Manager:** Worktrees in `.worktrees/` are auto-detected and tagged `"worktree"` — click to open
- **Claude Code:** Start a new session with `claude --worktree <name>` or use `EnterWorktree`

### Cleanup

**Claude Code auto-cleanup:**
- No changes → worktree and branch removed automatically on session exit
- Changes exist → prompted to keep or remove

**Manual cleanup** (confirm with user first — destructive):

```bash
# Remove a specific worktree
git worktree remove /path/to/worktree

# Force remove (discards uncommitted changes)
git worktree remove --force /path/to/worktree

# Clean up stale worktree references (after manual directory deletion)
git worktree prune
```

### Merging Work Back

After completing work in a worktree:

1. **Commit and push** the worktree branch
2. **Create a PR** from the worktree branch to the target branch
3. **After merge**, clean up:
   ```bash
   git worktree remove /path/to/worktree
   git branch -d worktree-feature-name  # delete merged branch
   ```

Alternatively, merge locally:
```bash
# From the main checkout
git merge feature-branch-name
```

---

## CodeForge Integration

### Project Manager Auto-Detection

The `setup-projects.sh` script scans `.worktrees/` directories at depth 3. Worktrees are detected by checking for a `.git` **file** (not directory) containing a `gitdir:` pointer. Detected worktrees receive both `"git"` and `"worktree"` tags in VS Code Project Manager.

### Agent Isolation

Five CodeForge agents use `isolation: worktree` in their frontmatter — refactorer, test-writer, migrator, documenter, and implementer. When spawned via the `Task` tool, these agents automatically get their own worktree copy of the repository. The worktree is cleaned up after the agent finishes (removed if no changes; kept if changes exist).

### Workspace Scope Guard

Each worktree is treated as an independent project directory by the workspace-scope-guard plugin. File operations are restricted to the worktree's directory boundary.

### Path Conventions

Two conventions coexist:

| Convention | Path | Used by |
|-----------|------|---------|
| **Native (primary)** | `<repo>/.claude/worktrees/<name>/` | `--worktree` flag, `EnterWorktree` tool |
| **Legacy** | `<container-dir>/.worktrees/<name>/` | Manual `git worktree add`, Project Manager detection |

Native is recommended for Claude Code sessions. Legacy is used for manual worktree management and remains supported by `setup-projects.sh`.

---

## Ambiguity Policy

- Default to `EnterWorktree` for in-session worktree creation.
- Default to the native path convention unless the user specifies otherwise.
- When the purpose is unclear, ask: "What will you work on in the worktree?"
- Default branch base: current branch HEAD, not main/master.
- Default cleanup: prompt before removing worktrees with uncommitted changes.
- When `.worktreeinclude` doesn't exist and the project has `.env` files, suggest creating one.
- For agent work, defer to the `team` skill for orchestration — worktree isolation is automatic for agents that declare it.

---

## Reference Files

| File | Contents |
|------|----------|
| `references/manual-worktree-commands.md` | Full `git worktree` command reference with all flags, path conventions, `.git` file anatomy, and troubleshooting |
| `references/parallel-workflow-patterns.md` | Workflow patterns for multi-worktree development, agent swarms, hooks, and anti-patterns |
