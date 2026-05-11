# Goal Daemon — Implementation Sessions

## Overview

Add a local sidecar daemon to CodeForge CLI that provides durable goal state,
Stop-hook evaluation, and context rehydration for Claude Code sessions.

**Reference handoff:** `../TASK.md` (full feature spec from original planning session)

## Decisions (Locked)

| Decision | Choice |
|----------|--------|
| State layout | `.claude/goal/` (Claude-facing artifacts) + `.codeforge/goal/` (daemon infra) |
| AI models | Groq free tier (evaluator, latency-critical) + OpenRouter free models (planner) |
| Stop behavior | Moderate — block on evidence gaps only |
| Skills | `.claude/skills/` only, no legacy commands fallback |
| SQLite | `bun:sqlite` (native, zero deps) |
| Daemon lifecycle | Foreground default + `--detach` flag |
| Job runner | Deferred to phase 2 |
| AI SDK providers | `@ai-sdk/groq` + `@openrouter/ai-sdk-provider` |
| HTTP server | `Bun.serve()` — no framework |

## MVP Scope

**In:** goal install, daemon, status, reset, doctor, /goal skill, Stop hook evaluator,
SessionStart rehydration, raw event recording, GoalPlanner, GoalEvaluator, loop safety.

**Out:** context grading, turn summarizer, context summarizer, bash job runner,
failure classifier, PreCompact/PostCompact hooks, session-level log directories.

## Session Order

| # | Session | Depends On | Est. Files |
|---|---------|-----------|------------|
| 1 | [Foundation](./01-foundation.md) | — | ~10 |
| 2 | [Goal State Layer](./02-goal-state.md) | 1 | ~6 |
| 3 | [Install + Doctor](./03-install-doctor.md) | 1 | ~12 |
| 4 | [AI Agent Layer](./04-ai-agents.md) | 2 | ~6 |
| 5 | [Hook Integration](./05-hook-integration.md) | 3, 4 | ~8 |

Sessions 2 and 3 can run in parallel after session 1.
Session 4 depends on session 2 (needs goal DB layer).
Session 5 depends on both 3 and 4.

## Module Layout

```
cli/src/
  commands/goal/          # CLI command handlers (thin shells)
    install.ts
    daemon.ts
    status.ts
    reset.ts
    doctor.ts
  daemon/                 # Daemon server + core logic
    server.ts             # Bun.serve() HTTP + router
    routes.ts             # Route handlers
    db.ts                 # SQLite open, migrations, queries
    goal-manager.ts       # Goal CRUD + state transitions
    event-recorder.ts     # Raw hook events → JSONL + DB
    evidence.ts           # Deterministic probes (git, plan scan)
    evaluator.ts          # Stop evaluation orchestration
    config.ts             # Config loading + defaults
  daemon/agents/          # Vercel AI SDK agents
    model-router.ts       # Provider selection + fallback
    planner.ts            # GoalPlanner
    evaluator.ts          # GoalEvaluator
  daemon/templates/       # Generated file templates
    hooks/                # Hook script templates
    skills/               # SKILL.md templates
    settings-patch.ts     # settings.json merge
  schemas/
    goal.ts               # Interfaces + Zod schemas

Project-local (runtime):
  .codeforge/goal/daemon.db
  .codeforge/goal/config.json
  .codeforge/goal/daemon.pid
  .codeforge/goal/logs/daemon.log
  .claude/goal/state.json
  .claude/goal/plan.md
  .claude/goal/progress.md
  .claude/goal/handoff.md
  .claude/hooks/goal-*.ts
  .claude/skills/goal*/SKILL.md
```
