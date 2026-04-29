---
name: specs
description: >-
  Dashboard showing the health and status of all spec packages in the project.
  Scans .specs/ directories, parses frontmatter, and reports on spec status,
  staleness, draft specs, and unresolved AI decisions. USE WHEN the user asks
  to "check specs", "show spec status", "spec dashboard", "which specs are
  stale", "audit specs", "list specs", "spec health", or works with .specs/
  directory overview. DO NOT USE for creating specs (use /spec) or building
  specs (use /build).
version: 1.0.0
argument-hint: ""
effort: max
---

# Spec Dashboard

## Mental Model

A quick health check across all specs in the project. Scans `.specs/` directories, parses `index.md` frontmatter from each spec package, and presents a summary. No modifications — read-only.

---

## Workflow

### Step 1: Scan

```
Glob: .specs/**/index.md
```

For each `index.md` found, parse the YAML frontmatter.

Also check:
- `.specs/CONSTITUTION.md` — exists and is populated (not just template)?
- `.specs/BACKLOG.md` — exists?

### Step 2: Collect Metrics

For each spec package, extract from frontmatter:
- `feature` — name
- `domain` — domain folder
- `status` — planned / partial / implemented
- `approval` — draft / approved
- `size` — S / M / L
- `last_updated` — date
- `groups` — count

Also scan group files for:
- AC marker counts: `[ ]`, `[~]`, `[x]`
- AI Decision count (rows in `## AI Decisions` tables)
- Unresolved AI decisions (no `User Verdict` entry)

### Step 3: Present Dashboard

```
## Spec Dashboard

**Project:** {project name from Constitution or directory}
**Constitution:** {populated / template-only / missing}
**Backlog:** {N ideas / missing}
**Total Specs:** {count}

### By Status

| Status | Count | Specs |
|--------|-------|-------|
| Planned | N | feature-a, feature-b |
| Partial | N | feature-c |
| Implemented | N | feature-d, feature-e |

### Attention Needed

| Spec | Issue | Action |
|------|-------|--------|
| feature-x | Draft — not approved | Run `/spec feature-x` to refine |
| feature-y | Stale — last updated 45 days ago | Review and update |
| feature-z | 3 unresolved AI decisions | Review AI decisions in group files |
| feature-w | Partial — 2/5 ACs unverified | Resume `/build feature-w` |

### Summary

- {N} specs ready to build (planned + approved)
- {N} specs in progress (partial)
- {N} specs complete (implemented)
- {N} AI decisions awaiting review
```

### Step 4: Recommendations

Based on findings, suggest actions:

- **No Constitution:** "Run `/spec constitution` to capture project-level decisions."
- **Draft specs:** "Run `/spec {feature}` to refine and approve."
- **Stale specs:** "Review — specs not updated in 30+ days may be outdated."
- **Partial builds:** "Resume `/build {feature}` to complete implementation."
- **Unresolved AI decisions:** "Review and approve, override, or promote to Constitution."

---

## Staleness Rules

| Condition | Stale? |
|-----------|--------|
| `status: implemented`, any age | No — completed specs don't go stale |
| `status: planned`, `last_updated` > 30 days | Yes — may be abandoned |
| `status: partial`, `last_updated` > 14 days | Yes — build may be stuck |
| `approval: draft`, `last_updated` > 7 days | Yes — needs refinement |

---

## Ambiguity Policy

- If `.specs/` doesn't exist: "No specs found. Run `/spec {feature}` to create your first spec package."
- If spec packages have malformed frontmatter: report the error, skip the spec, continue scanning
- If a spec directory lacks `context.md` or `groups/`: flag as incomplete structure
