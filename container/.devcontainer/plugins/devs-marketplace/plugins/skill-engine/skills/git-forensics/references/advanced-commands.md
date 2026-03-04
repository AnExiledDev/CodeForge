# Git Forensics: Advanced Command Reference

Full command reference for git history investigation tools with all commonly used flags.

## Contents

- [git log](#git-log)
- [git blame](#git-blame)
- [git bisect](#git-bisect)
- [git reflog](#git-reflog)
- [git show](#git-show)
- [git diff](#git-diff)
- [git shortlog](#git-shortlog)
- [Hot Spot Analysis](#hot-spot-analysis)

---

## git log

The primary tool for browsing commit history.

### Output Formatting

```bash
# One line per commit
git log --oneline

# Graph with branch topology
git log --oneline --graph --all

# Custom format
git log --pretty=format:"%h %an %ar %s"
# %h = short hash, %an = author name, %ar = relative date, %s = subject

# Full patch (diff) for each commit
git log -p

# Stats (files changed, insertions, deletions)
git log --stat

# Name only (just file paths)
git log --name-only

# Name + status (added/modified/deleted)
git log --name-status
```

### Filtering

```bash
# By author
git log --author="Alice"
git log --author="alice@example.com"

# By date range
git log --after="2024-01-01" --before="2024-06-30"
git log --since="3 months ago"

# By commit message
git log --grep="fix.*login" --regexp-ignore-case

# By file path
git log -- path/to/file.py
git log -- "*.py"                  # all Python files

# By number of commits
git log -10                        # last 10 commits

# Exclude merges
git log --no-merges

# Only merges
git log --merges

# Commits on branch but not on main
git log main..feature-branch

# Commits on either branch but not both
git log main...feature-branch
```

### Content Search

```bash
# Pickaxe: commits that changed the count of a string
git log -S "function_name"
git log -S "function_name" -p      # with patch
git log -S "function_name" -- "*.py"  # restricted to Python files

# Regex search: commits where changed lines match a pattern
git log -G "def\s+calculate_\w+"
git log -G "TODO|FIXME" --oneline

# Difference between -S and -G:
# -S "foo" → finds commits where the NUMBER of "foo" occurrences changed
# -G "foo" → finds commits where any CHANGED LINE matches "foo"
# -S is faster; -G is more flexible
```

---

## git blame

Shows the last commit to modify each line of a file.

```bash
# Basic blame
git blame path/to/file.py

# Blame a specific line range
git blame -L 42,60 path/to/file.py

# Blame a function (by name, if the language is supported)
git blame -L :function_name path/to/file.py

# Ignore whitespace changes
git blame -w path/to/file.py

# Detect lines moved within the same file
git blame -M path/to/file.py

# Detect lines moved or copied from other files in the same commit
git blame -C path/to/file.py

# Detect lines copied from any file in any commit (most thorough)
git blame -C -C -C path/to/file.py

# Combine all filters for best results
git blame -w -M -C path/to/file.py

# Blame at a specific revision (e.g., before a known refactoring)
git blame abc1234^ -- path/to/file.py

# Show email instead of name
git blame -e path/to/file.py

# Show original filename (for renamed files)
git blame -f path/to/file.py

# Ignore specific revisions (bulk formatting commits)
git blame --ignore-rev abc1234 path/to/file.py
git blame --ignore-revs-file .git-blame-ignore-revs path/to/file.py
```

---

## git bisect

Binary search through commit history to find a regression.

```bash
# Start a bisect session
git bisect start

# Mark the current commit as bad
git bisect bad

# Mark a known-good commit
git bisect good v2.0.0
git bisect good abc1234

# After testing each checkout:
git bisect good           # this commit is OK
git bisect bad            # this commit has the bug

# Skip a commit that can't be tested (e.g., won't compile)
git bisect skip

# Automated bisect with a test script
git bisect start HEAD v2.0.0
git bisect run pytest tests/test_specific.py -x

# Automated with a custom test
git bisect run bash -c 'python -c "from myapp import func; assert func(1) == 2"'

# Exit codes for bisect run:
# 0     = good (no bug)
# 1-124 = bad (has bug)
# 125   = skip (can't test this commit)
# 126+  = abort bisect

# Show the bisect log (useful for sharing investigations)
git bisect log

# Replay a bisect session from a log
git bisect replay bisect.log

# End the bisect session and return to original branch
git bisect reset

# Reset to a specific branch instead
git bisect reset feature-branch
```

---

## git reflog

Records every change to HEAD and branch refs, including operations that don't create commits.

```bash
# Show HEAD reflog (default)
git reflog
git reflog show HEAD

# Show reflog for a specific branch
git reflog show main
git reflog show feature-branch

# Show with dates
git reflog --date=iso
git reflog --date=relative

# Show with full commit messages
git reflog --format="%h %gd %gs %s"

# Filter reflog entries
git reflog | grep "commit:"       # only commits
git reflog | grep "reset:"        # only resets
git reflog | grep "rebase:"       # only rebases

# Recover a lost commit
git reflog                        # find the hash
git cherry-pick abc1234           # apply it to current branch
# OR
git branch recovery abc1234       # create a branch at that commit

# Recover a deleted branch
git reflog | grep "feature-name"  # find the last commit
git branch feature-name abc1234   # recreate the branch
```

---

## git show

Display the contents of a commit, tag, or tree object.

```bash
# Show a commit (message + diff)
git show abc1234

# Show just the commit message
git show abc1234 --quiet

# Show a file at a specific commit
git show abc1234:path/to/file.py

# Show stats only
git show abc1234 --stat

# Show a specific file's changes in a commit
git show abc1234 -- path/to/file.py
```

---

## git diff

Compare commits, branches, or the working tree.

```bash
# Unstaged changes
git diff

# Staged changes
git diff --staged

# Between two commits
git diff abc1234 def5678

# Between two branches
git diff main..feature-branch

# Only show file names
git diff --name-only main..feature-branch

# Show stats
git diff --stat main..feature-branch

# Ignore whitespace
git diff -w

# Word-level diff (instead of line-level)
git diff --word-diff

# Show only changes in specific files
git diff main..feature-branch -- "*.py"
```

---

## git shortlog

Summarize commit history by author.

```bash
# Commit count per author (sorted descending)
git shortlog -sn

# Exclude merges
git shortlog -sn --no-merges

# Within a date range
git shortlog -sn --after="2024-01-01"

# For a specific path
git shortlog -sn -- src/

# Group by committer (not author)
git shortlog -snc
```

---

## Hot Spot Analysis

Find files that change most frequently (potential maintenance burdens):

```bash
# Most frequently changed files
git log --pretty=format: --name-only | sort | uniq -c | sort -rn | head -20

# Most frequently changed files by a specific author
git log --author="Alice" --pretty=format: --name-only | sort | uniq -c | sort -rn | head -20

# Files with the most distinct authors (shared ownership)
git log --pretty=format:"%an" --name-only | paste - - | sort -u | cut -f2 | sort | uniq -c | sort -rn | head -20

# Churn: lines added + removed per file
git log --numstat --pretty=format: | awk '{added+=$1; removed+=$2; file=$3} END {print added+removed, file}' | sort -rn | head -20
```
