---
name: spec-new
description: >-
  This skill should be used when the user asks to "create a spec",
  "new feature spec", "write a spec for", "spec this feature",
  "start a new spec", "plan a feature", or needs to create a new
  specification file from the standard template.
version: 0.1.0
---

# Create New Feature Specification

## Mental Model

A specification is a contract between the person requesting a feature and the person building it. Writing the spec BEFORE implementation forces you to think through edge cases, acceptance criteria, and scope boundaries while changes are cheap — before any code exists.

Every project uses `.specs/` as the specification directory. Specs are version-organized, independently loadable, and capped at 200 lines.

---

## Workflow

### Step 1: Parse Arguments

Extract the feature name and version from `$ARGUMENTS`:
- **Feature name**: kebab-case identifier (e.g., `session-history`, `auth-flow`)
- **Version**: semver string (e.g., `v0.3.0`)

If arguments are missing, ask the user for:
1. Feature name (what is being built)
2. Target version (which release this belongs to)

### Step 2: Determine File Path

- **Multi-feature version** (directory already exists or multiple features planned):
  `.specs/{version}/{feature-name}.md`
- **Single-feature version** (one spec covers the whole version):
  `.specs/{version}.md`

If `.specs/` does not exist at the project root, create it.

If `.specs/{version}/` does not exist and you're using the directory form, create it.

### Step 3: Create the Spec File

Write the file using the standard template from `references/template.md`.

Pre-fill:
- **Version**: from arguments
- **Status**: `planned`
- **Last Updated**: today's date (YYYY-MM-DD)
- **Feature name**: from arguments

Leave all other sections as placeholders for the user to fill.

### Step 4: Guide Content Creation

After creating the file, guide the user through filling it out:

1. **Intent** — What problem does this solve? Who has this problem? (2-3 sentences)
2. **Acceptance Criteria** — Use the `specification-writing` skill for EARS format and Given/When/Then patterns
3. **Key Files** — Glob the codebase to identify existing files relevant to this feature
4. **Schema / Data Model** — Reference file paths only, never inline schemas
5. **API Endpoints** — Table format: Method | Path | Description
6. **Requirements** — EARS format, numbered FR-1, FR-2, NFR-1, etc.
7. **Dependencies** — What this feature depends on
8. **Out of Scope** — Explicit non-goals to prevent scope creep

### Step 5: Validate

Before finishing:
- [ ] File is ≤200 lines
- [ ] No source code, SQL, or type definitions reproduced inline
- [ ] Status is `planned`
- [ ] All required sections present (even if some are "N/A" or "TBD")
- [ ] Acceptance criteria are testable

---

## Hard Constraints

- **≤200 lines per spec.** If a feature needs more, split into sub-specs with a parent `_overview.md` (≤50 lines) linking them.
- **Reference, don't reproduce.** Write `see src/engine/db/migrations/002.sql lines 48-70` — never paste the SQL.
- **Independently loadable.** Each spec file must be useful without loading any other file.
- **EARS format for requirements.** Use the `specification-writing` skill for templates and examples.

---

## Ambiguity Policy

- If the user doesn't specify a version, ask — do not assume.
- If the feature scope is unclear, write a minimal spec with `## Open Questions` listing what needs clarification.
- If a spec already exists for this feature, inform the user and suggest `/spec-update` instead.

---

## Reference Files

| File | Contents |
|------|----------|
| `references/template.md` | Full standard template with field descriptions and examples |
