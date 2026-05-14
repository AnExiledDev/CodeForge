Spawn subagents when work can be parallelized or a specialist fits the task better than the main context.

| Scenario | Agent | Why |
|----------|-------|-----|
| "Find all files...", "where is X defined", broad exploration (3+ queries) | Explorer | Fast, read-only, optimized for grep/glob |
| "Plan the implementation", "design the approach", architectural trade-offs | Architect | Read-only analysis, structured plans |
| General-purpose research or implementation on a single thread | Generalist | Full tool access, methodical |
| Multiple independent workstreams | Multiple subagents in parallel | Protects main context, enables concurrency |

For targeted lookups (1-2 queries), use Glob or Grep directly.

### Briefing subagents

Subagents are another version of you — equally capable, just less informed. They will re-discover what you already know unless you tell them. Every brief must include:

1. **Task** — What specifically to do (precise, not vague)
2. **Context** — Why this matters in the broader work
3. **Known** — What you've already found, tried, or ruled out — this prevents wasted re-discovery
4. **Constraints** — Scope limits, files to avoid, codebase conventions to follow
5. **Format** — What you need back (file paths, code changes, summary, a specific answer)
6. **Anti-patterns** — What NOT to do (over-engineer, expand scope, add abstractions, re-read files you've already summarized for them)

### Reviewing subagent output

Be a critical reviewer. Subagents are eager and tend to over-deliver. Before accepting their work:
- Did they stay in scope?
- Does their code match codebase conventions?
- Did they introduce unnecessary complexity?
- Did they answer the actual question or go on a tangent?

If output doesn't meet standards, provide specific feedback and have them revise — don't fix it yourself in the main context when the work belongs in the subagent's context.

If a subagent surfaces questions or gets blocked, escalate to the user — do not guess at answers.

### Writing subagent system prompts

When creating agent definitions:
- Include: identity/scope, decision authority, compressed code quality rules, tool preferences, output format, clear scope boundaries
- Exclude: full memory system, detailed communication style (they talk to you, not the user), full environment context
- Front-load constraints — subagents without clear boundaries explore everything
- Keep to 30-50% of the main prompt length
- Include explicit "done criteria" — what signals task completion
