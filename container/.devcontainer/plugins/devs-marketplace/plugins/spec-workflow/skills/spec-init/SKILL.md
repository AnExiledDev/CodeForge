---
name: spec-init
description: >-
  Bootstraps the .specs/ directory structure for a project, creating
  MILESTONES.md and BACKLOG.md from starter templates so spec-new has
  a home. USE WHEN the user asks to "initialize specs", "set up specs",
  "bootstrap specs", "start using specs", "create spec directory",
  "init specs for this project", "set up .specs", or works with first-
  time specification setup and project onboarding.
  DO NOT USE if .specs/ already exists — use spec-check to audit health
  or spec-new to add individual specs.
version: 0.2.0
---

# Initialize Specification Directory

## Mental Model

Before any spec can be created, the project needs a `.specs/` directory with its supporting files: a MILESTONES tracker (what each milestone delivers) and a BACKLOG (deferred items). This skill bootstraps that structure so `/spec-new` has a home.

---

## Workflow

### Step 1: Check Existing State

```
Glob: .specs/**/*.md
```

**If `.specs/` already exists:**
- Report current state: how many specs, domains, whether MILESTONES.md and BACKLOG.md exist
- Suggest `/spec-check` to audit health instead
- Do NOT recreate or overwrite anything
- Stop here

**If `.specs/` does not exist:** proceed to Step 2.

### Step 2: Create Directory Structure

Create the `.specs/` directory at the project root.

### Step 3: Create MILESTONES.md

Write `.specs/MILESTONES.md` using the template from `references/milestones-template.md`.

### Step 4: Create BACKLOG.md

Write `.specs/BACKLOG.md` using the template from `references/backlog-template.md`.

### Step 5: Retroactive Documentation

Ask the user:

> "Are there existing features in this project that should be documented retroactively? I can help create specs for them using `/spec-new`."

If yes, guide the user through creating a spec for each feature using `/spec-new`.

If no, proceed to Step 6.

### Step 6: Report

Summarize what was created:

```
## Spec Directory Initialized

Created:
- `.specs/` directory
- `.specs/MILESTONES.md` — milestone tracker
- `.specs/BACKLOG.md` — deferred items list

Next steps:
- Add features to `BACKLOG.md` with priority grades (P0–P3)
- Pull features into a milestone in `MILESTONES.md` when ready to scope
- Use `/spec-new <feature-name>` to create a spec (domain is inferred)
- Use `/spec-refine <feature-name>` to validate before implementation
- After implementing, use `/spec-review <feature-name>` to verify against the spec
- Then use `/spec-update` to close the loop
- Use `/spec-check` to audit spec health at any time
```

---

## Constraints

- **Never overwrite** an existing `.specs/` directory or its contents.
- Templates are starting points — the user will extend them as the project grows.

---

## Ambiguity Policy

- If the user runs this in a workspace root with multiple projects, ask which project to initialize.
- If `.specs/` exists but is missing MILESTONES.md or BACKLOG.md, offer to create only the missing files.

---

## Reference Files

| File | Contents |
|------|----------|
| `references/milestones-template.md` | Starter MILESTONES with milestone table format |
| `references/backlog-template.md` | Starter BACKLOG with item format |
