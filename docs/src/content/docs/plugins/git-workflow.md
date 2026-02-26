---
title: Git Workflow
description: Standalone git workflow commands for reviewing changes, committing, pushing, creating PRs, and reviewing PRs.
sidebar:
  order: 12
---

The git workflow plugin provides standalone git operations through two slash commands: `/ship` for the full review-commit-push-PR workflow, and `/pr:review` for reviewing existing pull requests. These commands work independently of the ticket workflow but optionally link to tickets when context exists.

## Commands

### `/ship` — Review, Commit, Push & Optional PR

Reviews all changes (staged and unstaged), commits with a detailed message, pushes to remote, and optionally creates a pull request.

**Usage:**
```
/ship [optional commit message hint]
```

**Process:**
1. Gathers git context (status, diff, branch info, project rules)
2. Conducts full review (security, rules adherence, code quality, architecture, tests)
3. Presents findings by severity — user decides what to fix, defer to issues, or ignore
4. Drafts commit message — user must approve before committing
5. Commits and pushes
6. Asks whether to create a PR — only creates if user confirms

**Review Categories:**
- Security (secrets, injection, auth/authz, data exposure, dependencies, input validation)
- Project Rules (CLAUDE.md, .claude/rules/*.md compliance)
- Code Quality (complexity, duplication, naming, error handling, SOLID violations, dead code)
- Architecture (pattern compliance, coupling, API contracts, cohesion)
- Tests (behavior coverage, test quality, brittleness, over/under-testing)

**Finding Severity:**
- **Critical** — Must fix before commit (security vulnerability, data loss risk, breaking production)
- **High** — Should fix before commit (significant bug, major pattern violation, auth issue)
- **Medium** — Fix soon (code smell, minor bug, missing validation)
- **Low** — Nice to have (style issue, minor optimization, documentation gap)
- **Info** — Observations, questions, future considerations

**Ticket Integration:**
If a ticket number is available from a prior `/ticket:work` call, `/ship` automatically links the commit and PR to that ticket. The command never prompts for a ticket — it works standalone.

:::tip[Full Review Always Runs]
The `/ship` command performs a comprehensive review before every commit. This is not optional — it ensures code quality and security are checked at the point of commit, not later in the PR review.
:::

### `/pr:review` — Review Existing PR

Reviews an existing pull request and posts findings as a PR comment. Never approves or merges.

**Usage:**
```
/pr:review [PR number, URL, or omit for current branch]
```

**Process:**
1. Identifies target PR (by number, URL, or auto-detects from current branch)
2. Fetches PR details, diff, and reads changed files in full
3. Conducts aggressive analysis (attack surface, threat modeling, dependencies, rules, architecture, quality, tests, breaking changes)
4. Presents findings by severity — user selects what to include in review, create as issues, or ignore
5. Posts review comment to PR (never approves or merges)

**Analysis Depth:**
PR review is deeper than commit review — it is the final gate before merge. Key differences:
- **Attack surface analysis** — maps every new endpoint, input vector, permission change, data flow, and external integration
- **Threat modeling** — for each significant feature: what could an attacker exploit? What data could be exfiltrated? What operations could be abused?
- **Dependency security** — lists all new dependencies with versions, checks for known CVEs, assesses supply chain risks, verifies license compatibility
- **Requirements verification** — if PR references a ticket, cross-references each requirement and acceptance criterion

**Auto-Detection:**
The command tries three approaches to find the PR:
1. If you provide a PR number (e.g., `/pr:review 42`), it fetches that PR
2. If you provide a URL, it parses the number and fetches it
3. If you omit the argument, it auto-detects the PR for your current branch

If all three fail, it prompts for the PR number.

:::caution[Review Only, Never Merge]
The `/pr:review` command posts a review comment to the PR but never approves or merges. Human approval is always required before merge. The review is marked as "Requires human approval" and includes a footer noting it is automated.
:::

## Hook Scripts

The git-workflow plugin provides no hooks — all functionality is delivered through the two slash commands.

## Integration with Ticket Workflow

The git-workflow plugin optionally integrates with the [Ticket Workflow](./ticket-workflow/) plugin:
- If you used `/ticket:work` to start working on a ticket, `/ship` automatically detects the ticket context and links the commit and PR
- If you used `/ticket:create-pr`, you get ticket-aware PR creation through that workflow
- If you're working without a ticket, `/ship` and `/pr:review` work standalone — no prompts, no ticket required

The git-workflow commands are designed to work whether you're following the ticket workflow or just doing ad-hoc work.

## Related

- [Ticket Workflow](./ticket-workflow/) — EARS-formatted ticket workflow that integrates with `/ship`
- [Session Context](./session-context/) — provides the git state that both commands rely on
- [Skills Reference](../features/skills/) — the `/ship` and `/pr:review` skills are also documented in the skills catalog
