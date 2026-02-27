---
title: System Prompts
description: Customize Claude Code behavior through main and writing system prompts.
sidebar:
  order: 3
---

System prompts define how Claude Code behaves during your sessions -- its coding style, response format, tool usage patterns, and decision-making priorities. CodeForge ships two system prompts: one for development work and one for writing tasks.

## Main System Prompt

The main system prompt is loaded for every `cc` or `claude` session. It is the single most influential file in shaping how Claude works with your code.

**Location:** `.codeforge/config/main-system-prompt.md`
**Deployed to:** `~/.claude/main-system-prompt.md`

### What It Controls

The main prompt is organized into tagged sections, each governing a specific aspect of behavior:

| Section | Purpose |
|---------|---------|
| `<rule_precedence>` | Priority ordering when rules conflict (safety first, then user instructions, then coding standards) |
| `<response_guidelines>` | Response structure, formatting, brevity rules, and communication style |
| `<professional_objectivity>` | Technical accuracy over agreement, evidence-based corrections |
| `<orchestration>` | Subagent delegation, task decomposition, team composition, parallelization |
| `<code_directives>` | Coding standards (SOLID, DRY, function size, error handling, security) |
| `<execution_discipline>` | Verify before assuming, read before writing, no silent deviations |
| `<testing_standards>` | Test behavior not implementation, mock limits, coverage expectations |

### Structure

The prompt uses XML-like tags to organize sections. This structure lets you modify one aspect of behavior without affecting others:

```markdown
<response_guidelines>
Structure:
- Begin with substantive content; no preamble
- Use headers and bullets for multi-part responses
- Front-load key information; details follow

Brevity:
- Provide concise answers by default
- Do not restate the problem back to the user
- Do not pad responses with filler or narrative
</response_guidelines>
```

Each section is self-contained. You can edit, remove, or add sections independently.

## Writing System Prompt

The writing system prompt is activated when you launch Claude with the `ccw` command. It replaces the development-focused prompt with one tuned for creative fiction writing.

**Location:** `.codeforge/config/writing-system-prompt.md`
**Deployed to:** `~/.claude/writing-system-prompt.md`

### Key Differences from Main Prompt

- Focuses on prose craft — darkly humorous third-person limited fiction style
- Provides emotional architecture guidance (controlled emotion, not suppressed)
- Includes genre-specific touchstones (Joe Abercrombie, Mark Lawrence)
- Replaces code standards with prose-quality principles and POV discipline

:::tip[Quick Switch]
Use `cc` for coding sessions and `ccw` for writing sessions. Both are shell aliases that point Claude Code at different system prompt files.
:::

## Customizing Prompts

### Editing the Main Prompt

To change development behavior, edit `.codeforge/config/main-system-prompt.md`. Your changes are deployed to `~/.claude/` on the next container start via the file manifest.

For changes to take effect immediately (without restarting the container), edit the deployed copy at `~/.claude/main-system-prompt.md` directly. Be aware that this copy will be overwritten on the next container rebuild unless you change the overwrite mode in `file-manifest.json`.

### What to Customize

Common modifications include:

- **Coding standards** -- Add your team's specific conventions (naming, architecture patterns, preferred libraries)
- **Response style** -- Adjust verbosity, explanation depth, or formatting preferences
- **Tool usage** -- Change how Claude uses git, runs tests, or structures file operations
- **Security requirements** -- Add domain-specific security constraints
- **Testing approach** -- Modify test frameworks, coverage expectations, or mock limits

### Example: Adding a Custom Section

```markdown
<project_conventions>
Framework: FastAPI + SQLAlchemy
- All endpoints use dependency injection for database sessions
- Use Pydantic v2 model_validator for complex validation
- Alembic for all schema migrations -- never modify tables directly
- API responses follow the envelope pattern: { data, meta, errors }
</project_conventions>
```

Add this section anywhere in the system prompt. Claude will incorporate these conventions into its work.

## Prompt Design Best Practices

### Be Specific and Actionable

Vague instructions lead to inconsistent behavior. Compare:

| Weak | Strong |
|------|--------|
| "Write good tests" | "Use `pytest` with fixtures; every test function tests one behavior" |
| "Handle errors properly" | "Wrap external API calls in try/except; log the original error; raise a domain-specific exception" |
| "Follow best practices" | "Functions under 30 lines; no more than 3 parameters; pure where possible" |

### State Constraints as Requirements

Claude treats statements of fact as stronger guidance than suggestions:

```markdown
# Weaker
- You should probably use TypeScript strict mode

# Stronger
- TypeScript strict mode is always enabled. Never use `any`.
```

### Keep the Prompt Focused

The system prompt should contain _behavioral instructions_, not domain knowledge. Move reference material elsewhere:

| Content Type | Where It Belongs |
|-------------|-----------------|
| Coding standards and response style | System prompt |
| Project architecture and conventions | CLAUDE.md |
| Mandatory constraints | [Rules](./rules/) |
| Framework-specific reference | [Skills](../plugins/skill-engine/) |

### Include Examples for Non-Obvious Conventions

When your convention is not a common industry pattern, include a concrete example:

```markdown
<error_handling>
API errors use the structured error envelope:
- Wrap handler logic in try/except
- Return {"error": {"code": "NOT_FOUND", "message": "..."}, "data": null}
- Log the full traceback to the structured logger
- Never expose internal error details to the client
</error_handling>
```

### Avoid Conflicting Instructions

Review your prompt for contradictions. If one section says "always use descriptive variable names" and another says "keep code concise," Claude may produce inconsistent results. When two guidelines tension, state which takes priority.

## System Prompts vs. Rules vs. CLAUDE.md

These three mechanisms work together but serve different purposes:

| Mechanism | Loaded | Purpose | Example |
|-----------|--------|---------|---------|
| **System prompt** | Every session, via `--system-prompt-file` | Behavioral guidelines and coding standards | "Begin with substantive content; no preamble" |
| **Rules** | Every session, from `.claude/rules/` | Hard constraints that must be followed | "ALL file operations MUST target the current project directory" |
| **CLAUDE.md** | Every session, from project root | Project context and conventions | "This project uses FastAPI with SQLAlchemy" |

Rules override the system prompt when they conflict. CLAUDE.md provides context but does not enforce behavior.

## Deployment and File Manifest

Both system prompts are listed in `file-manifest.json` and deployed to `~/.claude/` on every container start:

```json
{
  "src": "config/main-system-prompt.md",
  "dest": "${CLAUDE_CONFIG_DIR}",
  "enabled": true,
  "overwrite": "if-changed"
}
```

The `if-changed` mode means your deployed copy is only overwritten when the source file's SHA-256 hash changes. If you want to make persistent local edits to the deployed prompt, change the overwrite mode to `"never"` so your changes survive container rebuilds.

:::note[Two Copies]
The source file at `.codeforge/config/main-system-prompt.md` is the canonical version. The deployed copy at `~/.claude/main-system-prompt.md` is what Claude Code actually loads. Edits to the source are deployed on next container start. Edits to the deployed copy take effect immediately but may be overwritten.
:::

## Related

- [Rules](./rules/) -- hard constraints complementing system prompts
- [Configuration](./configuration/) -- settings that affect prompt deployment
- [Agent System](../plugins/agent-system/) -- agents have their own specialized prompts
