# Git Investigation Playbooks

Step-by-step playbooks for common git forensic investigations.

## Contents

- [Playbook 1: Finding When a Bug Was Introduced](#playbook-1-finding-when-a-bug-was-introduced)
- [Playbook 2: Finding Deleted Code](#playbook-2-finding-deleted-code)
- [Playbook 3: Tracing a Line's History](#playbook-3-tracing-a-lines-history)
- [Playbook 4: Recovering Lost Work](#playbook-4-recovering-lost-work)
- [Playbook 5: Identifying Hot Spots and Code Ownership](#playbook-5-identifying-hot-spots-and-code-ownership)
- [Playbook 6: Understanding a Complex Merge Conflict](#playbook-6-understanding-a-complex-merge-conflict)

---

## Playbook 1: Finding When a Bug Was Introduced

**Scenario:** A feature that used to work is now broken. You need to find the exact commit that introduced the regression.

### Step 1: Establish the boundary

```bash
# Find a known-good commit (e.g., last release tag)
git tag --list "v*" --sort=-version:refname | head -5

# Verify the good commit is actually good
git stash  # save current work
git checkout v2.1.0
# run the failing test or reproduce the bug manually
# if it passes, this is your good commit
```

### Step 2: Start bisect

```bash
git bisect start
git bisect bad HEAD           # current commit is bad
git bisect good v2.1.0        # last known good commit
```

### Step 3: Test each checkout

Git will check out a commit roughly in the middle. Test it:

```bash
# Option A: Manual testing
pytest tests/test_feature.py -x
# If it passes: git bisect good
# If it fails: git bisect bad

# Option B: Automated
git bisect run pytest tests/test_feature.py -x
```

### Step 4: Analyze the result

```bash
# Git outputs the first bad commit
# Example: abc1234 is the first bad commit

# Examine the commit
git show abc1234
git show abc1234 --stat

# Understand the context
git log --oneline abc1234~5..abc1234
```

### Step 5: Clean up

```bash
git bisect reset
git stash pop  # restore your work
```

---

## Playbook 2: Finding Deleted Code

**Scenario:** A function or class that used to exist has been deleted. You need to find when it was removed and why.

### Step 1: Search for when the code was last present

```bash
# Find commits that changed the count of the string
git log -S "def calculate_tax" --oneline

# Output shows commits where the function was added or removed
# The LAST commit in the list removed it; the FIRST added it
```

### Step 2: Examine the removal commit

```bash
# Show the commit that removed the function
git show abc1234

# See the full file at the commit BEFORE removal
git show abc1234^:path/to/file.py

# See the diff to understand what replaced it
git diff abc1234^..abc1234 -- path/to/file.py
```

### Step 3: Find the file if it was renamed or moved

```bash
# If the file itself was deleted, find when
git log --diff-filter=D --summary | grep "path/to/file.py"

# If the function moved to another file, search with -G
git log -G "def calculate_tax" --oneline --all
```

### Step 4: Recover the deleted code

```bash
# Get the file content from before the deletion
git show abc1234^:path/to/file.py > recovered_file.py

# Or cherry-pick just the function (manual extraction)
git show abc1234^:path/to/file.py | grep -A 50 "def calculate_tax"
```

---

## Playbook 3: Tracing a Line's History

**Scenario:** You need to understand why a specific line of code exists -- who wrote it, when, and in what context.

### Step 1: Initial blame

```bash
# Blame with whitespace and move detection
git blame -w -M -C path/to/file.py

# Focus on the specific line range
git blame -w -M -C -L 42,42 path/to/file.py
```

### Step 2: Go deeper if the blame shows a bulk change

If blame points to a formatting or refactoring commit:

```bash
# Blame at the commit BEFORE the bulk change
git blame -w -M -C abc1234^ -- path/to/file.py -L 42,42

# Or use .git-blame-ignore-revs to skip bulk commits automatically
git blame --ignore-revs-file .git-blame-ignore-revs path/to/file.py
```

### Step 3: Read the full commit context

```bash
# See the full commit that introduced the line
git show def5678

# See the PR/issue if the commit message references one
# e.g., "Fix #123" or "Closes #456"
git log --format="%H %s" | grep "#123"
```

### Step 4: See all changes to this line over time

```bash
# Log of all commits that touched this line range
git log -L 42,42:path/to/file.py

# This shows the line's evolution across commits, including the diff at each step
```

---

## Playbook 4: Recovering Lost Work

**Scenario:** You accidentally ran `git reset --hard`, deleted a branch, or lost commits.

### Step 1: Don't panic -- check the reflog

```bash
# See recent HEAD movements
git reflog

# Look for the commit you lost
# Example output:
# abc1234 HEAD@{0}: reset: moving to HEAD~3    ← the reset that lost your work
# def5678 HEAD@{1}: commit: add user validation ← your lost commit
# 789abcd HEAD@{2}: commit: fix login bug       ← another lost commit
```

### Step 2: Verify the lost commit

```bash
# Check the commit contents
git show def5678
git show def5678 --stat
```

### Step 3: Recover

```bash
# Option A: Create a branch at the lost commit (safest)
git branch recovery def5678

# Option B: Cherry-pick the commit onto your current branch
git cherry-pick def5678

# Option C: Reset to the lost commit (if you want to restore the full state)
git reset --hard def5678
```

### Step 4: If reflog doesn't help

```bash
# Find unreachable objects (last resort)
git fsck --unreachable --no-reflogs

# This lists dangling commits, blobs, and trees
# Look for "dangling commit" entries
# Examine them with git show
```

---

## Playbook 5: Identifying Hot Spots and Code Ownership

**Scenario:** You're new to a codebase and need to understand which files change most and who knows them best.

### Step 1: Find frequently changed files

```bash
# Most changed files in the last 6 months
git log --since="6 months ago" --pretty=format: --name-only | sort | uniq -c | sort -rn | head -20
```

### Step 2: Find who knows each area

```bash
# Top contributors overall
git shortlog -sn --no-merges --since="6 months ago"

# Top contributors for a specific directory
git shortlog -sn --no-merges -- src/auth/

# Who last touched each file in a directory
for f in src/auth/*.py; do
    echo "$f: $(git log -1 --format='%an (%ar)' -- "$f")"
done
```

### Step 3: Find coupling (files that change together)

```bash
# Files that frequently appear in the same commit
git log --pretty=format: --name-only | sort | uniq -c | sort -rn | head -30

# Look for pairs: if file A and file B always change together,
# they may have hidden coupling that should be made explicit
```

### Step 4: Identify aging code

```bash
# Files not modified in over a year
git log --diff-filter=M --since="1 year ago" --pretty=format: --name-only | sort -u > recent.txt
git ls-files | sort > all.txt
comm -23 all.txt recent.txt | head -30
rm recent.txt all.txt
```

---

## Playbook 6: Understanding a Complex Merge Conflict

**Scenario:** You have a merge conflict and need to understand the history of both sides before resolving.

### Step 1: See what both branches changed

```bash
# Changes on your branch since diverging from main
git log --oneline main..HEAD

# Changes on main since your branch diverged
git log --oneline HEAD..main

# The common ancestor
git merge-base HEAD main
```

### Step 2: Understand the conflicting file's history

```bash
# History on your branch
git log --oneline main..HEAD -- path/to/conflicted/file.py

# History on main
git log --oneline HEAD..main -- path/to/conflicted/file.py
```

### Step 3: See the three-way diff

```bash
# During a merge conflict, git stores three versions:
# :1: = common ancestor (base)
# :2: = your version (ours)
# :3: = their version (theirs)

git show :1:path/to/file.py > base.py
git show :2:path/to/file.py > ours.py
git show :3:path/to/file.py > theirs.py

# Compare
diff3 ours.py base.py theirs.py
```

### Step 4: Resolve with context

Understanding both sides' intent (from the commit messages in Step 1) helps you resolve the conflict correctly rather than just picking one side.
