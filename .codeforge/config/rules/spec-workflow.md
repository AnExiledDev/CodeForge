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

See the system prompt's `<specification_management>` section for the full template, directory structure, and as-built workflow.
