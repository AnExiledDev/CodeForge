---
description: Transform requirements into EARS-formatted GitHub issue with structured business requirements
argument-hint: [requirements description]
disable-model-invocation: true
allowed-tools: Bash(gh:*), Read, Grep, Glob, AskUserQuestion
---

# /ticket:new - Create EARS-Formatted GitHub Issue

Transform requirements into structured GitHub issue with EARS-formatted business requirements.

## Input

`$ARGUMENTS` - Stream-of-consciousness, structured, or minimal requirements description.

## Process

### Phase 1: Requirements Gathering

Use AskUserQuestion iteratively to clarify:

1. **Problem Space**
   - What problem does this solve?
   - Who is affected? (end users, admins, system)
   - What is the current state/workaround?

2. **Desired Outcome**
   - What does success look like?
   - What is the end-user impact?
   - Are there measurable success criteria?

3. **Trigger Conditions** (determines EARS pattern)
   - Always active? → Ubiquitous
   - Triggered by event? → Event-Driven
   - Active during state? → State-Driven
   - Error/edge case handling? → Unwanted Behavior
   - Optional/configurable? → Optional Feature

4. **Scope Boundaries**
   - What is explicitly OUT of scope?
   - What systems/components are affected? (discover from codebase)

5. **Technical Questions** (parking lot)
   - Note questions for implementation phase
   - Do NOT make technical decisions now

### Phase 2: Structure Ticket

Format the ticket with these sections:

```markdown
## Original Request

> [Verbatim user input from $ARGUMENTS]

## Overview

[Plain language description - goal, context, user impact. Cleaned and clarified from user input.]

## Requirements

### [System/Component Name]
- [EARS requirements for this system]

### [Another System/Component]
- [EARS requirements for this system]

(Group by affected system/component. Discover systems by exploring codebase structure.
Single-system projects need no grouping. Include only systems with requirements.)

## Technical Questions

- [ ] [Questions to resolve during /ticket:work]

## Acceptance Criteria

- [ ] [Testable criteria derived from requirements]
```

### Preserve Original Input

If `$ARGUMENTS` contains meaningful context (more than a few words), include it verbatim in the "Original Request" section. This provides:
- Audit trail for requirements traceability
- Context for future readers
- Verification that requirements capture user intent

Omit the "Original Request" section only if input was trivially simple (single word, "test", etc.)

### System/Component Discovery

Do NOT hardcode system names. Discover them by:
- Examining top-level directories (e.g., `src/`, `api/`, `web/`, `services/`)
- Checking package.json workspaces or monorepo structure
- Reading docker-compose.yml for service names
- Looking at existing CLAUDE.md for documented architecture

Use the actual names found in the project.

### EARS Patterns

Every requirement MUST use one pattern:

| Pattern | Template | Use When |
|---------|----------|----------|
| Ubiquitous | The `<system>` shall `<response>`. | Always active, fundamental behavior |
| Event-Driven | WHEN `<trigger>`, the `<system>` shall `<response>`. | Triggered by specific event |
| State-Driven | WHILE `<state>`, the `<system>` shall `<response>`. | Active during condition |
| Unwanted Behavior | IF `<condition>`, THEN the `<system>` shall `<response>`. | Error handling, edge cases |
| Optional Feature | WHERE `<feature enabled>`, the `<system>` shall `<response>`. | Configurable features |

### Phase 3: Confirm and Create

1. Present formatted ticket for user confirmation
2. Allow edits/refinements
3. Create issue: `gh issue create --title "<title>" --body "<body>"`
4. Output issue URL
5. Suggest: "Run `/ticket:work #N` to start implementation planning"

## Rules

- NO technical requirements (no code paths, file changes, implementation details)
- Every requirement MUST fit an EARS pattern
- Multi-system features → separate requirement per system with actual system name
- Plain language overview ALWAYS included
- Technical questions go in parking lot, not requirements
- Requirements describe WHAT, not HOW
- Preserve original user input for audit trail

## Example Output

```markdown
## Original Request

> Users should be able to temporarily disable auto-proxying for their characters without having to delete them. Right now if someone wants to stop using a character temporarily they lose all their settings.

## Overview

Users need the ability to temporarily disable character auto-proxying without deleting configuration. Currently, users must delete and recreate characters to toggle this behavior, losing customization.

## Requirements

### API
- The API shall store an enabled/disabled status for each character.
- WHEN a character's enabled status changes, the API shall publish a cache invalidation event.

### Bot
- WHEN a user sends a message matching a character's proxy pattern, the bot shall check the character's enabled status before proxying.
- WHILE a character is disabled, the bot shall not proxy messages for that character.

### Dashboard
- The dashboard shall display the character's enabled status on the character card.
- WHEN the user clicks the enable/disable toggle, the dashboard shall update the character's status via API.

## Technical Questions

- [ ] Should disabled characters appear differently in command autocomplete?
- [ ] What is the default enabled status for new characters?

## Acceptance Criteria

- [ ] Character can be disabled without deletion
- [ ] Disabled character messages are not proxied
- [ ] Status persists across restarts
- [ ] Dashboard reflects current status
- [ ] Cache invalidation works correctly
```
