---
title: Spec Workflow
description: The specification workflow plugin manages the full lifecycle of feature specifications — from creation through implementation to as-built closure.
sidebar:
  order: 4
---

The spec workflow plugin enforces a specification-driven development process. Every non-trivial feature gets a spec before implementation begins, and every implementation ends with an as-built spec update that documents what was actually built. This creates a reliable loop: plan the work, do the work, record what happened.

Why does this matter? Specs force you to think through edge cases, acceptance criteria, and scope boundaries while changes are cheap — before any code exists. The as-built closure step catches drift between what was planned and what was delivered. Together, they give you a living record of every feature in your project.

## The Specification Lifecycle

The spec workflow follows a clear seven-stage lifecycle. Each stage has a dedicated slash command, and each stage feeds into the next:

```
/spec-init  -->  /spec-new  -->  /spec-refine  -->  /spec-build  -->  /spec-review  -->  /spec-update
   |               |                |                   |                 |                  |
Bootstrap      Create a         Validate           Implement         Verify code       Close the
.specs/        draft spec       assumptions        the feature       vs. spec          loop

                                              /spec-check (audit health — runs independently)
```

### Stage 1: Initialize (`/spec-init`)

Bootstrap the `.specs/` directory at your project root. This creates the directory structure, `MILESTONES.md` for tracking releases, and `BACKLOG.md` for capturing deferred work. You only run this once per project.

### Stage 2: Create (`/spec-new`)

Create a new feature specification from the standard template. The command infers a domain folder from the feature name (e.g., `auth/`, `search/`, `api/`) and generates a structured Markdown file with sections for intent, acceptance criteria, requirements, dependencies, and scope boundaries.

New specs always start with:
- **Status:** `planned`
- **Approval:** `draft`
- All requirements tagged `[assumed]`

This is intentional. Draft specs contain unvalidated assumptions — they should not be implemented until those assumptions are confirmed.

### Stage 3: Refine (`/spec-refine`)

Walk through every `[assumed]` requirement with the user, validating tech decisions and scope boundaries. As each requirement is confirmed, it upgrades from `[assumed]` to `[user-approved]`. The spec's approval status changes to `user-approved` only after all requirements pass review.

:::caution[Do Not Skip Refinement]
The `/spec-build` command enforces a hard gate: it refuses to implement any spec that is not `user-approved`. Building against draft specs with unvalidated assumptions risks wasted work. Always refine first.
:::

### Stage 4: Build (`/spec-build`)

The most powerful command in the workflow. It orchestrates the full implementation lifecycle in five phases:

1. **Discovery and Gate Check** — reads the spec, verifies approval status, builds context from key files
2. **Implementation Planning** — creates a structured plan mapping requirements to file changes, enters plan mode for user approval
3. **Implementation** — executes the plan step by step, flipping acceptance criteria from `[ ]` to `[~]` as each is addressed
4. **Comprehensive Review** — audits every requirement, verifies acceptance criteria with tests, checks code quality and spec consistency
5. **Spec Closure** — updates status, adds implementation notes, documents discrepancies

Because Phase 5 performs full as-built closure, you do not need a separate `/spec-update` run after using `/spec-build`.

:::tip[Team Spawning for Complex Specs]
When a spec has 8+ requirements or spans multiple layers (backend, frontend, tests), `/spec-build` automatically recommends spawning a team of specialist agents. A researcher explores patterns, a test-writer creates tests in a worktree, and a doc-writer updates documentation — all working in parallel.
:::

### Stage 5: Review (`/spec-review`)

Standalone implementation verification. Use this after manual implementation, for post-change regression checks, or during pre-release audits. It reads the code, verifies every requirement and acceptance criterion against the implementation, and recommends `/spec-update` when done.

### Stage 6: Update (`/spec-update`)

Close the as-built loop. Updates the spec to reflect what was actually built — sets status, checks off acceptance criteria, adds implementation notes for deviations, and updates file paths. Use this after manual implementation or when the spec-reminder hook nudges you.

### Stage 7: Check (`/spec-check`)

Audit spec health across the project. Run this before starting a new milestone to ensure all specs are current, acceptance criteria are complete, and no specs have gone stale.

## Slash Commands Reference

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/spec-init` | Bootstrap `.specs/` directory | Once per project, at project start |
| `/spec-new <feature>` | Create a new feature spec | Starting any non-trivial feature |
| `/spec-refine <feature>` | Validate and approve requirements | After creating a draft spec, before implementation |
| `/spec-build <feature>` | Full implementation from spec | When the spec is approved and ready to build |
| `/spec-review <feature>` | Verify implementation vs. spec | After manual implementation or for regression checks |
| `/spec-update` | As-built closure | After implementation (if not using `/spec-build`) |
| `/spec-check` | Health audit of all specs | Before milestones, during planning |

## Directory Convention

Specs live in `.specs/` at the project root, organized by domain. Each domain gets its own folder, and each feature gets its own Markdown file within that folder.

```
.specs/
├── MILESTONES.md          # Milestone tracker linking to feature specs
├── BACKLOG.md             # Deferred items not yet scheduled
├── auth/                  # Domain folder
│   ├── login-flow.md      # Feature spec
│   └── oauth-providers.md # Feature spec
├── search/                # Domain folder
│   └── full-text-search.md
└── onboarding/
    └── user-signup.md
