---
title: Ticket Workflow
description: User-facing guide to linking GitHub issues into your Claude workflow, planning work, reviewing commits, and creating PRs.
sidebar:
  order: 6
---

The ticket workflow connects GitHub issues to your Claude sessions so you do not have to paste issue bodies around manually.

## Automatic Ticket Linking

If you mention `#123` or paste a GitHub issue URL in a prompt, CodeForge can fetch the issue context and inject it before Claude responds.

That means prompts like these work well:

- `Work on #42`
- `Fix the bug described in #108`
- `Review https://github.com/org/repo/issues/55`

## Main Commands

| Command | Use It For |
|---------|------------|
| `/ticket:new` | Create a structured GitHub issue |
| `/ticket:work` | Explore the codebase and produce an implementation plan |
| `/ticket:review-commit` | Review work against the ticket before committing |
| `/ticket:create-pr` | Create a PR and post review findings |

## Recommended Flow

1. Create or reference a ticket.
2. Run `/ticket:work` to produce a technical plan.
3. Implement the change.
4. Run `/ticket:review-commit` before committing.
5. Run `/ticket:create-pr` to open the PR and attach review output.

## Tickets vs Specs

Tickets are best for business-facing work tracking.
Specs are best for detailed technical planning and implementation contracts.

For complex work, using both together is often the strongest flow.

## Related

- [Spec Workflow](./spec-workflow/)
- [Git and PRs](./git-and-prs/)
- [Ticket Workflow Plugin](/extend/plugins/ticket-workflow/)
