---
description: Review an existing pull request without merging — post findings as PR comment
argument-hint: [PR number, URL, or omit for current branch]
disable-model-invocation: true
allowed-tools: Bash(gh:*), Bash(git:*), Read, Grep, Glob, AskUserQuestion
---

# /pr:review - Review Existing PR

Review an existing pull request and post findings as a PR comment. NEVER approve or merge.

## Input

`$ARGUMENTS` - PR number (e.g., `42`), URL (e.g., `https://github.com/owner/repo/pull/42`), or empty to auto-detect from current branch.

## Process

### Phase 1: Identify Target PR

**With argument:**
```bash
gh pr view $1 --json number,title,body,baseRefName,headRefName,additions,deletions,commits,files
```

**Without argument (auto-detect):**
```bash
gh pr view --json number,title,body,baseRefName,headRefName,additions,deletions,commits,files
```

**If both fail:** Use AskUserQuestion to prompt for PR number.

Capture PR number for subsequent operations.

Fetch the full diff:
```bash
gh pr diff $PR
```

### Phase 2: Gather Additional Context

- Read changed files in full (not just diff) for deeper understanding of surrounding code
- Discover project rules:
  ```bash
  ls -la CLAUDE.md .claude/CLAUDE.md CLAUDE.local.md 2>/dev/null
  ls -la .claude/rules/*.md 2>/dev/null
  ```
- Check if PR body references a ticket (parse for `#N`, `Closes #N`, `Refs #N`, `Fixes #N`)
- If ticket found, fetch it for requirements verification:
  ```bash
  gh issue view $TICKET --json number,title,body
  ```

### Phase 3: Aggressive Analysis

This review is DEEPER than a commit review — it is the final gate before merge.

#### Attack Surface Analysis

| Check | Look For |
|-------|----------|
| New Endpoints | Every new route/handler exposed |
| New Inputs | Every new user input vector |
| Permission Changes | Any auth/authz modifications |
| Data Flow | How data moves through new code |
| External Integrations | New API calls, webhooks, services |

#### Threat Modeling (per feature)

For each significant feature in the PR:
- What could an attacker exploit?
- What data could be exfiltrated?
- What operations could be abused?
- What rate limiting is needed?
- What audit logging is needed?

#### Dependency Security

```bash
# Check for new dependencies (adapt patterns to project)
gh pr diff $PR | grep -E '^\+.*"(dependencies|devDependencies)"' -A 50
gh pr diff $PR | grep -E '^\+' | grep -E 'requirements.*\.txt|package.*\.json|Cargo\.toml|go\.mod|Gemfile'
```

| Check | Look For |
|-------|----------|
| New Dependencies | List all new packages + versions |
| Known CVEs | Check against vulnerability databases |
| Supply Chain | Typosquatting, maintainer reputation |
| License Compliance | License compatibility issues |

#### Project Rules Adherence

Check compliance with project-specific rules (deeper than commit review):

1. **Discover rules**:
   - Read `CLAUDE.md` or `.claude/CLAUDE.md` if present
   - Read all files in `.claude/rules/*.md`
   - Check `CLAUDE.local.md` for user-specific rules

2. **Full diff review for compliance**:
   - Check EVERY change against stated rules
   - Note architectural patterns that should be followed
   - Flag ALL deviations from documented conventions

| Rule Source | Compliance | Notes |
|-------------|------------|-------|
| CLAUDE.md | OK / VIOLATION | [specifics] |
| rules/[name].md | OK / VIOLATION | [specifics] |

#### Architecture Deep Dive

| Check | Look For |
|-------|----------|
| Pattern Compliance | Full diff against established patterns |
| Coupling Analysis | New dependencies between modules |
| Scalability | O(n) analysis, potential bottlenecks |
| Error Propagation | How errors flow through new code |
| Recovery Strategies | Graceful degradation, retry logic |
| State Management | Race conditions, consistency issues |

#### Code Quality Review

| Check | Look For |
|-------|----------|
| Complexity | Nesting depth > 3, high cyclomatic complexity |
| Duplication | Copy-paste code, extractable shared logic |
| Naming | Unclear names, inconsistent conventions |
| Error Handling | Missing boundaries, generic catches, no recovery |
| SOLID Violations | God classes, tight coupling, leaky abstractions |
| Dead Code | Unreachable code, unused imports/variables |

#### Test Analysis

Evaluate against testing standards:

