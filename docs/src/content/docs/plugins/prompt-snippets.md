---
title: Prompt Snippets
description: Quick behavioral mode switches via the /ps command for common workflow adjustments.
sidebar:
  order: 13
---

The prompt snippets plugin provides quick behavioral mode switches through the `/ps` command. Instead of writing out full instructions every time you want Claude to work differently (be brief, don't take action, build a plan first), you invoke a named snippet that applies a preset instruction for the remainder of the conversation.

## How It Works

Use `/ps` followed by a snippet name:

```
/ps noaction
```

Claude applies that snippet's instruction and follows it for the rest of the conversation unless you explicitly override it with another instruction or snippet.

## Available Snippets

| Snippet | Instruction |
|---------|-------------|
| `noaction` | Investigate and report only. Take no action — no edits, no commands, no file writes. |
| `brief` | Be concise. Short answers, no filler, no preamble. Answer the question and stop. |
| `plan` | Build a plan before taking any action. Do not implement until the plan is explicitly approved. |
| `go` | Proceed without asking for confirmation. Use your best judgment on all decisions. |
| `review` | Review and audit only. Report findings with specific file paths and line numbers. Do not modify anything. |
| `ship` | Commit all staged changes, push to remote, and create a pull request. |
| `deep` | Be thorough and comprehensive. Investigate in depth, consider edge cases, leave no stone unturned. |
| `hold` | Complete the current task but do not commit, push, or publish. Await my review before any git operations. |
| `recall` | Search past session history with `ccms --no-color --project "$(pwd)"` to find prior decisions, discussions, and context relevant to the current task. Summarize what you find before proceeding. |
| `wait` | When done, stop. Do not suggest next steps, ask follow-up questions, or continue with related work. Await further instructions. |

:::tip[When to Use Snippets]
Snippets are most useful when you want to quickly adjust Claude's behavior without writing out full custom instructions. Common scenarios:
- `noaction` before asking exploratory questions ("What does this function do?")
- `brief` when you want quick answers without context
- `plan` before starting a complex feature
- `go` when you're confident and want Claude to proceed autonomously
- `recall` when you need to recover context from past sessions
:::

## Composing Snippets

Multiple snippets can be applied in one invocation by separating names with spaces:

```
/ps noaction brief
```

This applies both snippets. If instructions conflict, the **last snippet wins** for that specific behavior. For example:

```
/ps plan go
```

The `plan` snippet says "build a plan first," but `go` says "proceed without confirmation," so the net effect is: build a plan, but don't ask for approval before implementing it — just show the plan and start.

## Snippet Persistence

Snippets apply for the **remainder of the conversation** unless:
- You invoke `/ps` again with different snippets (replaces the previous ones)
- You give explicit instructions that override the snippet ("actually, go ahead and edit the file")
- The session ends (snippets don't persist across sessions)

If you want to clear a snippet, you can either:
- Say "ignore the previous /ps instruction"
- Invoke `/ps` with an empty argument (this clears all active snippets)

## Common Combinations

| Combination | Effect |
|-------------|--------|
| `noaction brief` | Investigate and report, but keep answers short |
| `review deep` | Thorough audit with comprehensive findings, no modifications |
| `plan go` | Build a plan and implement it without asking for approval |
| `brief wait` | Short answer, no follow-up suggestions |
| `recall plan` | Search past sessions for context, then build a plan |

## Hook Scripts

The prompt-snippets plugin provides no hooks — all functionality is delivered through the `/ps` slash command.

## Related

- [Skills Reference](../features/skills/) — the `/ps` skill is also documented in the skills catalog
- [Session Context](./session-context/) — provides git state and TODO context that pairs well with `recall` snippet
