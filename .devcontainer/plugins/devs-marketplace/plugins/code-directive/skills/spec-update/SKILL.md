---
name: spec-update
description: >-
  This skill should be used when the user asks to "update the spec",
  "mark spec as implemented", "as-built update", "spec maintenance",
  "update spec status", "finish the spec", or after implementing a
  feature when the spec needs to reflect what was actually built.
version: 0.1.0
---

# As-Built Spec Update

## Mental Model

Specs that say "planned" after code ships cause the next AI session to re-plan already-done work. The as-built update is the final step of every implementation — it closes the loop between what was planned and what was built.

This is not optional. Every implementation ends with a spec update.

---

## The 6-Step Workflow

### Step 1: Find the Spec

```
Glob: .specs/**/*.md
```

Search for the feature name in spec file names and content. If the user provides a spec path or feature name as `$ARGUMENTS`, use that directly.

If no spec exists:
- For substantial changes: create one using `/spec-new`
- For trivial changes (bug fixes, config): note "spec not needed" and stop

### Step 2: Set Status

Update the `**Status:**` field:
- `implemented` — all acceptance criteria are met
- `partial` — some criteria met, work ongoing or deferred

Never leave status as `planned` after implementation work has been done.

### Step 3: Check Off Acceptance Criteria

Review each acceptance criterion in the spec:
- Mark as `[x]` if the criterion is met and verified (tests pass, behavior confirmed)
- Leave as `[ ]` if not yet implemented
- Add a note next to deferred criteria explaining why

If criteria were met through different means than originally planned, note the deviation.

### Step 4: Add Implementation Notes

In the `## Implementation Notes` section, document:
- **Deviations from the original spec** — what changed and why
- **Key design decisions made during implementation** — choices that weren't in the spec
- **Surprising findings** — edge cases discovered, performance characteristics, limitations
- **Trade-offs accepted** — what was sacrificed and why

Keep notes concise. Reference file paths, not code.

### Step 5: Update File Paths

In the `## Key Files` section:
- Add files that were created during implementation
- Remove files that no longer exist
- Update paths that moved

Verify paths exist before listing them. Use absolute project-relative paths.

### Step 6: Update Metadata

- Set `**Last Updated:**` to today's date (YYYY-MM-DD)
- Verify `**Version:**` is correct

---

## Handling Edge Cases

### Spec Already "Implemented"

If the spec is already marked `implemented` and new changes affect the feature:
1. Check if acceptance criteria still hold
2. Update Implementation Notes with the new changes
3. Add any new Discrepancies between spec and current code
4. Update Last Updated date

### No Spec Exists

If there is no spec for the feature:
1. Ask: is this a substantial feature or a minor fix?
2. For substantial features: create one with `/spec-new`, then update it
3. For minor fixes: no spec needed — report this and stop

### Spec Has Unresolved Discrepancies

If the `## Discrepancies` section has open items:
1. Check if the current implementation resolves any of them
2. Remove resolved discrepancies
3. Add any new discrepancies discovered

---

## Validation Checklist

Before finishing the update:
- [ ] Status reflects the actual implementation state
- [ ] All implemented acceptance criteria are checked off
- [ ] Implementation Notes document deviations from original spec
- [ ] File paths in Key Files are accurate and verified
- [ ] Last Updated date is today
- [ ] Spec is still ≤200 lines
- [ ] No source code was pasted inline (references only)

---

## Ambiguity Policy

- If unclear which spec to update, list all candidates and ask the user.
- If the implementation deviated significantly from the spec, document it
  honestly in Implementation Notes — do not retroactively change the original
  requirements to match what was built.
- If acceptance criteria are ambiguous about whether they're met, note the
  ambiguity in Discrepancies rather than checking them off optimistically.
