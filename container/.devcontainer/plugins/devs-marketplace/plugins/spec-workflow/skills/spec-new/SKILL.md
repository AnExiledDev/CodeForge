---
name: spec-new
description: >-
  Creates a new feature specification from the standard EARS template
  with domain inference, acceptance criteria, and requirement tagging.
  USE WHEN the user asks to "create a spec", "new feature spec", "write
  a spec for", "spec this feature", "start a new spec", "plan a feature",
  "add a spec", or works with .specs/ directory and feature planning.
  DO NOT USE for updating existing specs after implementation — use
  spec-update instead. Not for refining draft specs — use spec-refine.
version: 0.2.0
argument-hint: "[feature-name] [domain]"
---

# Create New Feature Specification

## Mental Model

A specification is a contract between the person requesting a feature and the person building it. Writing the spec BEFORE implementation forces you to think through edge cases, acceptance criteria, and scope boundaries while changes are cheap — before any code exists.

Every project uses `.specs/` as the specification directory. Specs are domain-organized, independently loadable, and should aim for ~200 lines.

---

## Workflow

### Step 1: Parse Arguments

Extract the feature name from `$ARGUMENTS`:
- **Feature name**: kebab-case identifier (e.g., `session-history`, `auth-flow`)

If the feature name is missing, ask the user what they want to spec.

**Note:** Features should be pulled from the project's backlog (`BACKLOG.md`) into a milestone before creating a spec. If the feature isn't in the backlog yet, add it first, then assign it to a milestone.

### Step 2: Determine Domain and File Path

Analyze the feature name and description to infer an appropriate domain folder:
- Look at existing domain folders in `.specs/` for a natural fit
- Consider the feature's area: `auth`, `search`, `ui`, `api`, `onboarding`, etc.
- Present the inferred domain to the user for confirmation or override

The file path is always: `.specs/{domain}/{feature-name}.md`

If `.specs/` does not exist at the project root, create it.

If `.specs/{domain}/` does not exist, create it.

### Step 3: Create the Spec File

Write the file using the standard template from `references/template.md`.

Pre-fill:
- **Domain**: from the inferred/confirmed domain
- **Status**: `planned`
- **Last Updated**: today's date (YYYY-MM-DD)
- **Approval**: `draft`
- **Feature name**: from arguments

Leave all other sections as placeholders for the user to fill.

### Step 4: Guide Content Creation

After creating the file, guide the user through filling it out:

1. **Intent** — What problem does this solve? Who has this problem? (2-3 sentences)
2. **Acceptance Criteria** — Use the `specification-writing` skill for EARS format and Given/When/Then patterns
3. **Key Files** — Glob the codebase to identify existing files relevant to this feature
4. **Schema / Data Model** — Reference file paths only, never inline schemas
5. **API Endpoints** — Table format: Method | Path | Description
6. **Requirements** — EARS format, numbered FR-1, FR-2, NFR-1, etc. Tag all requirements `[assumed]` at creation time — they become `[user-approved]` only after explicit user validation via `/spec-refine`.
7. **Dependencies** — What this feature depends on
8. **Out of Scope** — Explicit non-goals to prevent scope creep
9. **Resolved Questions** — Leave empty at creation; populated by `/spec-refine`

### Step 5: Validate

Before finishing:
- [ ] If the file exceeds ~200 lines, consider splitting into separate specs in the domain folder
- [ ] No source code, SQL, or type definitions reproduced inline
- [ ] Status is `planned` and Approval is `draft`
- [ ] All required sections present (even if some are "N/A" or "TBD")
- [ ] Acceptance criteria are testable
- [ ] All requirements are tagged `[assumed]`

After validation, inform the user: **"This spec MUST go through `/spec-refine` before implementation begins.** All requirements are marked `[assumed]` until explicitly validated."

The `/spec-refine` skill walks through every `[assumed]` requirement with the user, validates tech decisions and scope boundaries, and upgrades approved items to `[user-approved]`. The spec's `**Approval:**` becomes `user-approved` only after all requirements pass review.

---

## Sizing Guidelines

- **Aim for ~200 lines per spec.** If a feature needs more, consider splitting into separate specs in the domain folder.
- **Reference, don't reproduce.** Write `see src/engine/db/migrations/002.sql lines 48-70` — never paste the SQL.
- **Independently loadable.** Each spec file must be useful without loading any other file.
- **EARS format for requirements.** Use the `specification-writing` skill for templates and examples.

---

## Ambiguity Policy

- If the user doesn't specify a domain, infer one from the feature name and existing `.specs/` structure, then confirm with the user.
- If the feature scope is unclear, write a minimal spec with `## Open Questions` listing what needs clarification.
- If a spec already exists for this feature, inform the user and suggest `/spec-update` instead.

---

## Reference Files

| File | Contents |
|------|----------|
| `references/template.md` | Full standard template with field descriptions and examples |
