---
name: spec-review
description: >-
  Performs a standalone deep implementation review by reading code and
  verifying full adherence to a specification's requirements and acceptance
  criteria. USE WHEN the user asks to "review the spec", "verify
  implementation", "does code match spec", "audit implementation",
  "check spec adherence", "run spec-review", "regression check", or
  works with post-implementation verification and pre-release audits.
  DO NOT USE for batch metadata audits across all specs (use spec-check)
  or for updating spec status after review (use spec-update).
version: 0.2.0
argument-hint: "[spec-path]"
---

# Spec Implementation Review

## Mental Model

A spec is a contract — but contracts only matter if someone verifies them. `/spec-review` is the verification step: given a spec and the code that claims to implement it, does the code actually do what the spec says?

This is a standalone, single-spec, deep implementation review. Unlike `/spec-check` (which audits metadata health across all specs without reading code) and unlike `/spec-build` Phase 4 (which is locked inside the build workflow), `/spec-review` can be invoked independently at any time after implementation exists.

Use cases:

- **Manual implementation** — you built a feature without `/spec-build` and want to verify the work before running `/spec-update`
- **Post-change regression check** — re-verify after modifying an already-implemented feature
- **Pre-release audit** — confirm a feature still matches its spec before shipping
- **Onboarding verification** — check if what's in the code matches what the spec says

```
Lifecycle positioning:

/spec-new → /spec-refine → implement (manually or via /spec-build) → /spec-review → /spec-update

Or with /spec-build (which has its own Phase 4):
/spec-new → /spec-refine → /spec-build (includes review) → done

/spec-review is independent — usable at any time after implementation exists.
```

---

## Relationship to Other Skills

| Skill | What it does | How `/spec-review` differs |
|-------|-------------|---------------------------|
| `/spec-check` | Batch metadata audit (all specs, no code reading) | Single-spec deep code audit |
| `/spec-build` Phase 4 | Same depth, but embedded in the build workflow | Standalone, invokable independently |
| `/spec-update` | Updates spec metadata after implementation | `/spec-review` audits first, then recommends `/spec-update` |

---

## Spec Edits During Review

`/spec-review` makes limited spec edits — just enough to record what it verified:

- Upgrade `[ ]` or `[~]` → `[x]` for criteria verified by passing tests
- Downgrade `[x]` → `[ ]` if a previously-verified criterion now fails (regression)
- Add entries to `## Discrepancies` for gaps found
- Update `## Key Files` if paths are stale (files moved/deleted/added)
- Update `**Last Updated:**` date

It does NOT change `**Status:**` or add `## Implementation Notes` — that's `/spec-update`'s job. Clear boundary: `/spec-review` verifies and records findings; `/spec-update` closes the loop.

---

## Workflow

### Step 1: Discovery

**Find the spec.** Match `$ARGUMENTS` (feature name or path) against:

```
Glob: .specs/**/*.md
```

If ambiguous, list matching specs and ask which one to review.

**Read the full spec.** Extract:

- All FR-* and NFR-* requirements with their EARS-format text
- All acceptance criteria with current markers (`[ ]`, `[~]`, `[x]`)
- Key Files — every file path listed
- Out of Scope — boundaries to respect
- Discrepancies — any existing entries

**Gate check.** `/spec-review` works on any spec with implementation to review:

| Approval | Status | Action |
|----------|--------|--------|
| `user-approved` | `planned` | Proceed (reviewing work done against approved spec) |
| `user-approved` | `partial` or `implemented` | Proceed (re-reviewing) |
| `draft` | any | **Warn**: "This spec is `draft`. Requirements may not be validated. Consider running `/spec-refine` first. Proceed anyway?" |

