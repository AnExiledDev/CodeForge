---
name: migration-patterns
description: >-
  This skill should be used when the user asks to "migrate from X to Y",
  "upgrade to version N", "bump Python version", "upgrade pydantic",
  "migrate express to fastify", "framework migration", "version upgrade",
  "modernize the codebase", or discusses code migration, framework upgrades,
  API version bumps, or dependency migration strategies.
version: 0.1.0
---

# Migration Patterns

## Mental Model

Migrations are a sequence of **small, verifiable, rollback-safe transformations**. Each step must independently compile, pass tests, and leave the system in a valid state. The moment you batch changes or skip verification, you create a state that is harder to debug than the original problem.

**Key principles:**
- **One thing at a time.** Each migration step changes one category of code (imports, API calls, configuration, types). Mixing categories makes failures hard to isolate.
- **Verify after every step.** Build → Test → Lint after each transformation. A broken intermediate state that goes undetected compounds into an undebuggable mess.
- **Rollback is always an option.** Git checkpoints after each successful step. If step N fails, you can revert to step N-1 cleanly.
- **Import mapping first.** Most framework migrations change import paths. Map all imports before modifying call sites — this gives you a complete inventory of affected code.
- **Official guides are the source of truth.** Always fetch and read the official migration guide before planning. Community blog posts may be outdated or incomplete.

---

## Migration Planning Framework

Follow this sequence for every migration:

### 1. Assess Current State

- Read manifest files to identify current version and all dependencies.
- Use `Glob` and `Grep` to inventory usage of the APIs being migrated.
- Count occurrences of each deprecated pattern to estimate effort.

### 2. Read Official Guides

- Use `WebFetch` to pull the official migration guide, changelog, and breaking changes list.
- Note every breaking change that applies to the project.
- Identify changes with no direct replacement — these need special handling.

### 3. Inventory Affected Files

- Map every file that uses a deprecated API or pattern.
- Group files by change type (imports, API calls, configuration, types).
- Count total changes per group to estimate per-step effort.

### 4. Order Steps

Sequence changes so each step is independently buildable:

1. **Configuration** — Manifest files, build configs, tool configs
2. **Core utilities and shared modules** — Changes here propagate to dependents
3. **Business logic** — Module by module, starting with lowest dependency count
4. **Route handlers / controllers** — Often the most numerous changes
5. **Tests** — Updated last to match migrated source

### 5. Risk Assessment

Flag high-risk changes:
- Behavioral changes (same API, different default behavior)
- Removed APIs with no direct replacement
- Database schema changes
- Serialization format changes (affects stored data)

### 6. Present Plan

Output numbered steps with:
- File count per step
- Risk level (low / medium / high)
- Verification command
- Rollback command

---

## Step Verification Protocol

After each migration step, run these checks in order:

| Check | Command Examples | Purpose |
|-------|-----------------|---------|
| **Syntax** | `python -m py_compile`, `npx tsc --noEmit`, `node --check` | Code parses correctly |
| **Build** | `npm run build`, `cargo build`, `go build ./...` | Project compiles |
| **Tests** | `pytest`, `npm test`, `cargo test`, `go test ./...` | Behavior preserved |
| **Lint** | `ruff check`, `npm run lint`, `cargo clippy` | Style and correctness |

If any check fails:
1. Identify which change in this step caused the failure.
2. Fix within the current step — do not proceed to the next.
3. If the fix is unclear, report the failure with full error output.
4. Never fix forward by making changes intended for later steps.

---

## Rollback Strategy

- **Before starting**: Verify the user has committed or stashed current work.
- **After each step**: Suggest a commit checkpoint: "Step N complete — recommend committing now."
- **On failure**: Provide exact `git checkout -- <files>` commands to revert to the last good state.
- **Database migrations**: Always plan the down-migration alongside the up-migration.
- **Feature flags**: For gradual migrations, consider feature flags to run old and new code paths in parallel.

---

## Import-First Strategy

Most framework migrations change import paths. Map imports before modifying call sites:

1. **Inventory**: `Grep` for all imports from the old framework/library.
2. **Map**: Create a mapping of old import → new import.
3. **Transform**: Change all imports in a single step.
4. **Verify**: Build and test after import changes (some imports may have side effects).
5. **Proceed**: With imports correct, modify call sites knowing the right modules are loaded.

This approach gives you a complete inventory of affected code before making any behavioral changes.

---

## Common Pitfalls

| Pitfall | Why It Fails | Prevention |
|---------|-------------|------------|
| Batching all changes | One failure breaks everything; can't isolate cause | One category per step |
| Skipping verification | Errors compound silently | Build + test after every step |
| Fixing forward | New changes mask existing failures | Fix in current step or revert |
| Ignoring transitive deps | A dependency may not support the target version | Check compatibility first |
| Mixing migration with refactoring | Two concerns, double the failure modes | Migrate first, refactor later |
| Not reading the migration guide | Miss non-obvious behavioral changes | Official guide before planning |

---

## Ambiguity Policy

| Ambiguity | Default |
|-----------|---------|
| **Verification depth** | Full suite: build + test + lint after every step |
| **Step granularity** | One file category per step (imports, then API calls, then config) |
| **Unknown migration path** | Fetch docs, analyze both APIs, present mapping for review |
| **Partial migration requested** | Warn about inconsistency; verify the module's own tests pass |
| **Target version not specified** | Migrate to the latest stable release |

---

## Reference Files

| File | Contents |
|------|----------|
| [Python Migrations](references/python-migrations.md) | Python version upgrades (3.8→3.12), Pydantic v1→v2 API mapping, Django and SQLAlchemy migration patterns |
| [JavaScript Migrations](references/javascript-migrations.md) | Express→Fastify mapping, React upgrade patterns, TypeScript version upgrades, CommonJS→ESM migration |