| Check | Assess |
|-------|--------|
| Behavior Coverage | Are key behaviors tested? (not line count) |
| Test Quality | Do tests verify outcomes, not implementation? |
| Brittleness | Any tests that will break on refactor? |
| Over-testing | Trivial code with unnecessary tests? |
| Under-testing | Critical paths without tests? |
| Manual Test Plan | What cannot be automated |

**AI testing pitfalls to flag**:
- Tests for trivial getters/setters
- Excessive edge cases (>5 per function)
- Tests asserting on implementation details
- Over-mocked tests that verify nothing

#### Breaking Changes

| Check | Look For |
|-------|----------|
| API Contracts | Changed request/response schemas |
| Database Schema | Migration requirements |
| Configuration | New env vars, changed defaults |
| Dependencies | Version bumps affecting consumers |

#### Requirements Verification (if ticket found)

Cross-reference each requirement from the linked ticket:

| Requirement | Status | Evidence |
|-------------|--------|----------|
| [REQ text] | SATISFIED / PARTIAL / NOT MET | [file:line or explanation] |

All acceptance criteria must be verified.

### Phase 4: Present Findings

Organize by severity:

```markdown
## PR Review Findings

### Critical (Must Fix Before Merge)
- [Finding]: [file:line] - [Impact]

### High (Should Fix Before Merge)
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

### Requirements Status (if ticket linked)
| Requirement | Status | Evidence |
|-------------|--------|----------|
| ... | ... | ... |

### Threat Model Summary
| Feature | Primary Risks | Mitigations Present |
|---------|---------------|---------------------|
| ... | ... | ... |
```

If no findings in a severity level, omit that section.

### Phase 5: User Decisions

Use AskUserQuestion:

```
For each finding, select handling:
- NOTE: Include in PR review comment
- ISSUE: Create separate GitHub issue
- IGNORE: Don't include in review
```

### Phase 6: Create Issues (if selected)

Group by category, include:
- PR number
- Branch name
- Link to original ticket (if found)

```bash
gh issue create --title "[Category] findings from PR #[PR]" --body "$(cat <<'EOF'
## [Category] Findings from PR #[PR]

**PR**: #[PR_NUMBER]
**Branch**: [branch]
[**Related Ticket**: #[TICKET] — only if ticket found]

### Findings

- [ ] [Finding 1] - `file:line`
- [ ] [Finding 2] - `file:line`

### Context

[Brief context about the PR's purpose]
EOF
)"
```

### Phase 7: Post Review Comment (NEVER APPROVE)

```bash
gh pr review $PR --comment --body "$(cat <<'EOF'
## Automated Review

**Status**: Requires human approval

### Summary

[Overall assessment - 2-3 sentences]

### Critical Issues (Must Address)
- [Issue with file:line]

### Required Changes
- [Specific change needed]

### Suggestions
- [Nice-to-have improvements]

### Project Rules Compliance
- [Summary of rules adherence]

### Security Considerations
- [Key security points for human reviewer]

### Test Coverage
- [Coverage assessment]
- [Manual test recommendations if applicable]

### Requirements Status (if ticket linked)
| Requirement | Status |
|-------------|--------|
| ... | ... |

### Related Issues Created
- #[N]: [Description]

---
*Automated review by Claude. Human approval required before merge.*
EOF
)"
```

### Phase 8: Report

Output summary:

```markdown
## Review Summary

- **PR**: #[N] — [title]
- **Findings**: [Critical: N, High: N, Medium: N, Low: N, Info: N]
- **Review**: Posted as comment
- **Issues Created**: #[N]: [category] — or "None"
- **Ticket**: #[TICKET] requirements verified — or "No linked ticket"
```

## Rules

- **NEVER approve or merge** — post review as comment only
- **Deeper than commit review** — this is the final gate before merge
- **Active threat modeling** required for each significant feature
- **All findings** categorized by severity with `file:line` references
- **User decides** what goes in the review comment
- **Check project rules** (CLAUDE.md, .claude/rules/*.md) thoroughly
- **Auto-detect ticket** from PR body if possible — never prompt for one
- **Read full files** for changed code, not just the diff
- Batch all GitHub operations

## Severity Guide

**Critical**: Active vulnerability, data exposure, auth bypass, breaking production
**High**: Security weakness, significant bug, major pattern violation
**Medium**: Code smell, minor vulnerability, missing validation
**Low**: Style, optimization, minor improvements
**Info**: Observations, questions, future considerations
