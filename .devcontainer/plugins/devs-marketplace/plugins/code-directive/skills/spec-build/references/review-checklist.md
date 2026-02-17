# Spec Implementation Review Checklist

Comprehensive checklist for spec implementation reviews. Used by `/spec-build` Phase 4 and `/spec-review`. Walk through every section methodically. Do not skip sections — each catches different categories of issues.

---

## 4A: Requirement Coverage Audit

For each FR-* requirement in the spec:

- [ ] Identify the file(s) and function(s) that implement this requirement
- [ ] Verify the implementation matches the EARS-format requirement text
- [ ] Confirm the requirement is fully addressed (not partially)
- [ ] Note if the requirement was met through a different approach than planned

For each NFR-* requirement in the spec:

- [ ] Identify how the non-functional requirement is enforced (e.g., timeout config, index, validation)
- [ ] Verify measurable NFRs have been tested or measured (response time, throughput, size limits)
- [ ] Confirm the NFR is met under expected conditions, not just ideal conditions

Cross-checks:

- [ ] Every FR-* has corresponding code — no requirements were skipped
- [ ] Every NFR-* has corresponding enforcement — no hand-waving
- [ ] No code was written that doesn't map to a requirement (scope creep check)
- [ ] Out of Scope items from the spec were NOT implemented

---

## 4B: Acceptance Criteria Verification

For each criterion currently marked `[~]` (implemented, not yet verified):

- [ ] Locate the corresponding test (unit, integration, or manual verification)
- [ ] If no test exists: write one
- [ ] Run the test
- [ ] If test passes: upgrade `[~]` to `[x]` in the spec
- [ ] If test fails: note the failure, keep as `[~]`, document the issue

Summary checks:

- [ ] Count total criteria vs. verified `[x]` — report the ratio
- [ ] Any criteria still `[ ]` (not started)? Flag as missed
- [ ] Any criteria that cannot be tested? Document why and note as discrepancy
- [ ] Do the tests actually verify the criterion, or just exercise the code path?

---

## 4C: Code Quality Review

### Error Handling

- [ ] Errors are caught at appropriate boundaries (not swallowed, not over-caught)
- [ ] Error messages are informative (include context, not just "error occurred")
- [ ] External call failures (I/O, network, subprocess) have explicit handling
- [ ] No bare except/catch-all that hides real errors

### Code Structure

- [ ] Functions are short and single-purpose
- [ ] Nesting depth is within limits (2-3 for Python, 3-4 for other languages)
- [ ] No duplicated logic that should be extracted
- [ ] Names are descriptive (functions, variables, parameters)

### Hardcoded Values

- [ ] No magic numbers without explanation
- [ ] Configuration values that may change are externalized (not inline)
- [ ] File paths, URLs, and credentials are not hardcoded

### Test Quality

- [ ] New code has corresponding tests
- [ ] Tests verify behavior, not implementation details
- [ ] Tests cover happy path, error cases, and key edge cases
- [ ] No over-mocking that makes tests trivially pass
- [ ] Existing tests still pass (no regressions introduced)

### Dependencies

- [ ] New imports/dependencies are necessary (no unused imports)
- [ ] No circular dependencies introduced
- [ ] Third-party dependencies are justified (not added for trivial functionality)

---

## 4D: Spec Consistency Check

### Requirement-to-Implementation Fidelity

- [ ] Re-read each EARS requirement and compare against the actual implementation
- [ ] For "When [event], the system shall [action]" — does the code handle that event and perform that action?
- [ ] For "If [unwanted condition], the system shall [action]" — is the unwanted condition detected and handled?
- [ ] For ubiquitous requirements ("The system shall...") — is the behavior always active?

### Key Files Accuracy

- [ ] Every file in the spec's Key Files section still exists at that path
- [ ] New files created during implementation are listed in Key Files
- [ ] Deleted or moved files have been removed/updated in Key Files
- [ ] File descriptions in Key Files are still accurate

### Schema and API Consistency

- [ ] If the spec has a Schema/Data Model section, verify referenced files are current
- [ ] If the spec has API Endpoints, verify routes match the implementation
- [ ] Any new endpoints or schema changes are reflected in the spec

### Behavioral Alignment

- [ ] Edge cases discovered during implementation are documented
- [ ] Performance characteristics match NFR expectations
- [ ] Integration points work as the spec describes
- [ ] Default values and fallback behaviors match spec intent

---

## 4E: Summary Report Template

After completing sections 4A through 4D, compile findings into this format:

```
## Implementation Review Summary

**Spec:** [feature name] ([spec file path])
**Date:** YYYY-MM-DD

### Requirement Coverage
- Functional: N/M addressed
- Non-Functional: N/M addressed
- Gaps: [list or "None"]

### Acceptance Criteria
- [x] Verified: N
- [~] Implemented, pending verification: N
- [ ] Not started: N
- Failures: [list or "None"]

### Code Quality
- Issues found: [list or "None"]
- Regressions: [list or "None"]

### Spec Consistency
- Key Files updates needed: [list or "None"]
- Discrepancies: [list or "None"]

### Deviations from Plan
[list or "None"]

### Recommendation
[ ] Proceed to Phase 5 — all clear
[ ] Fix issues first: [specific list]
[ ] Requires user input: [specific questions]
```

---

## When to Fail the Review

The review should recommend "fix issues first" when:

- Any FR-* requirement has no corresponding implementation
- Any acceptance criterion test fails
- Existing tests regress (new code broke something)
- Code was written outside the spec's scope without user approval
- Critical error handling is missing (crashes on expected error conditions)

The review should recommend "proceed to Phase 5" when:

- All requirements have corresponding implementations
- All acceptance criteria are `[x]` (or `[~]` with documented reason)
- No test regressions
- Code quality is acceptable (no critical issues)
- Discrepancies are documented, not hidden
