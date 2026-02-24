---
description: Create pull request with aggressive security and architecture review
disable-model-invocation: true
allowed-tools: Bash(gh:*), Bash(git:*), Read, Grep, Glob, AskUserQuestion
---

# /ticket:create-pr - Create PR with Aggressive Review

Create pull request, conduct deep security and architecture review, post findings. NEVER auto-approve.

## Prerequisites

Must have active ticket context. If not set, prompt for ticket number.

## Process

### Phase 1: Gather Context

```bash
# Branch info
git branch --show-current
git log main..HEAD --oneline
git diff main...HEAD --stat

# Full diff
git diff main...HEAD

# Ticket
gh issue view $TICKET --json number,title,body

# Discover project rules
ls -la CLAUDE.md .claude/CLAUDE.md CLAUDE.local.md 2>/dev/null
ls -la .claude/rules/*.md 2>/dev/null
```

### Phase 2: Create PR

```bash
gh pr create --title "<type>(<scope>): <summary>" --body "$(cat <<'EOF'
## Summary

[1-3 bullet points of what this PR accomplishes]

## Related Issue

Closes #[TICKET] (or Refs #[TICKET] if partial)

## Changes

- [Component]: [What changed]

## Testing

- [ ] [How to test each change]

---
*PR created by Claude. Awaiting human review.*
EOF
)"
```

Capture PR number for subsequent operations.

### Phase 3: Aggressive Analysis

This review is DEEPER than commit review - final gate before merge.

#### Attack Surface Analysis

| Check | Look For |
|-------|----------|
| New Endpoints | Every new route/handler exposed |
| New Inputs | Every new user input vector |
| Permission Changes | Any auth/authz modifications |
| Data Flow | How data moves through new code |
| External Integrations | New API calls, webhooks, services |

#### Threat Modeling (per feature)

For each significant feature:
- What could an attacker exploit?
- What data could be exfiltrated?
- What operations could be abused?
- What rate limiting is needed?
- What audit logging is needed?

#### Dependency Security

```bash
# Check for new dependencies (adapt patterns to project)
git diff main...HEAD -- "**/requirements*.txt" "**/package*.json" "**/Cargo.toml" "**/go.mod" "**/Gemfile"
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

**Common checks**:
- Code organization matches documented patterns
- Naming conventions followed throughout
- Required abstractions used consistently
- Forbidden patterns avoided everywhere

#### Architecture Deep Dive

| Check | Look For |
|-------|----------|
| Pattern Compliance | Full diff against established patterns |
| Coupling Analysis | New dependencies between modules |
| Scalability | O(n) analysis, potential bottlenecks |
| Error Propagation | How errors flow through new code |
| Recovery Strategies | Graceful degradation, retry logic |
| State Management | Race conditions, consistency issues |

#### Test Analysis

**Note**: If user opted out of tests during `/ticket:work`, note "Tests: Skipped per user preference" and skip detailed analysis.

Otherwise, evaluate against testing standards:

| Check | Assess |
|-------|--------|
| Behavior Coverage | Are key behaviors tested? (not line count) |
| Test Quality | Do tests verify outcomes, not implementation? |
| Brittleness | Any tests that will break on refactor? |
| Over-testing | Trivial code with unnecessary tests? |
| Under-testing | Critical paths without tests? |
| Manual Test Plan | What can't be automated |

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

#### Requirements Final Check

| Requirement | Status | Evidence |
|-------------|--------|----------|
| [Each EARS requirement] | SATISFIED / PARTIAL / NOT MET | [Location] |

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

### Requirements Status
| Requirement | Status | Evidence |
|-------------|--------|----------|
| ... | ... | ... |

### Threat Model Summary
| Feature | Primary Risks | Mitigations Present |
|---------|---------------|---------------------|
| ... | ... | ... |
```

### Phase 5: User Decisions

Use AskUserQuestion:

```
For each severity level:
- FIX: Address before posting review
- ISSUE: Create GitHub issue
- IGNORE: Acknowledge
- NOTE: Include in PR review but don't block
```

### Phase 6: Create Issues (if selected)

Group by category, include:
- PR number
- Branch name
- Commit range
- Link to original ticket

```bash
gh issue create --title "[Category] findings from PR #[PR]" --body "..."
```

### Phase 7: Fix Selected Items

Address items marked FIX. Commit and push.

### Phase 8: Post Review (NEVER APPROVE)

```bash
gh pr review [PR] --comment --body "$(cat <<'EOF'
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
- [Coverage assessment or "Skipped per user preference"]
- [Manual test recommendations if applicable]

### Related Issues Created
- #[N]: [Description]

---
*Automated review by Claude. Human approval required before merge.*
EOF
)"
```

### Phase 9: Post to Original Ticket

```bash
gh issue comment $TICKET --body "$(cat <<'EOF'
## Pull Request Created

**PR**: #[PR_NUMBER]
**Branch**: [branch]

### Status
- [x] PR created
- [x] Automated review posted
- [ ] Human review pending
- [ ] Approved and merged

### Review Summary
- Critical: [count]
- High: [count]
- Medium: [count]
- Low: [count]

### Project Rules
- [Compliance summary]

### Issues Created
- #[N]: [Category]

### Next Steps
1. Address critical/high findings if any
2. Request human review
3. Merge after approval

---
*PR created by Claude.*
EOF
)"
```

## Rules

- **NEVER auto-approve** - always require human
- **Deeper than commit review** - this is final gate
- **Active threat modeling** required for each feature
- **All findings** categorized by severity
- **User decides** what to fix/issue/ignore
- **Dual posting**: PR comment + source ticket comment
- **Batch** all GitHub operations
- **Check project rules** (CLAUDE.md, .claude/rules/*.md) thoroughly
- **Respect test preferences** from planning phase

## Severity Guide

**Critical**: Active vulnerability, data exposure, auth bypass, breaking production
**High**: Security weakness, significant bug, major pattern violation
**Medium**: Code smell, minor vulnerability, missing validation
**Low**: Style, optimization, minor improvements
**Info**: Observations, questions, future considerations
