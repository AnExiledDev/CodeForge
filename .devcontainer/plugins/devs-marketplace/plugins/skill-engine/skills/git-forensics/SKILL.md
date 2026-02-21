---
name: git-forensics
description: >-
  This skill should be used when the user asks to "find who changed this line",
  "search git history for a deleted function", "bisect a regression",
  "recover a lost commit", "investigate when a bug was introduced",
  "trace the history of a file", "search commit messages",
  "find when code was removed", "check git blame", "use git reflog",
  or discusses git archaeology, git bisect, git log search, pickaxe,
  blame analysis, reflog recovery, or commit history investigation.
version: 0.1.0
---

# Git Forensics

## Mental Model

Git is a **forensic evidence system**. Every commit is a timestamped, attributed snapshot of a decision someone made. The history doesn't just record *what* changed -- it records *who* changed it, *when* they changed it, and (if commit messages are good) *why* they changed it.

Git forensics answers questions that code alone cannot:
- "When did this behavior change?" -- `git bisect`
- "Who last touched this logic and why?" -- `git blame`
- "When was this function deleted?" -- `git log -S`
- "What did this file look like 6 months ago?" -- `git show`
- "I accidentally reset -- can I recover?" -- `git reflog`

The key insight is that git stores *content*, not *files*. Git tracks blobs of content, and commands like `git log -S` search for when content was added or removed regardless of which file it was in. This makes git a powerful search engine for code archaeology.

Approach every investigation with a hypothesis. Start with the broadest tool (`git log`) to narrow the timeframe, then use focused tools (`git blame`, `git bisect`) to identify the exact commit.

---

## Essential Commands

These commands form the daily toolkit for understanding code history:

```bash
# Compact commit history with branch topology
git log --oneline --graph --all

# History of a specific file
git log --oneline -- path/to/file.py

# Show what changed in a specific commit
git show abc1234

# Show a file at a specific commit
git show abc1234:path/to/file.py

# Diff between two commits
git diff abc1234 def5678

# Diff between two branches
git diff main..feature-branch

# Who last modified each line (with commit and date)
git blame path/to/file.py

# Blame a specific line range
git blame -L 42,60 path/to/file.py
```

---

## Advanced Archaeology

### Pickaxe Search (`-S`)

Find commits that **added or removed** a specific string. This is the most powerful tool for finding when code appeared or disappeared:

```bash
# Find when "calculate_tax" was added or removed
git log -S "calculate_tax" --oneline

# With diff to see the actual change
git log -S "calculate_tax" -p

# Restrict to specific files
git log -S "calculate_tax" --oneline -- "*.py"
```

`-S` counts occurrences -- it finds commits where the number of times the string appears changed. It's fast because it doesn't need to regex-match every line of every diff.

### Regex Search (`-G`)

Find commits where **a line matching a regex was added or removed**. More flexible than `-S` but slower:

```bash
# Find commits that changed lines containing a pattern
git log -G "def\s+calculate_\w+" --oneline

# Combined with file filter
git log -G "TODO|FIXME|HACK" --oneline -- "*.py"
```

The difference: `-S "foo"` finds commits where the count of "foo" changed. `-G "foo"` finds commits where any changed line matches "foo". Use `-S` for exact strings, `-G` for patterns.

### Follow Renames (`--follow`)

Track a file across renames. Without `--follow`, history stops at the rename:

```bash
# Follow a file through renames
git log --follow --oneline -- path/to/current_name.py

# Blame through renames
git log --follow -p -- path/to/file.py
```

### Contributor Statistics

```bash
# Commits per author (sorted)
git shortlog -sn --no-merges

# Commits per author in a date range
git shortlog -sn --after="2024-01-01" --before="2024-07-01"

# Files most frequently changed (hot spots)
git log --pretty=format: --name-only | sort | uniq -c | sort -rn | head -20
```

> **Deep dive:** See `references/advanced-commands.md` for the full command reference with all flags and options.

---

## Bisect Workflow

`git bisect` performs a binary search through commit history to find the exact commit that introduced a bug. It halves the search space with each step.

### Manual Bisect

```bash
# Start bisecting
git bisect start

# Mark the current commit as bad (has the bug)
git bisect bad

# Mark a known-good commit (did not have the bug)
git bisect good v2.1.0

# Git checks out a middle commit. Test it, then:
git bisect good    # if this commit doesn't have the bug
git bisect bad     # if this commit has the bug

# Repeat until git identifies the first bad commit
# When done:
git bisect reset   # return to your original branch
```

