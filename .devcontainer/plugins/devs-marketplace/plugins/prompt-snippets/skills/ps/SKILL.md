---
name: ps
description: Inject a behavioral prompt snippet by name.
disable-model-invocation: true
argument-hint: "[snippet-name]"
---

# /ps — Prompt Snippets

Apply the prompt snippet matching `$ARGUMENTS` from the table below. Follow its instruction for the **remainder of this conversation** unless the user explicitly overrides it.

If `$ARGUMENTS` does not match any snippet name, list all available snippets and ask the user to pick one.

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

## Composing Snippets

Multiple snippets can be applied in one invocation by separating names with spaces:

```text
/ps noaction brief
```

Apply all matching snippets. If instructions conflict, the **last snippet wins** for that specific behavior.
