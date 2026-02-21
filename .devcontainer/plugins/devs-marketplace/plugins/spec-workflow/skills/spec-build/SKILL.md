---
name: spec-build
description: >-
  This skill should be used when the user asks to "implement the spec",
  "build from spec", "start building the feature", "spec-build",
  "implement this feature from the spec", "build what the spec describes",
  or needs to orchestrate full implementation of an approved specification
  through a phased workflow of planning, building, reviewing, and closing.
version: 0.1.0
---

# Spec-Driven Implementation

## Mental Model

An approved spec is a contract — it defines exactly what to build, what to skip, and how to verify success. This skill takes a `user-approved` spec and orchestrates the full implementation lifecycle: plan the work, build it, review everything against the spec, and close the loop. No separate `/spec-update` run is needed afterward — Phase 5 performs full as-built closure.

The workflow is five phases executed in strict order. Each phase has a clear gate before the next can begin.

```
/spec-new  ->  /spec-refine  ->  /spec-build
                                    |
                                    +-> Phase 1: Discovery & Gate Check
                                    +-> Phase 2: Implementation Planning
                                    +-> Phase 3: Implementation
                                    +-> Phase 4: Comprehensive Review
                                    +-> Phase 5: Spec Closure
```

> **Note:** Phase 4's review functionality is also available standalone via `/spec-review` for features implemented outside of `/spec-build`.

---

## Acceptance Criteria Markers

During implementation, acceptance criteria use three states:

| Marker | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[~]` | Implemented, not yet verified — code written, tests not confirmed |
| `[x]` | Verified — tests pass, behavior confirmed |

Phase 3 flips `[ ]` to `[~]` as criteria are addressed in code. Phase 4 upgrades `[~]` to `[x]` after verification. This convention is the only spec edit during active implementation.

---

## CRITICAL: Planning Before Implementation

Phase 2 generates an implementation plan. This plan MUST be created and approved before any code changes begin in Phase 3. Use `EnterPlanMode` to create the plan. The plan MUST include Phases 3, 4, and 5 instructions verbatim — these phases run after plan approval, and the instructions must be preserved so they execute correctly even across context boundaries.

Do NOT skip planning. Do NOT begin writing code during Phase 2. The plan is a contract with the user — get approval first.

---

## Complexity Assessment

Before planning, assess the spec's complexity to determine whether team spawning would benefit the implementation.

**Complexity indicators** — if two or more apply, the spec is complex:
- 8+ functional requirements (FR-*)
- Cross-layer work (backend + frontend + tests spanning different frameworks)
- 3+ independent workstreams that could run in parallel
- Multiple services or modules affected

### When Complexity is High: Recommend Team Spawning

Decompose work into parallel workstreams and recommend team composition using the project's existing custom agents. These agents carry frontloaded skills, safety hooks, and tailored instructions — always prefer them over generalist agents.

**Recommended compositions by spec type:**

| Spec Type | Teammates |
|-----------|-----------|
| Full-stack feature | researcher + test-writer + doc-writer |
| Backend-heavy | researcher + test-writer |
| Security-sensitive | security-auditor + test-writer |
| Refactoring work | refactorer + test-writer |
| Multi-service | researcher per service + test-writer |

**Available specialist agents:** `architect`, `bash-exec`, `claude-guide`, `debug-logs`, `dependency-analyst`, `doc-writer`, `explorer`, `generalist`, `git-archaeologist`, `migrator`, `perf-profiler`, `refactorer`, `researcher`, `security-auditor`, `spec-writer`, `statusline-config`, `test-writer`

Use `generalist` only when no specialist matches the workstream. Hard limit: 3-5 active teammates maximum.

**When complexity is low** (< 8 requirements, single layer, sequential work): skip team spawning, implement directly in the main thread. Still follow all 5 phases.

The user can override the team recommendation in either direction.

---

## Phase 1: Discovery & Gate Check

### Step 1: Find the Spec

```
Glob: .specs/**/*.md
```

Match by `$ARGUMENTS` — the user provides a feature name or path. If ambiguous, list matching specs and ask which one to implement.

### Step 2: Read the Full Spec

Read every line. Extract structured data:

- **All `[user-approved]` requirements** — every FR-* and NFR-* with their EARS-format text
- **All acceptance criteria** — every `[ ]` checkbox item
- **Key Files** — existing files to read for implementation context
- **Dependencies** — prerequisite features, systems, or libraries
- **Out of Scope** — explicit exclusions that define boundaries to respect

### Step 3: Gate Check

**Hard gate**: Verify the spec has `**Approval:** user-approved`.

- If `user-approved` -> proceed to Step 4
- If `draft` or missing -> **STOP**. Print: "This spec is not approved for implementation. Run `/spec-refine <feature>` first to validate assumptions and get user approval." Do not continue.

This gate is non-negotiable. Draft specs contain unvalidated assumptions — building against them risks wasted work.

### Step 4: Build Context

Read every file listed in the spec's `## Key Files` section. These are the files the spec author identified as most relevant to implementation. Understanding them is prerequisite to planning.

