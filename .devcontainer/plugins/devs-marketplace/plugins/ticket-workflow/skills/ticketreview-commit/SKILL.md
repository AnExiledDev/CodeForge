---
description: Thorough code review, verify requirements met, commit with detailed message
disable-model-invocation: true
allowed-tools: Bash(gh:*), Bash(git:*), Read, Grep, Glob, AskUserQuestion
---

# /ticket:review-commit - Review and Commit Changes

Thorough review, verify requirements, commit with detailed message.

## Prerequisites

Must have active ticket context from `/ticket:work`. If not set, prompt for ticket number.

## Process

### Phase 1: Gather Context

```bash
# Get changes
git status
git diff HEAD
git diff --staged

# Get ticket
gh issue view $TICKET --json number,title,body

# Discover project rules
ls -la CLAUDE.md .claude/CLAUDE.md CLAUDE.local.md 2>/dev/null
ls -la .claude/rules/*.md 2>/dev/null
```

### Phase 2: Conduct Full Review

Review ALL changes with file:line references.

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

**Common checks**:
- Code organization matches documented patterns
- Naming conventions followed
- Required abstractions used
- Forbidden patterns avoided

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

**Note**: If user opted out of tests during `/ticket:work`, skip this section entirely.

Evaluate against testing standards (not coverage metrics):

| Check | Assess |
|-------|--------|
| Behavior Coverage | Are key behaviors tested? (not line count) |
| Test Quality | Do tests verify outcomes, not implementation? |
| Brittleness | Any tests that will break on refactor? |
| Over-testing | Trivial code with unnecessary tests? |
| Under-testing | Critical paths without tests? |

**AI testing pitfalls to flag**:
- Tests for trivial getters/setters
- Excessive edge cases (>5 per function)
- Tests asserting on implementation details
- Over-mocked tests that verify nothing

#### Requirements Verification

Cross-reference each EARS requirement from ticket:

```markdown
| Requirement | Status | Evidence |
|-------------|--------|----------|
| [REQ text] | SATISFIED / PARTIAL / NOT ADDRESSED | [file:line or explanation] |
```

### Phase 3: Present Findings

Present ALL findings organized by category:

```markdown
## Review Findings

### Security
**Critical**
- [Finding with file:line]

**High**
- [Finding with file:line]

**Medium/Low**
- [Finding with file:line]

### Project Rules
- [Rule violation with file:line and rule reference]

### Code Quality
- [Finding with file:line]

### Architecture
- [Finding with file:line]

### Test Issues (if applicable)
- [Finding description]

### Requirements Status
| Requirement | Status | Evidence |
|-------------|--------|----------|
| ... | ... | ... |
```

### Phase 4: User Decisions

Use AskUserQuestion to batch decisions:

```
For each category of findings, select handling:
- FIX: Address before commit
- ISSUE: Create GitHub issue for later
- IGNORE: Acknowledge and proceed
```

Allow multi-select within categories.

### Phase 5: Create Issues (if selected)

For findings marked ISSUE:

1. Group by category
2. Create single issue per category:

```markdown
## [Category] Findings from #[TICKET]

**Source**: Branch `[branch]`, commit `[hash]`
**Related Ticket**: #[TICKET]

### Findings

- [ ] [Finding 1] - `file:line`
- [ ] [Finding 2] - `file:line`

### Context

[Brief context about what was being implemented]
```

```bash
gh issue create --title "[Category] findings from #[TICKET]" --body "..."
```

Link issues in response.

### Phase 6: Fix Selected Items

Address all items marked FIX.

### Phase 7: Draft Commit Message

```markdown
<type>(<scope>): <summary>

<Business context>
- [Requirement addressed]
- [User-facing change]

<Technical changes>
- [File/component changed]
- [Pattern used]

<Review findings>
- Addressed: [list]
- Deferred to #[issue]: [list]
- Acknowledged: [list]

Closes #[TICKET] (if completing all requirements)
Refs #[TICKET] (if partial)
```

Types: feat, fix, refactor, test, docs, chore

### Phase 8: User Sign-Off

Present commit message for approval. Allow edits.

### Phase 9: Execute

```bash
git add [files]
git commit -m "$(cat <<'EOF'
[approved message]
EOF
)"
git push
```

### Phase 10: Post to Issue

Single batched comment:

```markdown
## Commit Summary

**Commit**: [hash] on branch `[branch]`

### Requirements Status
| Requirement | Status |
|-------------|--------|
| ... | ... |

### Review Findings Addressed
- [Finding]: [Resolution]

### Project Rules Compliance
- [Rule source]: [Status]

### Issues Created
- #[N]: [Category] findings

### Deferred (User Approved)
- [Item]: Reason

---
*Reviewed and committed by Claude.*
```

## Rules

- **NEVER defer** without EXPRESS user approval
- **All findings** need file:line references
- **User MUST approve** commit message
- **Group issues** by category, link to original ticket
- **Batch** all GitHub operations
- Present findings FIRST, then get decisions
- Fix selected items BEFORE drafting commit
- **Check project rules** (CLAUDE.md, .claude/rules/*.md)
- **Respect test preferences** from planning phase

## Finding Severity Guide

**Critical**: Security vulnerability, data loss risk, breaking production
**High**: Significant bug, major pattern violation, auth issue
**Medium**: Code smell, minor bug, missing validation
**Low**: Style issue, minor optimization, documentation gap
