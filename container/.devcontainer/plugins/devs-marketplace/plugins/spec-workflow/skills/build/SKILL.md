---
name: build
description: >-
  Implements an approved spec package through the full lifecycle: discovery,
  task decomposition, parallel build, self-healing review, and spec closure.
  Reads Constitution + spec package, auto-creates tasks from group frontmatter,
  and generates a Completion Summary Report. USE WHEN the user asks to
  "build the spec", "implement this feature", "build from spec", "start
  building", "run build", or works with approved spec packages.
  DO NOT USE for creating or refining specs (use /spec) or checking
  spec health (use /specs).
version: 1.0.0
argument-hint: "[feature-name or spec-path]"
effort: max
---

# Implement & Close Spec Package

## Mental Model

An approved spec package is a complete implementation contract. The human has reviewed decisions and scope. The AI's job is to build everything described in the spec, verify it works, and close the loop — without human intervention.

The build process reads three layers of context:
1. **Constitution** (`.specs/CONSTITUTION.md`) — project-level decisions
2. **Spec package** (`index.md` + `context.md` + `groups/*.md`) — feature decisions + ACs
3. **Codebase** — existing code, patterns, dependencies

Group frontmatter drives task decomposition. Each group becomes a work unit assigned to an agent (or executed sequentially for simple specs). The `depends_on` field determines execution order.

---

## Workflow

### Phase 1: Discovery & Gate Check

#### 1a: Find the Spec

```
Glob: .specs/**/{feature}/index.md  OR  .specs/**/index.md
```

Match by `$ARGUMENTS`. If ambiguous, list matching specs and ask.

#### 1b: Gate Check

Read `index.md` frontmatter. Verify `approval: approved`.

- If `approved` → proceed
- If `draft` → **STOP**: "This spec is not approved. Run `/spec {feature}` to refine and approve it."

If status is `implemented`, ask: "This spec is already implemented. Re-build, update, or error?"

#### 1c: Load Full Context

Read in order:
1. `.specs/CONSTITUTION.md` (if exists and populated)
2. `index.md` — decisions, AC summary, scope
3. `context.md` — invariants, anti-patterns, integration context, schema, constraints
4. All `groups/*.md` — full ACs, frontmatter, file ownership

Extract:
- All acceptance criteria and their current markers
- Group dependency graph from `depends_on` fields
- File ownership map from `files_owned` fields
- Existing files vs new files to create

### Phase 2: Planning & Decomposition

#### 2a: Assess Complexity

Count groups and total ACs. Apply thresholds:

| Indicator | Solo | Team |
|-----------|------|------|
| Groups | 1-2 | 3+ |
| Total ACs | ≤6 | 7+ |
| Independent groups (no depends_on) | 1 | 2+ |

If 2+ indicators point to Team → recommend team spawning.

#### 2b: Create Implementation Plan

Use `EnterPlanMode`. The plan MUST include:

1. **Spec reference** — path to spec package
2. **Constitution summary** — key decisions that affect this build
3. **Group execution order** — respecting `depends_on` graph
4. **Per-group breakdown:**
   - Files to create/modify (from `files_owned`)
   - ACs to implement (from `criteria`)
   - Tests to write (derived from ACs)
   - Dependencies on other groups
5. **Team composition** (if applicable):
   - Which specialist agent types for which groups
   - File ownership boundaries (no overlap)
6. **Phase 3-5 instructions** (preserved for post-plan execution)

Present via `ExitPlanMode`. Wait for approval.

#### 2c: Team Setup (if applicable)

If team recommended and approved:
1. `TeamCreate` with feature name
2. Create tasks from group frontmatter — each group = one task
3. Spawn teammates using specialist agents matching the work
4. Assign groups respecting `depends_on` ordering

### Phase 3: Implementation

Execute the plan. For each group (solo or via team):

#### 3a: Agent Context Loading

Each implementing agent reads:
- `index.md` — for decisions
- `context.md` — for invariants, anti-patterns, schema, constraints
- Their assigned group file — for full ACs with examples

#### 3b: Build Loop (per AC)

For each acceptance criterion in the group:

1. **Write test FROM THE SPEC** — derive test from the AC's Given/When/Then + Example. NOT from the implementation.
   ```python
   def test_webhook_registration():
       """Verifies: AC-1 (integrations/webhook-delivery)"""
       # Test derived from spec's Given/When/Then
   ```
2. **Implement** — write the code to make the test pass
3. **Mark `[~]`** — update the AC marker in the group file
4. **Record AI decisions** — if the AI encounters a decision not in the spec or Constitution, record it in the group's `## AI Decisions` table and continue

#### 3c: Invariant Check