After reading, note:
- Which key files exist vs. which are new (to be created)
- Patterns, conventions, and interfaces in existing files
- Any dependencies or constraints discovered in the code

### Step 5: Assess Complexity

Apply the complexity indicators from the assessment section above. Note the result for Phase 2 — it determines whether to recommend team spawning.

---

## Phase 2: Implementation Planning

**Do NOT write any code in this phase.** This phase produces a plan only.

Use `EnterPlanMode` to enter plan mode. Create a structured implementation plan covering:

### Plan Structure

1. **Spec Reference** — path to the spec file, domain, feature name
2. **Complexity Assessment** — indicators found, team recommendation (if applicable)
3. **Requirement-to-File Mapping** — each FR-*/NFR-* mapped to specific file changes
4. **Implementation Steps** — ordered by dependency, grouped by related requirements:
   - For each step: files to create/modify, requirements addressed, acceptance criteria to verify
   - Mark which steps depend on others completing first
5. **Out-of-Scope Boundaries** — items from the spec's Out of Scope section, noted as "do not touch"
6. **Verification Checkpoints** — acceptance criteria listed as checkpoints after each logical group of steps

### Preserving Phase Instructions

The plan MUST include the following phases verbatim so they survive context across the implementation session. Include them as a "Post-Implementation Phases" section in the plan:

**Phase 3 instructions**: Execute steps, flip `[ ]` to `[~]` after addressing each criterion in code.

**Phase 4 instructions**: Run comprehensive review using the Spec Implementation Review Checklist at `skills/spec-build/references/review-checklist.md`. Walk every requirement, verify every criterion, audit code quality, check spec consistency. Produce a summary report.

**Phase 5 instructions**: Update spec status, add Implementation Notes, update Key Files, add Discrepancies, set Last Updated date.

### Team Plan (if applicable)

If complexity assessment recommends team spawning, the plan should additionally include:
- Workstream decomposition with clear boundaries
- Teammate assignments by specialist type
- Task dependencies between workstreams
- Integration points where workstreams converge

Present the plan via `ExitPlanMode` and wait for explicit user approval before proceeding.

---

## Phase 3: Implementation

Execute the approved plan step by step. This is where code gets written.

### Execution Rules

1. **Follow the plan order** — implement steps in the sequence approved by the user
2. **Live spec updates** — after completing work on an acceptance criterion, immediately edit the spec file:
   - Flip `[ ]` to `[~]` for criteria addressed in code
   - This is the ONLY spec edit during Phase 3 — no structural changes to the spec
3. **Track requirement coverage** — mentally track which FR-*/NFR-* requirements have been addressed as you work through the steps
4. **Note deviations** — if the implementation must deviate from the plan (unexpected constraint, better approach discovered, missing dependency), note the deviation for Phase 4. Do not silently diverge.
5. **Respect boundaries** — do not implement anything listed in the spec's Out of Scope section

### If Using a Team

If team spawning was approved in Phase 2:

1. Create the team using `TeamCreate`
2. Create tasks in the team task list mapped to spec requirements
3. Spawn teammates using the recommended specialist agent types
4. Assign tasks by domain match
5. Coordinate integration points as workstreams converge
6. Collect results and ensure all `[ ]` criteria are flipped to `[~]`

### Progress Tracking

The spec file itself is the progress tracker. At any point during Phase 3:
- `[ ]` criteria = not yet addressed
- `[~]` criteria = addressed in code, awaiting verification
- Count of `[~]` vs total criteria shows implementation progress

---

## Phase 4: Comprehensive Review

The most critical phase. Audit everything built against the spec. Use the Spec Implementation Review Checklist at `skills/spec-build/references/review-checklist.md` as the authoritative guide.

### 4A: Requirement Coverage Audit

Walk through every FR-* and NFR-* requirement from the spec:

1. For each requirement: identify the specific files and functions that address it
2. Verify the implementation matches the EARS-format requirement text
3. Flag requirements that were missed entirely
4. Flag requirements only partially addressed
5. Flag code written outside the spec's scope (scope creep)

### 4B: Acceptance Criteria Verification

For each `[~]` criterion in the spec:

1. Find or write the corresponding test
2. Run the test and confirm it passes
3. If the test passes -> upgrade `[~]` to `[x]` in the spec
4. If the test fails -> note the failure, do not upgrade
5. For criteria without tests: write the test, run it, then decide

