---
title: Session Basics
description: Understand the default CodeForge session model, launch commands, permissions, and what happens when a session starts.
sidebar:
  order: 1
---

This page covers the normal operating model for working in CodeForge.

## Default Command

Use `cc` for everyday work:

```bash
cc
```

That launches Claude Code with CodeForge's prompts, enabled plugins, configured permissions, and session context.

## Launch Commands

| Command | Use It For |
|---------|------------|
| `cc` | Normal coding sessions with the main CodeForge setup |
| `claude` | Alias for `cc` |
| `ccw` | Writing-heavy sessions such as docs and prose |
| `ccraw` | Vanilla Claude Code without CodeForge customization |
| `cc-orc` | Delegation-first orchestration mode |
| `codex` | OpenAI Codex CLI, separate from Claude Code |

## What Starts Automatically

When you launch `cc`, CodeForge handles these pieces for you:

- system prompt loading
- plugin hook registration
- agent and skill availability
- git and TODO context injection
- shell aliases and status line integration

## Permissions and Defaults

Session behavior comes from `.codeforge/config/settings.json`, especially:

- `model`
- `effortLevel`
- `permissions.defaultMode`
- `enabledPlugins`

If you want to change defaults, start with [Settings and Permissions](/customize/settings-and-permissions/).

## When to Use `ccraw`

Use `ccraw` when you need to compare CodeForge behavior against vanilla Claude Code, or when you are debugging prompts, hooks, or plugin behavior.

## Resume Sessions

You can resume a prior session with:

```bash
cc --resume <session-id>
```

## Next Steps

- [Everyday Commands](./everyday-commands/)
- [Agents and Skills in Practice](./agents-and-skills/)
- [Commands Reference](/reference/commands/)