Unlike `/spec-build` which hard-blocks on `draft` (because it's about to write code), `/spec-review` is read-heavy — reviewing existing code against a draft spec is still useful, even if the spec itself isn't finalized.

**Read every Key File.** Read all files listed in the spec's `## Key Files` section. These are the files the spec author identified as implementing the feature. Understanding them is prerequisite to the audit.

---

### Step 2: Requirement Coverage Audit

Walk every FR-* and NFR-* requirement from the spec. Use the Spec Implementation Review Checklist at `spec-build/references/review-checklist.md` sections 4A and 4D as the authoritative guide.

**For each FR-* requirement:**

1. Identify the file(s) and function(s) that implement it
2. Verify the implementation matches the EARS-format requirement text
3. Confirm the requirement is fully addressed (not partially)
4. Note if the requirement was met through a different approach than planned

**For each NFR-* requirement:**

1. Identify how the non-functional requirement is enforced
2. Verify measurable NFRs have been tested or measured
3. Confirm the NFR is met under expected conditions, not just ideal conditions

**Cross-checks:**

- Every FR-* has corresponding code — no requirements were skipped
- Every NFR-* has corresponding enforcement — no hand-waving
- No code was written that doesn't map to a requirement (scope creep check)
- Out of Scope items from the spec were NOT implemented

---

### Step 3: Acceptance Criteria Verification

For each acceptance criterion, locate or write the corresponding test. Use the Spec Implementation Review Checklist at `spec-build/references/review-checklist.md` sections 4B and 4C as the authoritative guide.

**For each criterion:**

1. Locate the corresponding test (unit, integration, or manual verification)
2. If no test exists: **write one** — verification requires evidence, "no test exists" is not a valid review outcome
3. Run the test
4. If test passes → upgrade marker to `[x]` in the spec
5. If test fails → note the failure, set marker to `[ ]`, document the issue

**Summary checks:**

- Count total criteria vs. verified `[x]` — report the ratio
- Flag any criteria still `[ ]` (not started or regressed)
- Flag any criteria that cannot be tested — document why and note as discrepancy
- Verify tests actually test the criterion, not just exercise the code path

**Code quality spot-check** per checklist section 4C:

- Error handling at appropriate boundaries
- No hardcoded values that should be configurable
- Functions short and single-purpose
- Nesting depth within limits
- No regressions in existing tests

---

### Step 4: Report & Spec Updates

#### Summary Report

Present a structured report:

```
## Spec Implementation Review

**Spec:** [feature name] ([spec file path])
**Date:** YYYY-MM-DD
**Reviewer:** /spec-review

### Requirement Coverage
- Functional: N/M addressed
- Non-Functional: N/M addressed
- Gaps: [list or "None"]

### Acceptance Criteria
- [x] Verified: N
- [~] Implemented, pending: N
- [ ] Not started / regressed: N
- Failures: [list or "None"]

### Code Quality
- Issues found: [list or "None"]
- Regressions: [list or "None"]

### Spec Consistency
- Key Files updates needed: [list or "None"]
- Discrepancies: [list or "None"]

### Recommendation
[ ] All clear — run `/spec-update` to close the loop
[ ] Fix issues first: [specific list]
[ ] Requires user input: [specific questions]
```

#### Spec Edits

Apply limited edits to the spec file:

1. **Acceptance criteria markers** — update based on test results:
   - Passed tests: upgrade `[ ]` or `[~]` → `[x]`
   - Failed tests: downgrade `[x]` → `[ ]` (regression), keep `[ ]` or `[~]` as-is
2. **Discrepancies** — add entries for any gaps found between spec and implementation
3. **Key Files** — update paths if files moved, were deleted, or new files were created
4. **Last Updated** — set to today's date

Do NOT modify `**Status:**` or `## Implementation Notes` — those are `/spec-update`'s responsibility.

#### Next Action

Based on the review outcome, recommend:

- **All clear**: "Run `/spec-update` to close the loop and mark the spec as implemented."
- **Issues found**: "Fix the issues listed above, then re-run `/spec-review` to verify."
- **User input needed**: Present specific questions and wait for direction.

---

## Ambiguity Policy

- If `$ARGUMENTS` matches multiple specs, list them and ask which to review.
- If a spec has no acceptance criteria, warn and offer to review requirements only.
- If Key Files reference paths that don't exist, flag them as stale in the report and update the spec's Key Files section.
- If the spec has no requirements section, warn that there's nothing to audit against and suggest running `/spec-new` or `/spec-update` to add requirements.
- If all criteria are already `[x]`, still run the full review — regressions happen.

---

## Anti-Patterns

- **Skipping test verification**: Marking criteria as `[x]` without running actual tests. Every `[x]` must be backed by a passing test or confirmed behavior.
- **Reviewing without reading code**: The review must read the implementation files, not just check metadata. That's what `/spec-check` is for.
- **Modifying implementation**: `/spec-review` is a review, not a fix. Report issues; don't fix them. The user decides what to do next.
- **Changing spec status**: `/spec-review` records findings. `/spec-update` changes status. Respect the boundary.
