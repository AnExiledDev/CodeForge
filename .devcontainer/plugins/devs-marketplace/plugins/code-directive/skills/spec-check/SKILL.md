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
- **Line count** (wc -l)
- **Sections present** — check for each required section header
- **Acceptance criteria** — count total, count checked `[x]`
- **Discrepancies** — check if section has content

### Step 3: Flag Issues

For each spec, check these conditions:

| Issue | Condition | Severity |
|-------|-----------|----------|
| **Stale** | Status is `planned` but Last Updated is >30 days ago | High |
| **Incomplete** | Missing required sections (Intent, Acceptance Criteria, Key Files, Requirements, Out of Scope) | High |
| **Oversized** | Exceeds 200 lines | Medium |
| **No criteria** | Acceptance Criteria section is empty or has no checkboxes | High |
| **Open discrepancies** | Discrepancies section has content | Medium |
| **Missing as-built** | Status is `implemented` but Implementation Notes is empty | Medium |
| **Stale paths** | Key Files references paths that don't exist | Low |

### Step 4: Report

Output a summary table:

```
## Spec Health Report

| Feature | Version | Status | Updated | Lines | Issues |
|---------|---------|--------|---------|-------|--------|
| Session History | v0.2.0 | implemented | 2026-02-08 | 74 | None |
| Auth Flow | v0.3.0 | planned | 2026-01-15 | 45 | Stale (26 days) |
| Settings Page | v0.2.0 | partial | 2026-02-05 | 210 | Oversized |

## Issues Found

### High Priority
- **Auth Flow** (`.specs/v0.3.0/auth-flow.md`): Status is `planned` but last updated 26 days ago. Either implementation is stalled or the spec needs an as-built update.

### Medium Priority
- **Settings Page** (`.specs/v0.2.0/settings-page.md`): 210 lines exceeds the 200-line limit. Split into sub-specs.

### Suggested Actions
1. Run `/spec-update auth-flow` to update the auth flow spec
2. Split settings-page.md into sub-specs
```

If no issues are found, report: "All specs healthy. N specs across M versions."
