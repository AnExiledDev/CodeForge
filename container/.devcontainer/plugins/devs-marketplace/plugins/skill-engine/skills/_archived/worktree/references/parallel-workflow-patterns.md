# Parallel Workflow Patterns

Worktree usage patterns for multi-context development, agent orchestration, and lifecycle customization.

---

## Pattern 1: Feature + Review

Work on a feature in one worktree while reviewing a PR in another.

**Setup:**
```bash
# Main checkout: feature work
# New worktree: PR review
git worktree add /workspaces/projects/.worktrees/review-pr-123 -b review/pr-123
cd /workspaces/projects/.worktrees/review-pr-123
git fetch origin pull/123/head:review/pr-123
git checkout review/pr-123
```

**Workflow:**
1. Continue feature work in the main checkout
2. Switch to the review worktree to read, test, and comment on the PR
3. No stashing, no context loss
4. Remove review worktree after PR is merged

**When to use:** Long-running feature work that cannot be interrupted, combined with review responsibilities.

---

## Pattern 2: Safe Experimentation

Try a risky refactor or architectural change without affecting the working checkout.

**Setup:**
```bash
claude --worktree spike-new-architecture
# or
EnterWorktree: spike-new-architecture
```

**Workflow:**
1. Experiment freely in the worktree — break things, try approaches
2. If the experiment succeeds: commit, create PR
3. If it fails: exit the session → Claude auto-removes the worktree (no changes kept)
4. Main checkout is untouched regardless of outcome

**When to use:** Evaluating whether an approach works before committing to it. Especially useful for refactors that touch many files.

---

## Pattern 3: Agent Swarm

Multiple Claude Code sessions working in parallel, each in their own worktree.

**Setup (manual):**
```bash
# Terminal 1
claude --worktree feature-auth --tmux

# Terminal 2
claude --worktree feature-search --tmux

# Terminal 3
claude --worktree fix-tests --tmux
```

**Setup (via agent teams):**
Agents with `isolation: worktree` in their frontmatter (refactorer, test-writer, migrator, documenter, implementer) automatically get worktrees when spawned via the `Task` tool. The lead agent coordinates, and each teammate operates in its own isolated copy.

**Workflow:**
1. Each agent/session works on independent files
2. Changes stay isolated until explicitly merged
3. Reduced conflict risk when file ownership is respected
4. After each session completes, review changes via PR

**When to use:** Large tasks that decompose into independent workstreams. Effective for feature builds, migrations, or test suites where each agent owns a different set of files.

**File ownership rule:** Assign each parallel session/agent to a distinct set of files. Two agents editing the same file causes merge conflicts that are difficult to resolve.

---

## Pattern 4: Hotfix While Mid-Feature

An urgent production bug arrives while deep in unfinished feature work.

**Without worktrees:**
```bash
git stash          # hope you remember what's stashed
git checkout main
# fix the bug
git checkout feature-branch
git stash pop      # hope there are no conflicts
```

**With worktrees:**
```bash
claude --worktree hotfix-critical-bug
# fix the bug in the worktree, commit, create PR
# exit → worktree cleaned up
# continue feature work — never interrupted
```

**When to use:** Anytime urgent work arrives while mid-task. The worktree avoids the stash-switch-pop dance entirely.

---

## Pattern 5: Long-Running Migration

Incremental migration work spread across multiple sessions.

**Setup:**
```bash
git worktree add /workspaces/projects/.worktrees/migrate-v2 -b migrate/v2-upgrade
```

**Workflow:**
1. Work on the migration across multiple Claude sessions using `claude --resume`
2. The worktree persists between sessions (not auto-cleaned because it has changes)
3. Make incremental commits as milestones are reached
4. When migration is complete, create PR from the worktree branch
5. Clean up after merge

**When to use:** Multi-day migrations where the work cannot be completed in a single session. Keep the worktree alive until the migration PR is merged.

---

## Anti-Patterns

### Too Many Worktrees

**Problem:** Five or more active worktrees with partially-complete work scattered across them.

**Consequence:** Cognitive overhead of tracking what's where. Dependency directories (`node_modules/`, `.venv/`) duplicated across worktrees consume disk space.

**Guideline:** Limit to 2-3 active worktrees. Finish and clean up before starting new ones.

### Forgetting Cleanup

**Problem:** Worktrees accumulate after sessions end. `git worktree list` shows stale entries.

**Consequence:** Branch namespace pollution, stale references, wasted disk space.

**Guideline:** Clean up worktrees as part of completing a task. Run `git worktree list` periodically. Use `git worktree prune` for stale references.

### Shared State Leaks

**Problem:** Operations in one worktree unexpectedly affect another.

**Examples:**
- `git stash` — the stash is shared across all worktrees
- `git gc` — can repack objects used by other worktrees
- `.git/config` changes — affect all worktrees
- Global hooks — run in all worktrees

**Guideline:** Avoid `git stash` in worktree workflows (use commits instead). Be cautious with global git config changes.

### Editing the Same File in Multiple Worktrees

**Problem:** Two worktrees modify the same file independently.

**Consequence:** Merge conflict when integrating changes, requiring manual resolution.

**Guideline:** Assign file ownership. Each worktree/agent edits a distinct set of files. If overlap is unavoidable, coordinate explicitly before merging.

---

## Worktree Lifecycle Hooks

Claude Code provides `WorktreeCreate` and `WorktreeRemove` hooks for customizing worktree lifecycle behavior.

### WorktreeCreate Hook

Fires when a worktree is being created via `--worktree` or `isolation: "worktree"`. **Replaces** the default git worktree behavior entirely.

**Input:**
```json
{
  "session_id": "abc123",
  "cwd": "/workspaces/projects/CodeForge",
  "hook_event_name": "WorktreeCreate",
  "name": "feature-auth"
}
```

**Output:** Print the absolute path to the created worktree directory on stdout.

**Use cases:**
- Custom directory layout (override the default `.claude/worktrees/` path)
- Non-git VCS (SVN, Mercurial) worktree creation
- Post-creation setup (install dependencies, copy config files)

### WorktreeRemove Hook

Fires when a worktree is being removed (session exit or subagent finish). Cleanup counterpart to WorktreeCreate.

**Input:**
```json
{
  "session_id": "abc123",
  "hook_event_name": "WorktreeRemove",
  "worktree_path": "/workspaces/projects/CodeForge/.claude/worktrees/feature-auth"
}
```

**Use cases:**
- Custom cleanup (remove dependency directories, revoke temporary credentials)
- Non-git VCS cleanup
- Logging or notification on worktree removal

**Configuration:** Hooks are defined in `.claude/settings.json` or `.claude/settings.local.json`:

```json
{
  "hooks": {
    "WorktreeCreate": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash /path/to/create-worktree.sh"
          }
        ]
      }
    ]
  }
}
```