Report any criteria that cannot be verified and explain why.

### 4C: Code Quality Review

Check the implementation against code quality standards:

- Error handling at appropriate boundaries
- No hardcoded values that should be configurable
- Function sizes within limits (short, single-purpose)
- Nesting depth within limits
- Test coverage for new code paths
- No regressions in existing tests

### 4D: Spec Consistency Check

Compare implemented behavior against each EARS requirement:

- Does the code actually do what each requirement says?
- Are there behavioral differences between spec intent and actual implementation?
- Are Key Files in the spec still accurate? Any new files missing from the list?
- Are there files created during implementation that should be added?

### 4E: Summary Report

Present a structured summary to the user:

```
## Implementation Review Summary

**Requirements:** N/M addressed (list any gaps)
**Acceptance Criteria:** N verified [x], M in progress [~], K not started [ ]
**Deviations from Plan:** (list any, or "None")
**Discrepancies Found:** (spec vs reality gaps, or "None")
**Code Quality Issues:** (list any, or "None")

**Recommendation:** Proceed to Phase 5 / Fix issues first (with specific list)
```

If issues are found, address them before moving to Phase 5. If issues require user input, present them and wait for direction.

---

## Phase 5: Spec Closure

The final phase. Update the spec to reflect what was actually built. This replaces the need for a separate `/spec-update` run.

### Step 1: Update Status

Set `**Status:**` to:
- `implemented` — if all acceptance criteria are `[x]`
- `partial` — if any criteria remain `[ ]` or `[~]`

### Step 2: Update Metadata

- Set `**Last Updated:**` to today's date (YYYY-MM-DD)
- Preserve `**Approval:** user-approved` — never downgrade

### Step 3: Add Implementation Notes

In the `## Implementation Notes` section, document:

- **Deviations from the original spec** — what changed and why
- **Key design decisions** — choices made during implementation not in the original spec
- **Trade-offs accepted** — what was sacrificed and the reasoning
- **Surprising findings** — edge cases, performance characteristics, limitations discovered

Reference file paths, not code. Keep notes concise.

### Step 4: Update Key Files

In `## Key Files`:
- Add files created during implementation
- Remove files that no longer exist
- Update paths that changed
- Verify every path listed actually exists

### Step 5: Add Discrepancies

In `## Discrepancies`, document any gaps between spec intent and actual build:
- Requirements that were met differently than specified
- Behavioral differences from the original EARS requirements
- Scope adjustments that happened during implementation

If no discrepancies exist, leave the section empty or note "None."

### Step 6: Final Message

Print: "Implementation complete. Spec updated to `[status]`. Run `/spec-check` to verify spec health."

---

## Persistence Policy

Complete all five phases. Stop only when:
- Gate check fails in Phase 1 (spec not approved) — hard stop
- User explicitly requests stop
- A genuine blocker requires user input that cannot be resolved

If interrupted mid-phase, resume from the last completed step. Phase 3 progress is tracked via acceptance criteria markers in the spec — `[~]` markers show exactly where implementation left off.

Do not skip phases. Do not combine phases. Each phase exists because it surfaces different types of issues. Phase 4 in particular catches problems that are invisible during Phase 3.

---

## Ambiguity Policy

- If `$ARGUMENTS` matches multiple specs, list them and ask the user which to implement.
- If a spec has no acceptance criteria, warn the user and suggest adding criteria before implementation. Offer to proceed anyway if the user confirms.
- If Key Files reference paths that don't exist, note this in Phase 1 and proceed — they may be files to create.
- If the spec has both `[assumed]` and `[user-approved]` requirements, the gate check still fails — all requirements must be `[user-approved]` before implementation begins.
- If Phase 4 reveals significant gaps, do not silently proceed to Phase 5. Present the gaps and get user direction on whether to fix them first or document them as discrepancies.
- If the spec is already `implemented`, ask: is this a re-implementation, an update, or an error?

---

## Anti-Patterns

- **Skipping the plan**: Jumping from Phase 1 to Phase 3 without a plan leads to unstructured work and missed requirements. Always plan first.
- **Optimistic verification**: Marking `[~]` as `[x]` without running the actual test. Every `[x]` must be backed by a passing test or confirmed behavior.
- **Scope creep during implementation**: Building features not in the spec because they "seem useful." Respect Out of Scope boundaries.
- **Deferring Phase 4**: "I'll review later" means "I won't review." Phase 4 runs immediately after Phase 3.
- **Silent deviations**: Changing the implementation approach without noting it. Every deviation gets documented in Phase 4/5.
- **Skipping Phase 5**: The spec-reminder hook will catch this, but it's better to close the loop immediately. Phase 5 is not optional.
