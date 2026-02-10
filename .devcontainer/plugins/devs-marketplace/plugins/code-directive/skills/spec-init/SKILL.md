---
name: spec-init
description: >-
  This skill should be used when the user asks to "initialize specs",
  "set up specs", "bootstrap specs", "start using specs", "create spec
  directory", "init specs for this project", or needs to set up the
  .specs/ directory structure for a project that doesn't have one yet.
version: 0.1.0
---

# Initialize Specification Directory

## Mental Model

Before any spec can be created, the project needs a `.specs/` directory with its supporting files: a ROADMAP (what each version delivers) and a BACKLOG (deferred items). This skill bootstraps that structure so `/spec-new` has a home.

---

## Workflow

### Step 1: Check Existing State

```
Glob: .specs/**/*.md
```

**If `.specs/` already exists:**
- Report current state: how many specs, versions, whether ROADMAP.md and BACKLOG.md exist
- Suggest `/spec-check` to audit health instead
- Do NOT recreate or overwrite anything
- Stop here

**If `.specs/` does not exist:** proceed to Step 2.

### Step 2: Create Directory Structure

Create the `.specs/` directory at the project root.

### Step 3: Create ROADMAP.md

Write `.specs/ROADMAP.md` using the template from `references/roadmap-template.md`.

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
- `.specs/ROADMAP.md` — version tracking table
- `.specs/BACKLOG.md` — deferred items list

Next steps:
- Use `/spec-new <feature-name> <version>` to create your first feature spec
- Use `/spec-check` to audit spec health at any time
```

---

## Hard Constraints

- **Never overwrite** an existing `.specs/` directory or its contents.
- **ROADMAP.md** must stay under 30 lines (it's a summary, not a plan document).
- **BACKLOG.md** must stay under 15 lines (it grows as items are added).
- Templates are starting points — the user will extend them.

---

## Ambiguity Policy

- If the user runs this in a workspace root with multiple projects, ask which project to initialize.
- If `.specs/` exists but is missing ROADMAP.md or BACKLOG.md, offer to create only the missing files.

---

## Reference Files

| File | Contents |
|------|----------|
| `references/roadmap-template.md` | Starter ROADMAP with version table format |
| `references/backlog-template.md` | Starter BACKLOG with item format |
