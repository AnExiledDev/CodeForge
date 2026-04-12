---
title: Git and PRs
description: User-facing guide to CodeForge's review, commit, push, and PR workflows.
sidebar:
  order: 7
---

CodeForge includes slash-command workflows for reviewing work before commit and reviewing pull requests before merge.

## Main Commands

| Command | Use It For |
|---------|------------|
| `/ship` | Review changes, draft a commit, push, and optionally create a PR |
| `/pr:review` | Review an existing PR and post findings |

## `/ship`

`/ship` is the main end-of-change workflow.

It:

1. gathers git context
2. reviews the changes for security, rules, quality, architecture, and tests
3. presents findings by severity
4. drafts a commit message for approval
5. commits and pushes
6. optionally creates a PR

## `/pr:review`

`/pr:review` performs a deeper review against an existing pull request. It is designed to post findings, not to approve or merge.

## When to Use Which

- Use `/ship` when you are finishing your own local work.
- Use `/pr:review` when a PR already exists and you want an aggressive review pass.

## Ticket Integration

If your session already has ticket context, these flows can attach to it automatically. If not, they still work as standalone git workflows.

## Related

- [Ticket Workflow](./ticket-workflow/)
- [Git Workflow Plugin](/extend/plugins/git-workflow/)
- [Commands Reference](/reference/commands/)
