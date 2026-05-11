# Specification Workflow

Every project uses `.specs/` as the specification directory. Specs are directory-based "spec packages." These rules are mandatory.

## Rules

1. Every non-trivial feature MUST have a spec package before implementation begins.
   Use `/spec` to create one — it handles creation, refinement, and approval in one flow.
2. Every implementation MUST end with spec closure.
   `/build` handles this automatically in its final phase.
3. Specs are directory packages, not single files:
   ```
   .specs/{domain}/{feature}/
     index.md      # Human-facing: intent, decisions, AC summary, scope
     context.md    # AI-facing: invariants, anti-patterns, schema, constraints
     groups/       # Per-group AC files with frontmatter for parallel build
   ```
4. Specs MUST reference file paths, never reproduce source code,
   schemas, or type definitions inline. The code is the source of truth.
5. `index.md` is the human review surface — keep it under 80 lines.
   All AI-facing detail goes in `context.md` and group files.
6. Cross-cutting decisions belong in `.specs/CONSTITUTION.md`, not repeated
   in every spec. Use `/spec constitution` to create or update it.
7. `/spec` auto-bootstraps `.specs/` on first use. No separate init needed.
8. New specs start with `approval: draft`. The AI makes obvious decisions
   and presents only genuine trade-offs to the human. Once the human
   approves decisions and scope, the spec is `approval: approved`.
9. A spec-reminder hook fires at Stop when code was modified but specs
   weren't updated. Use `/build` to close the loop.
10. For approved specs, use `/build` to orchestrate the full implementation
    lifecycle — plan, build, self-healing review, and spec closure in one
    pass. No separate update step needed.
11. Use `/specs` to check spec health across the project — status,
    staleness, draft specs, and unresolved AI decisions.

## Commands

| Command | Purpose |
|---------|---------|
| `/spec <feature>` | Create, refine, and approve a spec package |
| `/spec constitution` | Create or update the project Constitution |
| `/build <feature>` | Implement an approved spec, review, and close |
| `/specs` | Dashboard: spec health across the project |

## Acceptance Criteria Markers

| Marker | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[~]` | Implemented, not yet verified — code written, tests not confirmed |
| `[x]` | Verified — tests pass, behavior confirmed |

## Approval Model

Specs use spec-level approval (not per-requirement):
- `draft` — not ready for implementation. `/build` rejects it.
- `approved` — human has reviewed decisions and scope. Ready to build.

The AI captures obvious decisions in "Already Decided." The human reviews
"Needs Your Input" for genuine trade-offs. No `[assumed]`/`[user-approved]`
per-requirement tagging.
