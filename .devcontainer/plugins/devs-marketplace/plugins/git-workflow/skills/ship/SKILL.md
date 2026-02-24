---
description: Review changes, commit with detailed message, push, and optionally create pull request
argument-hint: [commit message hint]
disable-model-invocation: true
allowed-tools: Bash(gh:*), Bash(git:*), Read, Grep, Glob, AskUserQuestion
---

# /ship - Review, Commit, Push & Optional PR

Review all changes, commit with a detailed message, push, and optionally create a pull request. Optionally links to tickets if context exists from `/ticket:work`.

## Input

`$ARGUMENTS` - Optional commit message hint or summary of changes. May be empty.

## Process

### Phase 1: Gather Context

```bash
# Working tree state
git status
git diff HEAD
git diff --staged

# Branch info
git branch --show-current
git log main..HEAD --oneline
git diff main...HEAD --stat

# Discover project rules
ls -la CLAUDE.md .claude/CLAUDE.md CLAUDE.local.md 2>/dev/null
ls -la .claude/rules/*.md 2>/dev/null
```

Check for ticket context in the current session. If a ticket number is available from a prior `/ticket:work` call, note it for linking in later phases. Do NOT prompt for a ticket — this command works standalone.

### Phase 2: Full Review

Review ALL changes (staged + unstaged) with `file:line` references.

#### Security Review

| Check | Look For |
|-------|----------|
| Secrets | API keys, passwords, tokens, connection strings in code |
| Injection | SQL injection, command injection, XSS, CSRF |
| Auth/Authz | Missing auth checks, privilege escalation paths |
| Data Exposure | PII in logs, sensitive data in error messages |
| Dependencies | New dependencies with known vulnerabilities |
| Input Validation | Unvalidated user input, missing sanitization |

#### Project Rules Adherence

Check compliance with project-specific rules:

1. **Discover rules**:
   - Read `CLAUDE.md` or `.claude/CLAUDE.md` if present
   - Read all files in `.claude/rules/*.md`
   - Check `CLAUDE.local.md` for user-specific rules

2. **Review for compliance**:
   - Check if changes violate any stated rules
   - Note architectural patterns that should be followed
   - Flag deviations from documented conventions

| Rule Source | Compliance | Notes |
|-------------|------------|-------|
| CLAUDE.md | OK / VIOLATION | [specifics] |
| rules/[name].md | OK / VIOLATION | [specifics] |

#### Code Quality Review

| Check | Look For |
|-------|----------|
| Complexity | Nesting depth > 3, high cyclomatic complexity |
| Duplication | Copy-paste code, extractable shared logic |
| Naming | Unclear names, inconsistent conventions |
| Error Handling | Missing boundaries, generic catches, no recovery |
| SOLID Violations | God classes, tight coupling, leaky abstractions |
| Dead Code | Unreachable code, unused imports/variables |

#### Architecture Review

| Check | Look For |
|-------|----------|
| Pattern Compliance | Deviations from established patterns |
| Coupling | Inappropriate dependencies, circular imports |
| API Contracts | Breaking changes, missing versioning |
| Cohesion | Mixed responsibilities, scattered logic |

#### Test Review

**Note**: If user indicates tests are not applicable or opts out, skip this section entirely and note "Tests: Skipped per user preference."

| Check | Assess |
|-------|--------|
| Behavior Coverage | Are key behaviors tested? (not line count) |
| Test Quality | Do tests verify outcomes, not implementation? |
| Brittleness | Any tests that will break on refactor? |
| Over-testing | Trivial code with unnecessary tests? |
| Under-testing | Critical paths without tests? |

### Phase 3: Present Findings

Organize ALL findings by severity:

```markdown
## Review Findings

### Critical (Must Fix Before Commit)
- [Finding]: [file:line] - [Impact]

### High (Should Fix Before Commit)
- [Finding]: [file:line] - [Impact]

### Medium (Fix Soon)
- [Finding]: [file:line] - [Impact]

### Low (Nice to Have)
- [Finding]: [file:line] - [Impact]

### Info (Observations)
- [Observation]

### Project Rules Compliance
| Rule Source | Status | Details |
|-------------|--------|---------|
| ... | ... | ... |
```

If no findings in a severity level, omit that section.

