---
title: Ticket Workflow
description: The ticket workflow plugin integrates issue tracking with the development workflow — linking commits to tickets and managing ticket lifecycle.
sidebar:
  order: 5
---

The ticket workflow plugin bridges your GitHub issue tracker with your Claude Code development workflow. It automatically fetches ticket context when you reference issues, provides structured commands for creating EARS-formatted tickets, planning implementations, reviewing commits, and generating pull requests — all without leaving your coding session.

## Automatic Ticket Linking

The plugin's most visible feature is automatic ticket linking. When you type a prompt that mentions an issue number like `#123` or a full GitHub URL, the `ticket-linker.py` hook fetches the ticket body and injects it into Claude's context before your prompt is processed.

This means you can say things like:

- "Work on #42" — Claude automatically sees the full issue title, body, state, and labels
- "Fix the bug described in #108" — the issue details are available without copy-pasting
- "Review github.com/myorg/myrepo/issues/55" — full URLs work too

The linker fires on the `UserPromptSubmit` event, runs the GitHub CLI (`gh`) to fetch the issue, and injects the ticket context as additional information. It handles up to 3 ticket references per prompt and truncates very long issue bodies to keep context manageable.

:::tip[No Setup Required]
Ticket linking works automatically as long as the GitHub CLI is authenticated. CodeForge's devcontainer handles this for you. Just reference an issue number and the context appears.
:::

## Ticket Lifecycle Commands

The plugin provides four slash commands that cover the full ticket lifecycle — from creating an issue through implementation planning to pull request creation.

### `/ticket:new` — Create a Structured Issue

Transforms your requirements into a well-structured GitHub issue with EARS-formatted business requirements. The command guides you through a requirements gathering process:

1. **Problem space** — what problem does this solve, who is affected, what is the current workaround?
2. **Desired outcome** — what does success look like, what is the user impact?
3. **Trigger conditions** — determines the EARS pattern (Ubiquitous, Event-Driven, State-Driven, Unwanted Behavior, or Optional Feature)
4. **Scope boundaries** — what is explicitly out of scope?
5. **Technical questions** — parked for the implementation phase, not decided now

The output is a GitHub issue with these sections: Original Request (preserving your verbatim input), Overview, Requirements (grouped by system/component using EARS patterns), Technical Questions, and Acceptance Criteria.

:::note[EARS Format]
EARS (Easy Approach to Requirements Syntax) uses five sentence patterns to write unambiguous requirements. For example: "WHEN a notification fails, the system shall retry 3 times with exponential backoff." The structured patterns prevent vague requirements like "the system should handle errors well."
:::

### `/ticket:work` — Plan Implementation

Retrieves a ticket and creates a detailed technical implementation plan. It explores your codebase to understand existing patterns, resolves technical questions from the ticket, and maps each EARS requirement to specific file changes.

The plan is structured as phases with prerequisites, file modifications, implementation steps, and verification checklists. After you review and approve the plan, it posts the full plan as a comment on the GitHub issue — creating a permanent record of the implementation approach.

Key features of the planning phase:
- Codebase exploration happens before any decisions are made
- Technical questions from the ticket are resolved by reading code, not guessing
- You confirm test preferences (full coverage, minimal, or none) before the plan is finalized
- All decisions and their rationale are documented in the issue comment

### `/ticket:review-commit` — Review and Commit

Conducts a thorough code review before committing. This is not a rubber stamp — it performs security analysis, project rules compliance checks, code quality assessment, architecture review, and requirements verification against the original ticket.

The review process:
1. Gathers all changes (`git diff`) and the ticket context
2. Runs security checks (secrets, injection, auth, data exposure)
3. Verifies compliance with `CLAUDE.md` and `.claude/rules/`
4. Assesses code quality (complexity, duplication, naming, error handling)
5. Cross-references each EARS requirement from the ticket
6. Presents findings organized by severity (Critical, High, Medium, Low)
7. You decide for each finding: FIX, create a GitHub ISSUE, or IGNORE
8. Creates issues for deferred findings, fixes selected items, then commits

The commit message includes business context (requirements addressed), technical changes, review findings, and a reference to the ticket number.

### `/ticket:create-pr` — Create Pull Request with Review

Creates a pull request and performs an aggressive security and architecture review — the final gate before merge. This goes deeper than the commit review, adding:

- **Attack surface analysis** — every new endpoint, input vector, and permission change
- **Threat modeling** — what could an attacker exploit in each new feature
- **Dependency security** — new packages checked for CVEs, typosquatting, license issues
- **Breaking changes** — API contract changes, schema migrations, configuration additions

The review findings are posted as a PR comment, organized by severity with file:line references. A status update is also posted back to the original ticket.

:::caution[Never Auto-Approves]
The `/ticket:create-pr` command explicitly never approves its own pull request. It always posts "Requires human approval" — the human reviewer makes the final merge decision.
:::

## How It All Fits Together

A typical workflow using all four commands looks like this:

```
1. /ticket:new "Users need to export their data as CSV"
   → Gathers requirements interactively
   → Creates GitHub issue #42 with EARS-formatted requirements

2. /ticket:work #42
   → Fetches ticket, explores codebase
   → Creates phased implementation plan
   → Posts plan as comment on #42

3. (You implement the feature, following the plan)

4. /ticket:review-commit
   → Reviews all changes against ticket #42 requirements
   → Security + quality + architecture checks
   → Commits with structured message referencing #42

5. /ticket:create-pr
   → Creates PR with summary and "Closes #42"
   → Runs deep security and architecture review
   → Posts findings as PR comment
   → Updates ticket #42 with PR status
```

## Integration with GitHub

The plugin uses the GitHub CLI (`gh`) for all GitHub operations — creating issues, posting comments, creating pull requests, and fetching ticket data. It works with GitHub Issues out of the box.

GitHub operations that the plugin performs:
- `gh issue create` — creating new tickets
- `gh issue view` — fetching ticket context (automatic linking)
- `gh issue comment` — posting plans, commit summaries, and PR status
- `gh pr create` — creating pull requests
- `gh pr review` — posting review findings (always as comments, never approvals)

## Hook Scripts

| Script | Event | What It Does |
|--------|-------|-------------|
| `ticket-linker.py` | UserPromptSubmit | Detects `#123` or GitHub URLs in prompts, fetches issue context via `gh`, injects it for Claude |

The ticket linker extracts up to 3 issue references per prompt using regex patterns for both short references (`#123`) and full GitHub URLs. It caps individual issue bodies at 1500 characters and total output at 3000 characters to keep context manageable.

## Tickets vs. Specs

Tickets and specs serve different purposes and work well together:

| Aspect | Tickets (`/ticket:*`) | Specs (`/spec-*`) |
|--------|----------------------|-------------------|
| **Focus** | What needs to be done (business requirements) | How it will be built (technical contract) |
| **Home** | GitHub Issues | `.specs/` directory in repo |
| **Format** | EARS requirements by system/component | Full template with schema, API, key files |
| **Lifecycle** | Create, plan, review, PR | Create, refine, build, review, update |
| **Best for** | External-facing tasks, collaboration, project management | Internal technical planning, complex features |

For simple tasks, a ticket alone may be sufficient. For complex features that span multiple systems, you might create a ticket for tracking and a spec for detailed technical planning.

## Related

- [Spec Workflow](./spec-workflow/) — specifications complement tickets with detailed technical planning
- [Session Context](./session-context/) — git state injection works alongside ticket tracking
- [Agent System](./agent-system/) — agents that execute ticket-planned work
- [Commands Reference](../reference/commands/) — full command reference