For 1000 commits, bisect finds the culprit in ~10 steps (log2(1000)).

### Automated Bisect

Provide a test script that exits 0 for good and non-zero for bad:

```bash
# Automated bisect with a test command
git bisect start HEAD v2.1.0
git bisect run pytest tests/test_tax.py -x

# Or with a custom script
git bisect run bash -c '
    python -c "from myapp import calculate_tax; assert calculate_tax(100) == 7.5"
'
```

The test script must be:
- **Self-contained** -- it can't rely on state from previous runs
- **Deterministic** -- same commit, same result
- **Fast** -- it runs once per bisect step; slow tests multiply the total time

Exit code 125 tells bisect to skip the current commit (useful for commits that don't compile).

> **Deep dive:** See `references/investigation-playbooks.md` for common investigation scenarios with step-by-step instructions.

---

## Blame Deep Dive

Basic `git blame` shows the last commit to touch each line, but that's often a formatting change or bulk rename. Use flags to look deeper:

```bash
# Ignore whitespace changes
git blame -w path/to/file.py

# Detect lines moved within the file
git blame -M path/to/file.py

# Detect lines moved or copied from other files
git blame -C path/to/file.py

# Stack all three for maximum accuracy
git blame -w -M -C path/to/file.py

# Blame at a specific commit (go back before a known refactoring)
git blame abc1234^ -- path/to/file.py
```

### .git-blame-ignore-revs

Large formatting commits (running `black`, `prettier`, or `gofmt`) pollute blame output. Create a file listing commits to skip:

```bash
# Create .git-blame-ignore-revs at repo root
echo "# Black formatting pass" >> .git-blame-ignore-revs
echo "abc1234abc1234abc1234abc1234abc1234abc1234" >> .git-blame-ignore-revs

# Configure git to use it
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

Commit `.git-blame-ignore-revs` to the repo so the whole team benefits. GitHub and GitLab both respect this file in their web UI.

---

## Reflog Recovery

The reflog records every change to `HEAD` and branch tips, even those not reachable from any branch. It's your safety net for recovering from mistakes.

```bash
# Show recent HEAD movements
git reflog

# Show reflog for a specific branch
git reflog show feature-branch

# Typical output:
# abc1234 HEAD@{0}: reset: moving to HEAD~3
# def5678 HEAD@{1}: commit: add user validation
# 789abcd HEAD@{2}: commit: fix login bug

# Recover a commit after accidental reset
git reflog                          # find the commit hash
git branch recovery-branch abc1234  # create a branch pointing to it

# Recover after accidental branch delete
git reflog | grep "feature-branch"  # find the last commit
git branch feature-branch abc1234   # recreate the branch
```

**Reflog lifetime:** By default, unreachable reflog entries expire after 30 days, reachable ones after 90 days. For critical recovery, act within this window. Running `git gc` prunes expired entries.

**What reflog can recover:**
- Commits after `git reset --hard`
- Deleted branches
- Amended commits (the pre-amend version)
- Rebased commits (the pre-rebase versions)
- Stash drops (via `git fsck --unreachable` if reflog also expired)

**What reflog cannot recover:**
- Uncommitted changes (never tracked by git)
- Changes after `git checkout -- file` (working tree overwrite)

---

## Ambiguity Policy

These defaults apply when the user does not specify a preference. State the assumption when making a choice:

- **Search scope:** Default to the current branch. Add `--all` only when the user says "in any branch" or "across all branches".
- **Blame flags:** Default to `git blame -w -M -C` to skip whitespace and detect moves/copies. Drop flags only if the user wants raw blame.
- **Log format:** Default to `--oneline` for browsing, `-p` (patch) when the user needs to see the actual changes.
- **Bisect automation:** Default to manual bisect unless the user provides a test command or the project has a clear test suite.
- **Recovery strategy:** After finding a lost commit via reflog, default to creating a new branch rather than force-resetting an existing branch.
- **File scope:** When investigating a specific function, use `-L` (line range) or `-S` (function name) rather than blaming the entire file.

---

## Reference Files

| File | Contents |
|------|----------|
| `references/advanced-commands.md` | Full command reference for git log, blame, bisect, reflog, show, and diff with all flags and options |
| `references/investigation-playbooks.md` | Step-by-step playbooks for common investigation scenarios: finding when a bug was introduced, tracing deleted code, recovering lost work, identifying hot spots |