### Phase 4: User Decisions on Findings

Use AskUserQuestion to batch decisions:

```
For each category of findings, select handling:
- FIX: Address before commit
- ISSUE: Create GitHub issue for later
- IGNORE: Acknowledge and proceed
```

Allow multi-select within categories.

### Phase 5: Fix Selected Items

Address all items marked FIX. Re-run relevant checks after fixes.

### Phase 6: Create Issues (if selected)

For findings marked ISSUE, group by category:

```bash
gh issue create --title "[Category] findings from [branch]" --body "$(cat <<'EOF'
## [Category] Findings

**Source**: Branch `[branch]`, commit `[hash]`
[**Related Ticket**: #[TICKET] — only if ticket context exists]

### Findings

- [ ] [Finding 1] - `file:line`
- [ ] [Finding 2] - `file:line`

### Context

[Brief context about what was being implemented]
EOF
)"
```

Link to ticket if context exists.

### Phase 7: Draft Commit Message

```markdown
<type>(<scope>): <summary>

<Business context>
- [Change description]
- [User-facing impact]

<Technical changes>
- [File/component changed]
- [Pattern used]

<Review findings>
- Addressed: [list]
- Deferred to #[issue]: [list]
- Acknowledged: [list]

Closes #[TICKET] (if completing all requirements — only if ticket context)
Refs #[TICKET] (if partial — only if ticket context)
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

If `$ARGUMENTS` provided a commit message hint, use it to inform the summary line.

### Phase 8: User Sign-Off on Commit Message

Present commit message for approval via AskUserQuestion. Allow edits. Do not proceed without explicit approval.

### Phase 9: Commit & Push

```bash
git add [specific files — never git add -A]
git commit -m "$(cat <<'EOF'
[approved message]
EOF
)"
git push -u origin $(git branch --show-current)
```

Stage specific files by name. Never use `git add .` or `git add -A`.

### Phase 10: Ask About PR

Use AskUserQuestion:

```
Changes committed and pushed to [branch].

Would you like to create a pull request?
- Yes: Create PR targeting main
- No: Done — just commit and push
```

If **No** → skip to Phase 12.

### Phase 11: Create PR (conditional)

```bash
gh pr create --title "<type>(<scope>): <summary>" --body "$(cat <<'EOF'
## Summary

- [1-3 bullet points of what this PR accomplishes]

## Related Issue

[Closes #TICKET / Refs #TICKET — only if ticket context exists]

## Changes

- [Component]: [What changed]

## Testing

- [ ] [How to test each change]

---
*PR created by Claude. Awaiting human review.*
EOF
)"
```

Capture PR number.

If ticket context exists, post comment to the original issue:

```bash
gh issue comment $TICKET --body "$(cat <<'EOF'
## Pull Request Created

**PR**: #[PR_NUMBER]
**Branch**: [branch]

### Status
- [x] PR created
- [ ] Human review pending
- [ ] Approved and merged

---
*PR created by Claude.*
EOF
)"
```

### Phase 12: Report

Output summary:

```markdown
## Ship Summary

- **Commit**: [hash] on `[branch]`
- **Push**: [branch] → origin/[branch]
- **PR**: #[N] ([URL]) — or "Not created"
- **Issues Created**: #[N]: [category] — or "None"
- **Ticket**: #[TICKET] linked — or "Standalone (no ticket context)"
```

## Rules

- **Full review is mandatory** — no skipping phases 2-3
- **User MUST approve** commit message before committing
- **AskUserQuestion MUST confirm** before PR creation — never auto-create
- **NEVER auto-approve** PRs
- **Stage specific files** — never `git add .` or `git add -A`
- **Optionally ticket-aware** — link to ticket if context exists, never prompt for one
- **Batch** all GitHub operations
- **Check project rules** (CLAUDE.md, .claude/rules/*.md) thoroughly
- Present findings FIRST, then get decisions
- Fix selected items BEFORE drafting commit

## Finding Severity Guide

**Critical**: Security vulnerability, data loss risk, breaking production
**High**: Significant bug, major pattern violation, auth issue
**Medium**: Code smell, minor bug, missing validation
**Low**: Style issue, minor optimization, documentation gap
**Info**: Observations, questions, future considerations
