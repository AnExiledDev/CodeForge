---
name: spec-check
description: >-
  This skill should be used when the user asks to "check spec status",
  "audit specs", "which specs are stale", "spec health", "find missing
  specs", "review spec quality", or needs a comprehensive audit of all
  specifications in the project.
version: 0.1.0
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
- `ROADMAP.md`
- `BACKLOG.md`
- `LESSONS_LEARNED.md`
- Files in `archive/`
- `_overview.md` files (report them separately as parent specs)

### Step 2: Read Each Spec

For each spec file, extract:
- **Feature name** from the `# Feature: [Name]` header
- **Version** from the `**Version:**` field
- **Status** from the `**Status:**` field
- **Last Updated** from the `**Last Updated:**` field
- **Approval** from the `**Approval:**` field (default `draft` if missing)
- **Line count** (wc -l)
- **Sections present** — check for each required section header
- **Acceptance criteria** — count total, count checked `[x]`
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

### Step 4: Report

Output a summary table:

```
## Spec Health Report

| Feature | Version | Status | Approval | Updated | Lines | Issues |
|---------|---------|--------|----------|---------|-------|--------|
| Session History | v0.2.0 | implemented | user-approved | 2026-02-08 | 74 | None |
| Auth Flow | v0.3.0 | planned | draft | 2026-01-15 | 45 | Unapproved, Stale (26 days) |
| Settings Page | v0.2.0 | partial | draft | 2026-02-05 | 210 | Unapproved, Long spec |

## Issues Found

### High Priority
- **Auth Flow** (`.specs/v0.3.0/auth-flow.md`): Status is `planned` but last updated 26 days ago. Either implementation is stalled or the spec needs an as-built update.

### Medium Priority
- **Settings Page** (`.specs/v0.2.0/settings-page.md`): 210 lines — consider splitting into sub-specs for easier consumption.

### Suggested Actions
1. Run `/spec-refine auth-flow` to validate assumptions and get user approval
2. Run `/spec-update auth-flow` to update the auth flow spec
3. Split settings-page.md into sub-specs

### Approval Summary
- **User-approved:** 1 spec
- **Draft (needs /spec-refine):** 2 specs
- **Assumed requirements across all specs:** 8
```

If no issues are found, report: "All specs healthy. N specs across M versions. All user-approved."
