---
title: Agents and Skills in Practice
description: How CodeForge delegates work to agents, surfaces skills, and what that feels like in day-to-day use.
sidebar:
  order: 3
---

CodeForge improves Claude Code in two related ways:

- **Agents** handle different kinds of work with different constraints and behaviors.
- **Skills** inject domain knowledge when a framework, pattern, or workflow is relevant.

## How It Feels as a User

You usually do not need to name an agent or manually load a skill. You describe the task, and CodeForge routes it.

Examples:

- Ask for an implementation plan and the **architect** agent takes the lead.
- Ask to explore the codebase and the **explorer** agent is used.
- Ask for tests and the **test-writer** agent handles framework-aware test generation.

## What Agents Change

Agents are not just different prompts. They can differ in:

- tool access
- model choice
- permission mode
- worktree isolation
- hook-based verification

This is why a read-only investigation behaves differently from a refactor or test-writing task.

## What Skills Change

Skills act like focused reference packs. They give Claude concrete patterns instead of generic guesswork.

Examples:

- `fastapi`
- `testing`
- `security-checklist`
- `refactoring-patterns`
- `ast-grep-patterns`

## Practical Advice

1. Start by describing the work plainly.
2. Be specific about scope and intent.
3. Let the delegated specialist do the first pass.
4. Name a specific agent only when you need to steer the workflow.

## When to Be Explicit

You can still ask for a named specialist:

```text
Use the security-auditor to review this endpoint.
Use the architect to plan this migration.
```

## Learn More

- [Agents Reference](/reference/agents/)
- [Skills Reference](/reference/skills/)
- [Agent System Plugin](/extend/plugins/agent-system/)
- [Skill Engine Plugin](/extend/plugins/skill-engine/)

## Next Steps

- Learn the broader session model in [Session Basics](./session-basics/)
- Start planning work in [Spec Workflow](./spec-workflow/)