```

Only `MILESTONES.md` and `BACKLOG.md` live at the `.specs/` root. Everything else goes in domain subfolders.

:::note[Spec Sizing]
Aim for roughly 200 lines per spec. If a feature needs significantly more, split it into separate specs in the domain folder. Completeness matters more than hitting a number, but very long specs are hard to load and review.
:::

## The Approval Workflow

The approval workflow prevents premature implementation. Here is how a spec progresses from idea to approved contract:

**1. Draft with assumptions** — When you create a spec with `/spec-new`, every requirement is tagged `[assumed]`. This signals that the requirement reflects the spec author's best guess, not confirmed user intent.

```markdown
## Requirements
- FR-1: The system shall send email notifications on order completion. [assumed]
- FR-2: WHEN a notification fails, the system shall retry 3 times. [assumed]
- NFR-1: Notification latency shall not exceed 5 seconds. [assumed]
```

**2. Refinement** — Running `/spec-refine` walks through each `[assumed]` requirement interactively. You confirm, modify, or reject each one. Confirmed requirements upgrade to `[user-approved]`.

```markdown
## Requirements
- FR-1: The system shall send email notifications on order completion. [user-approved]
- FR-2: WHEN a notification fails, the system shall retry 3 times with exponential backoff. [user-approved]
- NFR-1: Notification latency shall not exceed 10 seconds. [user-approved]
```

**3. Gate check** — `/spec-build` verifies `**Approval:** user-approved` before proceeding. If any requirements remain `[assumed]`, the gate check fails and implementation is blocked.

## Acceptance Criteria Markers

During implementation, acceptance criteria use three states that track progress from "not started" through "implemented" to "verified":

| Marker | Meaning | Set By |
|--------|---------|--------|
| `[ ]` | Not started — criterion has not been addressed in code | `/spec-new` (initial state) |
| `[~]` | Implemented, not yet verified — code is written but tests are not confirmed | `/spec-build` Phase 3 |
| `[x]` | Verified — tests pass, behavior confirmed | `/spec-build` Phase 4 |

This three-state system prevents false confidence. A criterion marked `[~]` means "someone wrote code for this but nobody has verified it works." Only after a test passes (or behavior is confirmed) does it graduate to `[x]`.

If `/spec-update` runs after manual implementation, any `[~]` markers that were never verified revert to `[ ]`.

## The Spec Reminder Hook

The plugin includes a `spec-reminder.py` hook that fires on the `Stop` event. When Claude finishes a turn, the hook checks two conditions:

1. Were source code files modified? (files in `src/`, `lib/`, `app/`, `tests/`, `api/`, and other standard code directories)
2. Were any `.specs/` files also modified?

If code changed but specs did not, the hook injects a reminder:

> *[Spec Reminder] Code was modified in src/, tests/ but no specs were updated. Use /spec-review to verify implementation against the spec, then /spec-update to close the loop. Use /spec-new if no spec exists for this feature, or /spec-refine if the spec is still in draft status.*

This ensures the as-built loop is always closed. The reminder only fires when a `.specs/` directory exists (meaning the project uses the spec system).

:::note[The Reminder Is Advisory]
The spec reminder blocks the turn to surface the message, but it is not destructive. It gives you the opportunity to update specs before moving on. You can address it immediately or note it for later.
:::

## A Practical Example

Here is a typical workflow for implementing a "user notification preferences" feature:

```
1. /spec-new notification-preferences
   → Creates .specs/notifications/notification-preferences.md
   → Status: planned, Approval: draft
   → All requirements tagged [assumed]

2. /spec-refine notification-preferences
   → Walks through each requirement interactively
   → User confirms email preferences, rejects SMS for now
   → Requirements upgrade to [user-approved]
   → Approval: user-approved

3. /spec-build notification-preferences
   → Phase 1: Reads spec, verifies approval, explores key files
   → Phase 2: Creates implementation plan, gets user approval
   → Phase 3: Implements step by step, flips [ ] to [~]
   → Phase 4: Runs tests, verifies criteria, upgrades [~] to [x]
   → Phase 5: Updates spec status to "implemented"

4. Done! Spec reflects what was actually built.
```

## Spec Template

Every spec follows a standard structure. Here are the key sections:

```markdown
# Feature: [Name]
**Domain:** [domain-name]
**Status:** implemented | partial | planned
**Last Updated:** YYYY-MM-DD
**Approval:** draft | user-approved

## Intent
## Acceptance Criteria
## Key Files
## Schema / Data Model (reference file paths only)
## API Endpoints (Method | Path | Description)
## Requirements (EARS format: FR-1, NFR-1)
## Dependencies
## Out of Scope
## Resolved Questions
## Implementation Notes (post-implementation only)
## Discrepancies (spec vs reality gaps)
```

Requirements use the EARS (Easy Approach to Requirements Syntax) format with five patterns: Ubiquitous, Event-Driven, State-Driven, Unwanted Behavior, and Optional Feature. The `specification-writing` skill provides detailed guidance and templates for EARS format.

## Related

- [Specification Writing Skill](../features/skills/) — EARS format guidance and spec templates
- [Agent System](./agent-system/) — the spec-writer and architect agents support spec creation
- [Ticket Workflow](./ticket-workflow/) — tickets complement specs with issue tracking
- [Hooks](../customization/hooks/) — how the spec-reminder hook integrates
- [Commands Reference](../reference/commands/) — full command reference
