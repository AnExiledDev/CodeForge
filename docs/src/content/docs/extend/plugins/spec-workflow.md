---
title: Spec Workflow
description: Directory-based specification packages for AI-first development — create specs, build from specs, and track spec health with 3 commands.
sidebar:
  order: 4
---

The spec workflow plugin enforces a specification-driven development process optimized for AI-first development with large context windows and parallel agent teams. Every non-trivial feature gets a spec package before implementation begins, and every implementation ends with automated closure that documents what was actually built.

Most users should start with the user-facing [Spec Workflow](/use/spec-workflow/) guide and come here only for internals.

## Why Spec Packages?

Specs have two audiences with fundamentally different needs:
- **Humans** need to review decisions and confirm scope (~2 minutes)
- **AI agents** need complete implementation detail (invariants, schema, examples)

Spec packages separate these concerns. The human reads `index.md` (~50-80 lines). The AI reads everything else. No one wastes time on content meant for the other audience.

## The Three Commands

The entire spec lifecycle uses three commands:

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/spec <feature>` | Create, refine, and approve a spec package | Starting any non-trivial feature |
| `/build <feature>` | Implement from spec — plan, build, review, close | When spec is approved and ready |
| `/specs` | Health dashboard across all specs | Anytime — check project health |

### `/spec` — Create & Refine

Creates a directory-based spec package. The AI analyzes your codebase, drafts everything, and presents only the decisions that need human input.

```
/spec webhook-delivery
```

The AI will:
1. Analyze your codebase for patterns and context
2. Create `.specs/integrations/webhook-delivery/` with all files
3. Present decisions that need your input (genuine trade-offs only)
4. Make obvious decisions itself (you can override any)
5. Show the AC list for completeness checking
6. Finalize and approve on your confirmation

**First-time use?** `/spec` auto-creates `.specs/` with a Constitution template and Backlog. No separate setup needed.

**Constitution?** Run `/spec constitution` to capture project-level decisions (tech stack, patterns, conventions) that every spec inherits.

### `/build` — Implement & Close

Takes an approved spec and builds everything autonomously:

```
/build webhook-delivery
```

Five phases, zero human intervention:
1. **Discovery** — reads Constitution + spec package, verifies approval
2. **Planning** — decomposes groups into tasks, recommends team or solo
3. **Building** — spec-first testing, implements each AC, marks `[~]`
4. **Review** — self-healing fix loop (finds issues, fixes them, re-tests), marks `[x]`
5. **Closure** — generates Completion Summary Report, updates spec status

The Summary Report shows: AC results, AI decisions made, concerns, and discrepancies. That's your review surface.

### `/specs` — Dashboard

Quick health check across all specs:

```
/specs
```

Shows specs by status, flags stale specs, lists draft specs awaiting approval, and surfaces unresolved AI decisions.

## Spec Package Structure

Every spec is a directory:

```
.specs/integrations/webhook-delivery/
  index.md              # Human entry point (~50-80 lines)
  context.md            # AI-facing shared context
  groups/
    a-registration.md   # AC group with frontmatter
    b-delivery.md       # AC group with frontmatter
    c-retry.md
    d-logs.md
```

### `index.md` — Human Review Surface

The ONLY file humans need to read. Contains:
- **Intent** — what and why (2-3 sentences)
- **Decisions — Needs Your Input** — genuine trade-offs for human judgment
- **Decisions — Already Decided** — obvious choices the AI made (overridable)
- **AC Summary** — one-liner per criterion (completeness check)
- **Out of Scope** — explicit non-goals

### `context.md` — AI Context

Read by every implementing agent. Contains:
- **Invariants** — always-true assertions
- **Anti-Patterns** — "do NOT" examples preventing specification gaming
- **Integration Context** — dependency details inline
- **Schema Intent** — data model design (not DDL)
- **Constraints** — file paths, patterns, prohibitions

### Group Files — Work Units

Each group file has YAML frontmatter driving parallel decomposition:

```yaml
---
group: A
name: Registration & Configuration
criteria: [AC-1, AC-2, AC-3]
status: pending
owner: null
depends_on: []
files_owned:
  - src/models/webhook.py
  - src/schemas/webhook.py
---
```

Followed by full acceptance criteria with EARS patterns, Given/When/Then, and inline examples.

## The Constitution

`.specs/CONSTITUTION.md` captures project-level decisions:
- Tech stack and frameworks
- Architecture and file structure
- API conventions (error format, pagination, versioning)
- Auth and security patterns
- Testing conventions
- Code patterns and naming
- Boundaries (always do / never do)

`/build` reads the Constitution before any feature spec. Feature specs inherit these decisions — they don't repeat them.

## Acceptance Criteria Markers

| Marker | Meaning | Set By |
|--------|---------|--------|
| `[ ]` | Not started | `/spec` |
| `[~]` | Implemented, not yet verified | `/build` Phase 3 |
| `[x]` | Verified — tests pass | `/build` Phase 4 |

## AI Decisions

During `/build`, when the AI encounters a decision not in the spec or Constitution:
1. Makes its best choice
2. Records it in the group file's AI Decisions table
3. Continues building (does NOT stop)
4. Summary Report presents all decisions
5. You approve, override, or promote to Constitution

## The Spec Reminder Hook

A `Stop` hook fires when code was modified but specs weren't updated. It's advisory — reminds you to close the loop with `/build` or `/spec`.

## A Practical Example

```
1. /spec webhook-delivery
   → Creates .specs/integrations/webhook-delivery/
   → AI presents 3 trade-off decisions + AC list
   → You make decisions, confirm scope → approved

2. /build webhook-delivery
   → Reads Constitution + spec package
   → Decomposes into 4 parallel groups
   → Builds, tests, reviews, fixes issues
   → Generates Summary Report with 15/15 ACs verified
   → Presents 2 AI decisions for your review

3. Done. Smoke test the feature. Review AI decisions.
```

## Related

- [Agent System](./agent-system/) — specialist agents support parallel spec builds
- [Ticket Workflow](./ticket-workflow/) — tickets complement specs with issue tracking
- [Hooks](/customize/hooks/) — how the spec-reminder hook integrates
