---
title: Spec Workflow
description: User-facing guide to creating specs, building from them, and keeping feature documentation closed out as-built.
sidebar:
  order: 5
---

For non-trivial work, CodeForge is designed around a spec-first workflow.

## The Three Commands

| Command | Use It For |
|---------|------------|
| `/spec <feature>` | Create, refine, and approve a spec package |
| `/build <feature>` | Implement from an approved spec |
| `/specs` | Check spec health across the project |

## Recommended Flow

1. Start with `/spec <feature>`.
2. Review the generated spec summary and decisions.
3. Approve the spec.
4. Run `/build <feature>`.
5. Review the completion summary and any AI decisions.

## Why This Exists

Specs separate the human review surface from the AI implementation detail.

- Humans review the short `index.md` summary.
- AI agents use the full spec package, including context and group files.

That keeps the review path short without starving implementation of detail.

## What `/spec` Produces

Specs live in `.specs/` and typically include:

- `index.md` for human review
- `context.md` for AI-facing implementation context
- group files in `groups/` for acceptance criteria and decomposition

## What `/build` Does

`/build` reads the Constitution and the approved spec, plans the work, implements it, verifies it, and closes the loop with a completion summary.

## When to Use It

Use the spec workflow when the change is:

- multi-file
- design-sensitive
- collaborative
- large enough that you want explicit acceptance criteria

## Related

- [Ticket Workflow](./ticket-workflow/)
- [Spec Workflow Plugin](/extend/plugins/spec-workflow/)
- [Commands Reference](/reference/commands/)
