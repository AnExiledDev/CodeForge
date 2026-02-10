# Specification Workflow

Every project uses `.specs/` as the specification directory. These rules are mandatory.

## Rules

1. Every non-trivial feature MUST have a spec before implementation begins.
   Use `/spec-new` to create one from the standard template.
2. Every implementation MUST end with an as-built spec update.
   Use `/spec-update` to perform the update.
3. Specs MUST be ≤200 lines. Split by feature boundary if larger;
   link via a parent overview (≤50 lines).
4. Specs MUST reference file paths, never reproduce source code,
   schemas, or type definitions inline. The code is the source of truth.
5. Each spec file MUST be independently loadable — include version,
   status, last-updated, intent, key files, and acceptance criteria.
6. Before starting a new version, MUST run `/spec-check` to audit spec health.
7. To bootstrap `.specs/` for a project that doesn't have one, use `/spec-init`.

## Directory Convention

`.specs/` at the project root. Version-organized:

```
.specs/
├── v0.1.0.md              # Single-file spec for small versions
├── v0.2.0/                # Directory for multi-feature versions
│   ├── _overview.md       # Feature matrix + architecture decisions
│   ├── feature-a.md
│   └── feature-b.md
├── ROADMAP.md             # What each version delivers and why (≤150 lines)
└── BACKLOG.md             # Deferred items not yet scheduled
```

## Standard Template

Every spec follows this structure:

```
# Feature: [Name]
**Version:** v0.X.0
**Status:** implemented | partial | planned
**Last Updated:** YYYY-MM-DD

## Intent
## Acceptance Criteria
## Key Files
## Schema / Data Model (reference file paths only)
## API Endpoints (Method | Path | Description)
## Requirements (EARS format: FR-1, NFR-1)
## Dependencies
## Out of Scope
## Implementation Notes (post-implementation only)
## Discrepancies (spec vs reality gaps)
```

## As-Built Workflow

After implementing a feature:
1. Find the spec: Glob `.specs/**/*.md`
2. Set status to "implemented" or "partial"
3. Check off acceptance criteria with passing tests
4. Add Implementation Notes for any deviations
5. Update file paths if they changed
6. Update Last Updated date

If no spec exists and the change is substantial, create one.
