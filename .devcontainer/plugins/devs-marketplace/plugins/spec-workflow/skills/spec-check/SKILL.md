---
name: spec-check
description: >-
  Audits all specifications in a project for health issues including stale
  status, missing sections, unapproved drafts, and assumed requirements.
  USE WHEN the user asks to "check spec health", "audit specs", "which
  specs are stale", "find missing specs", "review spec quality",
  "run spec-check", "are my specs up to date", or works with .specs/
  directory maintenance and specification metadata.
  DO NOT USE for single-spec code review or implementation verification
  — use spec-review for deep code-level audits against one spec.
version: 0.2.0
argument-hint: "[domain or path]"
context: fork
agent: explorer
---

# Spec Health Audit

Audit all specifications in the current project and report their health status.

## Workflow

### Step 1: Discover Specs

```
Glob: .specs/**/*.md
```

If `.specs/` does not exist, report: "No specification directory found. Use `/spec-new` to create your first spec."

Exclude non-spec files:
- `MILESTONES.md`
- `BACKLOG.md`
- `LESSONS_LEARNED.md`
- Files in `archive/`

### Step 2: Read Each Spec

For each spec file, extract:
- **Feature name** from the `# Feature: [Name]` header
- **Domain** from the `**Domain:**` field
- **Status** from the `**Status:**` field
- **Last Updated** from the `**Last Updated:**` field
- **Approval** from the `**Approval:**` field (default `draft` if missing)
- **Line count** (wc -l)
- **Sections present** — check for each required section header
- **Acceptance criteria** — count total, count checked `[x]`, count in-progress `[~]`
- **Requirements** — count total, count `[assumed]`, count `[user-approved]`
- **Discrepancies** — check if section has content

### Step 3: Flag Issues

For each spec, check these conditions:

| Issue | Condition | Severity |
|-------|-----------|----------|
| **Unapproved** | Approval is `draft` or missing | High |
| **Assumed requirements** | Has requirements tagged `[assumed]` | Medium |
| **Stale** | Status is `planned` but Last Updated is >30 days ago | High |
| **Incomplete** | Missing required sections (Intent, Acceptance Criteria, Key Files, Requirements, Out of Scope) | High |
| **Long spec** | Exceeds ~200 lines — consider splitting | Info |
| **No criteria** | Acceptance Criteria section is empty or has no checkboxes | High |
| **Open discrepancies** | Discrepancies section has content | Medium |
| **Missing as-built** | Status is `implemented` but Implementation Notes is empty | Medium |
| **Stale paths** | Key Files references paths that don't exist | Low |
| **Draft + implemented** | Status is `implemented` but Approval is `draft` — approval gate was bypassed | High |
| **Inconsistent approval** | Approval is `user-approved` but spec has `[assumed]` requirements | High |
| **In-progress criteria** | Has acceptance criteria marked `[~]` (implemented, not yet verified) | Info |

### Step 4: Report

Output a summary table:

```
## Spec Health Report

| Feature | Domain | Status | Approval | Updated | Lines | Issues |
|---------|--------|--------|----------|---------|-------|--------|
| Session History | sessions | implemented | user-approved | 2026-02-08 | 74 | None |
| Auth Flow | auth | planned | draft | 2026-01-15 | 45 | Unapproved, Stale (26 days) |
| Settings Page | ui | partial | draft | 2026-02-05 | 210 | Unapproved, Long spec |

## Issues Found

### High Priority
- **Auth Flow** (`.specs/auth/auth-flow.md`): Status is `planned` but last updated 26 days ago. Either implementation is stalled or the spec needs an as-built update.

### Medium Priority
- **Settings Page** (`.specs/ui/settings-page.md`): 210 lines — consider splitting into separate specs in the domain folder.

### Suggested Actions
1. Run `/spec-refine auth-flow` to validate assumptions and get user approval
2. Run `/spec-review auth-flow` to verify implementation against the spec
3. Run `/spec-update auth-flow` to update the auth flow spec
4. Split settings-page.md into sub-specs

### Approval Summary
- **User-approved:** 1 spec
- **Draft (needs /spec-refine):** 2 specs
- **Assumed requirements across all specs:** 8
```

If no issues are found, report: "All specs healthy. N specs across M domains. All user-approved."
