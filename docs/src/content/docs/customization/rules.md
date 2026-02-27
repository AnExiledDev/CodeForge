---
title: Rules
description: Global rules system for enforcing hard constraints across all Claude Code sessions.
sidebar:
  order: 4
---

Rules are Markdown files that define hard constraints applied to every Claude Code session. While system prompts _guide_ behavior, rules _enforce_ it. If a rule says "never do X," Claude treats that as a mandatory requirement, not a suggestion.

## How Rules Work

Rule files are Markdown documents placed in `.claude/rules/`. Claude Code loads every `.md` file in this directory at session start and treats their contents as mandatory instructions. The filename is descriptive but does not affect loading -- all files are loaded equally.

Rules are deployed from `.codeforge/config/rules/` to `~/.claude/rules/` via the file manifest on every container start. You can also add rules directly to `.claude/rules/` in your project.

### Rule Precedence

When rules exist at multiple levels, more specific rules take priority:

1. **Project rules** (`.claude/rules/` in the project directory) -- highest precedence
2. **Workspace rules** (`.claude/rules/` at the workspace root) -- apply to all projects
3. **Built-in rules** (deployed by CodeForge) -- sensible defaults

If a project rule conflicts with a workspace rule, the project rule wins.

## Built-in Rules

CodeForge ships three rules that are deployed by default:

### Workspace Scoping (`workspace-scope.md`)

Enforces that all file operations -- reads, writes, edits, searches, and bash commands -- stay within the current project directory. This prevents cross-project contamination in multi-project workspaces.

```markdown
ALL file operations (reads, writes, edits, searches, globs, bash commands)
MUST target paths within the current project directory. No exceptions.
```

This rule works in concert with the [Workspace Scope Guard](../plugins/workspace-scope-guard/) plugin, which provides hook-level enforcement.

### Spec Workflow (`spec-workflow.md`)

Mandates specification-driven development. Every non-trivial feature requires a spec before implementation begins, and every implementation ends with an as-built spec update.

Key requirements:
- Use `/spec-new` to create specs from the standard template
- Use `/spec-update` after implementation to close the loop
- Specs live in `.specs/` organized by domain folders
- Run `/spec-check` before starting new milestones

### Session Search (`session-search.md`)

Configures the `ccms` session history search tool. Mandates project-scoped searches to prevent cross-project information leakage, and requires CLI mode (no interactive TUI) for automation compatibility. _(Note: `ccms` is currently disabled in the default container build. This rule remains deployed so it takes effect if ccms is re-enabled.)_

Key requirements:
- Always pass `--project <current-project-dir>` to scope results
- Always pass a query string (no bare `ccms` TUI mode)
- Use `--no-color` for clean output parsing
- Default to `-n 20` to limit result count

## Creating Custom Rules

### File Format

Rules are plain Markdown files. Use headers, numbered lists, and bold text to make constraints clear and scannable:

```markdown
# API Security Standards

## Rules

1. **All endpoints require authentication** -- no anonymous access
   to any route except `/health` and `/docs`.
2. **Use parameterized queries exclusively** -- string interpolation
   in SQL is forbidden, even for internal tools.
3. **Rate limit all public endpoints** -- minimum 100 req/min per IP
   using the `slowapi` middleware.
4. **Validate all request bodies** -- use Pydantic models with
   explicit field constraints (min/max length, regex patterns).
```

### Writing Effective Rules

Rules work best when they follow these patterns:

- **State the constraint clearly** -- "Never use `any` type" is better than "Prefer specific types"
- **Include brief rationale** -- "...because it bypasses type checking" helps Claude apply the rule to edge cases
- **Be specific enough to act on** -- "Use `pytest` with fixtures" rather than "Write good tests"
- **Keep each file focused** -- One concern per rule file makes it easy to toggle rules on and off

:::caution[Rules Are Not Suggestions]
Claude treats rule file content as mandatory. If you write "consider using X," Claude will treat that as a firm instruction. Use definitive language: "always," "never," "must," "must not."
:::

### Rule File Organization

```
.claude/
└── rules/
    ├── spec-workflow.md      # Built-in: specification workflow
    ├── workspace-scope.md    # Built-in: project isolation
    ├── session-search.md     # Built-in: ccms configuration
    ├── coding-standards.md   # Custom: your team's standards
    ├── git-workflow.md       # Custom: branching and commit rules
    └── security.md           # Custom: security requirements
```

### Adding a Rule to CodeForge Defaults

To make a rule deploy automatically to all projects:

1. Create the rule file in `.codeforge/config/rules/`
2. Add an entry to `.codeforge/file-manifest.json`:

```json
{
  "src": "config/rules/my-rule.md",
  "dest": "${CLAUDE_CONFIG_DIR}/rules",
  "enabled": true,
  "overwrite": "if-changed"
}
```

3. Rebuild the container to deploy

## Example: Complete Custom Rule

Here is a complete rule file you might use for a Node.js project:

```markdown
# Node.js Project Standards

## Mandatory Rules

1. **Use ESM imports exclusively** -- no `require()` calls.
   The project uses `"type": "module"` in package.json.
2. **All async functions must handle errors** -- wrap await calls
   in try/catch or use `.catch()`. Unhandled rejections crash the server.
3. **Database queries use the query builder** -- never write raw SQL
   strings. Use Knex or Drizzle query builder methods.
4. **Environment variables accessed through config module** -- never
   read `process.env` directly in business logic. Import from
   `src/config.ts` which validates all required vars at startup.
5. **Tests use vitest** -- not jest, not mocha. Run with
   `vitest run` for CI and `vitest` for watch mode.

## Rationale

These rules prevent the most common bugs in this codebase:
mixed module systems, silent async failures, SQL injection,
missing env vars in production, and test runner confusion.
```

This rule would be saved as `.claude/rules/nodejs-standards.md` and loaded automatically on session start.

## Rules vs. System Prompts vs. CLAUDE.md

These three mechanisms serve distinct purposes and have different strengths:

| Mechanism | Purpose | Best For | Enforcement |
|-----------|---------|----------|-------------|
| **Rules** | Hard constraints that must be followed | Security policies, workflow requirements, tool usage mandates | Highest -- treated as mandatory |
| **System Prompts** | Behavioral guidelines and coding standards | Response style, coding patterns, communication preferences | Medium -- guides behavior |
| **CLAUDE.md** | Project context and architecture | Tech stack, file structure, domain concepts | Informational -- provides context |

:::note[When to Use Which]
Use **rules** when violation would cause real harm (security, data loss, workflow breakage). Use the **system prompt** for coding style and response preferences. Use **CLAUDE.md** for project-specific context that Claude needs to understand your codebase.
:::

## Related

- [System Prompts](./system-prompts/) -- behavioral guidelines that rules can override
- [Configuration](./configuration/) -- settings that control rule deployment via file-manifest
- [Workspace Scope Guard](../plugins/workspace-scope-guard/) -- the plugin that enforces the scoping rule
- [Spec Workflow](../plugins/spec-workflow/) -- the plugin that implements the spec workflow rule