After implementing all ACs in a group, verify the group's work against `context.md` invariants. Every invariant must hold.

#### 3d: Progress Tracking

Update group frontmatter: `status: in_progress`, `owner: {agent-name}`

### Phase 4: Review & Fix Loop

**This is a FIX LOOP, not a report.** The AI finds issues and fixes them.

#### 4a: Re-read Spec with Fresh Eyes

Re-read the full spec package. Compare implementation against:
- Every AC's EARS criterion text
- Every invariant in context.md
- Every anti-pattern (verify none were violated)
- Schema intent (verify models match)
- Constraints (verify file locations, patterns)

#### 4b: Run All Tests

Run the full test suite (not just feature tests). Check for:
- All new tests passing
- No regressions in existing tests
- Coverage of all ACs

#### 4c: Fix Issues

For each issue found:
1. Fix the code
2. Re-run affected tests
3. Verify the fix doesn't break invariants

**Loop until:** All ACs pass OR an issue is genuinely unfixable (document as discrepancy).

#### 4d: Upgrade Markers

For each AC where the test passes: upgrade `[~]` → `[x]` in the group file.

Update group frontmatter: `status: verified`

### Phase 5: Closure

#### 5a: Update Spec Status

In `index.md` frontmatter:
- Set `status: implemented` (all ACs `[x]`) or `partial` (some remain `[ ]`/`[~]`)
- Set `last_updated` to today

#### 5b: Generate Completion Summary Report

Use `references/summary-report-template.md`. Include:

- **AC Results:** Table of all ACs with pass/fail status and test file paths
- **AI Decisions:** Aggregated from all group files
- **Concerns:** Edge cases, performance observations, security notes
- **Discrepancies:** Gaps between spec and implementation (if any)

Present the report to the user.

#### 5c: Shutdown Team (if applicable)

Send shutdown requests to all teammates. Wait for confirmation. Clean up.

---

## Spec-First Testing (Hard Rule)

Every test MUST be derived from the spec's acceptance criteria, NOT from the implementation.

**Why:** When tests are derived from code, they validate current behavior — including bugs. Spec-derived tests validate intended behavior.

**How:**
- Read the AC's Given/When/Then + Example
- Write the test to match the spec's expected behavior
- Include traceability: `"""Verifies: AC-N (domain/feature)"""`

**Traceability enables:**
- Automated verification that every AC has a test
- Impact analysis when spec changes
- No orphan tests (every test maps to an AC)

---

## `[ai-decided]` Workflow

When the AI encounters a decision not covered by Constitution or spec:

1. Make best choice: Constitution patterns → codebase patterns → best practice
2. Record in the group file's `## AI Decisions` table:
   ```
   | AD-1 | Connection pool size | 10 connections | Matches existing httpx config |
   ```
3. **Continue building** — do NOT stop for user input
4. Summary Report presents all decisions for post-build review
5. User can: approve, override (AI re-implements), or promote to Constitution

---

## AC Markers

| Marker | Meaning | Set By |
|--------|---------|--------|
| `[ ]` | Not started | `/spec` (creation) |
| `[~]` | Implemented, not yet verified | Phase 3 (after code written) |
| `[x]` | Verified — tests pass | Phase 4 (after test passes) |

Markers live in group files, inline with each AC heading.

---

## Persistence & Resumability

If interrupted mid-build:
- Group frontmatter `status` shows which groups are done
- AC markers show which criteria are addressed
- To resume: re-run `/build {feature}` — it detects partial state and continues from where it left off

---

## Ambiguity Policy

- If `$ARGUMENTS` matches multiple specs, list and ask
- If a group's `depends_on` references a non-existent group, warn and ask
- If `files_owned` overlap between groups, warn and ask how to resolve
- If the Constitution is missing or empty, proceed with codebase-inferred decisions (note as AI decisions)
- If Phase 4 reveals significant gaps, present to user before closing

---

## Anti-Patterns

- **Skipping the plan:** Always plan before building. The plan is the user's approval gate.
- **Tests from code:** Tests validate spec intent, not implementation details. Derive from ACs.
- **Optimistic markers:** Never mark `[x]` without a passing test. Every `[x]` has evidence.
- **Scope creep:** Build ONLY what's in the spec. Additions go in the backlog.
- **Silent failures:** Every Phase 4 issue must be fixed or explicitly documented as a discrepancy.
- **Skipping Phase 5:** The spec-reminder hook catches this, but close the loop immediately.

---

## Reference Files

| File | Contents |
|------|----------|
| `references/review-checklist.md` | Phase 4 review checklist |
| `references/summary-report-template.md` | Completion Summary Report format |
