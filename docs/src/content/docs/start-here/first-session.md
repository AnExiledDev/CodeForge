---
title: Start Your First Session
description: Launch your first CodeForge-powered Claude Code session and understand the default behavior.
sidebar:
  order: 4
---

Once installation is verified, start Claude Code with the default CodeForge setup.

## Launch Command

```bash
cc
```

This is the recommended command for normal work.

## What `cc` Does

When you launch `cc`, CodeForge starts Claude Code with:

- the main system prompt
- your enabled plugins
- CodeForge agents and skills
- the configured permission mode and environment

You do not need to manually enable those pieces in a normal session.

## Other Launch Commands

You do not need these on day one, but you will see them elsewhere in the docs:

| Command | Use It When |
|---------|-------------|
| `ccw` | You want writing-focused behavior for docs or prose |
| `ccraw` | You want vanilla Claude Code with no CodeForge customization |
| `cc-orc` | You want delegation-first orchestration mode |
| `codex` | You want OpenAI Codex CLI instead of Claude Code |

For the full command catalog, use [Commands Reference](/reference/commands/).

## What Happens Automatically

At session start, CodeForge provides:

- project-aware system prompting
- plugin hooks for safety and automation
- git and TODO context injection
- automatic agent delegation when a request fits a specialist

## When to Use `ccraw`

If behavior seems surprising and you want to separate CodeForge from Claude Code itself, launch `ccraw` and compare the result.

## Next Steps

- Try real prompts in [Your First Tasks](./your-first-tasks/)
- Learn the normal operating model in [Session Basics](/use/session-basics/)
