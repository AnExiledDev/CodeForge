# Specification Workflow

Every project uses `.specs/` as the specification directory. These rules are mandatory.

## Rules

1. Every non-trivial feature MUST have a spec before implementation begins.
   Use `/spec-new` to create one from the standard template.
2. Every implementation MUST end with an as-built spec update.
   Use `/spec-update` to perform the update.
3. Specs should aim for ~200 lines. Split by feature boundary when
   significantly longer into separate specs in the domain folder.
   Completeness matters more than hitting a number.
4. Specs MUST reference file paths, never reproduce source code,
   schemas, or type definitions inline. The code is the source of truth.
5. Each spec file MUST be independently loadable — include domain,
   status, last-updated, intent, key files, and acceptance criteria.
6. Before starting a new milestone, MUST run `/spec-check` to audit spec health.
7. To bootstrap `.specs/` for a project that doesn't have one, use `/spec-init`.
8. New specs start with `**Approval:** draft` and all requirements tagged
   `[assumed]`. Use `/spec-refine` to validate assumptions with the user
   and upgrade to `[user-approved]` before implementation begins.
9. A spec-reminder advisory hook fires at Stop when code was modified but
   specs weren't updated. Use `/spec-update` to close the loop.
10. For approved specs, use `/spec-build` to orchestrate the full
    implementation lifecycle — plan, build, review, and close the spec
    in one pass. Phase 5 handles as-built closure, so a separate
    `/spec-update` is not needed afterward.
11. Use `/spec-review` for standalone implementation verification against
    a spec — after manual implementation, post-change regression checks,
    or pre-release audits. It reads code, verifies requirements and
    acceptance criteria, and recommends `/spec-update` when done.

## Acceptance Criteria Markers

Acceptance criteria use three states during implementation:

| Marker | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[~]` | Implemented, not yet verified — code written, tests not confirmed |
| `[x]` | Verified — tests pass, behavior confirmed |

`/spec-build` Phase 3 flips `[ ]` to `[~]` as criteria are addressed.
Phase 4 upgrades `[~]` to `[x]` after verification. `/spec-update`
treats any remaining `[~]` as `[ ]` if they were never verified.

## Directory Convention

`.specs/` at the project root. Domain-organized:

```
.specs/
├── MILESTONES.md          # Milestone tracker linking to feature specs
├── BACKLOG.md             # Deferred items not yet scheduled
├── auth/                  # Domain folder
│   ├── login-flow.md      # Feature spec
│   └── oauth-providers.md # Feature spec
├── search/                # Domain folder
│   └── full-text-search.md
└── onboarding/
    └── user-signup.md
```

All specs live in domain subfolders. Only `MILESTONES.md` and `BACKLOG.md`
reside at the `.specs/` root.

## Standard Template

Every spec follows this structure:

```
# Feature: [Name]
**Domain:** [domain-name]
**Status:** implemented | partial | planned
**Last Updated:** YYYY-MM-DD
**Approval:** draft

## Intent
## Acceptance Criteria
## Key Files
## Schema / Data Model (reference file paths only)
## API Endpoints (Method | Path | Description)
## Requirements (EARS format: FR-1, NFR-1)
## Dependencies
## Out of Scope
## Resolved Questions
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
