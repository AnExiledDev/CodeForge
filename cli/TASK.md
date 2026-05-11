# Handoff Prompt: Build a Claude Code Goal + Context Daemon Powered by Vercel AI SDK

You are implementing a local-first Claude Code workflow controller.

The system keeps **Claude Code CLI as the primary interactive coding worker**. It adds a **local sidecar daemon** that provides durable goal state, context black-box recording, improved compaction/handoff behavior, external context grading, command-output summarization, and Codex-style `/goal` continuation behavior.

The daemon is powered by **Vercel AI SDK** for structured-output meta-agents. Do not use Claude Agent SDK for the MVP unless explicitly asked later. The sidecar is a control plane, evaluator, summarizer, and job broker. It is **not** a replacement Claude Code TUI and not a second autonomous implementation agent.

## Product Intent

Build a repo-local assistant daemon that makes Claude Code more reliable over long tasks by answering these questions:

* What is Claude trying to accomplish?
* What work has actually been completed?
* What files, commands, validations, errors, and decisions matter?
* Is the current context safe to compact?
* Can a fresh agent continue from saved state alone?
* Is Claude trying to stop too early?
* Can noisy shell commands run out-of-band without polluting Claude's context?

The MVP should create a practical workflow where:

1. User runs `/goal <objective>` inside Claude Code.
2. Daemon creates a durable goal plan, progress log, and success criteria.
3. Claude Code works normally.
4. Hooks stream lifecycle events to the daemon.
5. Daemon logs raw events and normalizes useful facts.
6. Daemon uses Vercel AI SDK agents to summarize, grade, and evaluate progress.
7. When Claude Code tries to stop, the Stop hook asks daemon whether stop is allowed.
8. If incomplete, Stop hook blocks and injects a precise next checkpoint.
9. If complete, paused, blocked, or needing user input, Stop hook allows stop.
10. Before/after compaction, daemon writes durable handoff and rehydrates critical context.
11. Optional bash jobs can run through daemon and return compact summaries instead of dumping huge output into Claude context.

## Core Principle

Claude Code remains the planner/coder/operator inside the repo.

The daemon is the durable memory, referee, black-box recorder, context grader, and command-output broker.

Do not make the daemon compete with Claude Code for file edits. Do not create parallel implementation agents in the same worktree for the MVP.

## Non-Goals

Do not build:

* A full replacement terminal UI.
* A Claude Code clone.
* A second autonomous file-editing implementation agent.
* Parallel coding agents sharing one worktree.
* Hosted multi-user infrastructure.
* GitHub issue/PR integration.
* Cloud dashboard.
* OAuth proxying.
* Workflow DAG orchestration.
* Marketplace/plugin system.
* Destructive command automation.

Keep this local-first, repo-scoped, and boringly reliable.

## Preferred Stack

Use:

* TypeScript.
* Node.js or Bun, but document the runtime clearly.
* Vercel AI SDK for model calls.
* Zod for structured outputs.
* SQLite for durable state.
* Local HTTP server bound to `127.0.0.1` only.
* Claude Code hooks and Skills.
* Durable local files under `.claude/` and `.codeforge/`.

Avoid:

* Undocumented Claude Code internals unless isolated behind adapters.
* Long synchronous hook work except Stop evaluation.
* Exposing local daemon to LAN.
* Model-generated shell command execution by default.

## High-Level Architecture

```text
Claude Code CLI
  ├─ primary interactive worker
  ├─ Skills-based workflow entrypoints
  │   ├─ /goal
  │   ├─ /goal-status
  │   ├─ /goal-pause
  │   ├─ /goal-resume
  │   ├─ /goal-clear
  │   ├─ /daemon-status
  │   └─ /run-job optional
  ├─ hooks
  │   ├─ SessionStart
  │   ├─ UserPromptSubmit
  │   ├─ UserPromptExpansion
  │   ├─ PostToolUse or PostToolBatch
  │   ├─ Stop
  │   ├─ StopFailure
  │   ├─ PreCompact
  │   ├─ PostCompact
  │   └─ SessionEnd if available
  └─ normal Claude Code UX

Local Sidecar Daemon
  ├─ local HTTP API
  ├─ SQLite event/state store
  ├─ raw hook/event recorder
  ├─ normalized turn/work logger
  ├─ goal state manager
  ├─ context grading engine
  ├─ compaction handoff generator
  ├─ Stop evaluator
  ├─ optional bash job queue
  ├─ command output summarizer
  ├─ model router/fallback layer
  └─ Vercel AI SDK meta-agents
```

## Required Repository Layout

Create or support this layout:

```text
.claude/
  skills/
    goal/
      SKILL.md
    goal-status/
      SKILL.md
    goal-pause/
      SKILL.md
    goal-resume/
      SKILL.md
    goal-clear/
      SKILL.md
    daemon-status/
      SKILL.md
    run-job/
      SKILL.md

  hooks/
    goal-router.ts
    goal-status.ts
    goal-pause.ts
    goal-resume.ts
    goal-clear.ts
    session-start.ts
    user-prompt-submit.ts
    post-tool-event.ts
    stop.ts
    stop-failure.ts
    pre-compact.ts
    post-compact.ts
    session-end.ts

  goal/
    state.json
    plan.md
    progress.md
    handoff.md
    context-summary.md
    validation.md
    open-questions.md
    decisions.jsonl
    raw-hooks.jsonl
    turns.jsonl
    context-grades.jsonl
    model-failures.jsonl
    compact-snapshots.md

  session-logs/
    <session-id>/
      raw-hooks.jsonl
      queue.jsonl
      turns.jsonl
      work-log.md
      decisions.md
      files-touched.json
      commands-run.jsonl
      test-results.jsonl
      context-grades.jsonl
      compact-snapshots.md

.codeforge/
  goal-daemon.sqlite
  config.json
  logs/
    daemon.log
  jobs/
    <job-id>/
      meta.json
      stdout.log
      stderr.log
      summary.md
      result.json

.internal/
  goal-daemon-architecture.md
```

If not all files are needed immediately, implement the subset required for the MVP while keeping the architecture compatible with this layout.

## CodeForge CLI Commands

Implement this inside the existing CodeForge CLI. Do not create a separate `cdgoal` binary. Add goal/daemon functionality as CodeForge subcommands.

Target command shape:

```bash
codeforge goal install
codeforge goal daemon
codeforge goal status
codeforge goal reset
codeforge goal doctor
```

This handoff will be passed to a session that already knows the CodeForge CLI codebase before implementation. Preserve this as an integration requirement.

### `codeforge goal install`

Should:

* Create `.claude/skills/*`.
* Create `.claude/hooks/*`.
* Patch or generate `.claude/settings.json` safely.
* Create `.codeforge/config.json` if missing.
* Create required directories.
* Never silently overwrite existing user files.
* Back up changed files or clearly print diffs.
* Print exactly what changed.

### `codeforge goal daemon`

Should:

* Start local daemon on `127.0.0.1`.
* Use configurable port, default `17371`.
* Open or create SQLite DB.
* Run migrations.
* Write logs to `.codeforge/logs/daemon.log`.
* Refuse public network binding by default.

### `codeforge goal status`

Show:

* Daemon reachable or not.
* Active goal status.
* Last evaluator decision.
* Last validation evidence.
* Last context grade.
* Last compaction/handoff status.
* Hook install status.
* SQLite path.
* Recent model failures.

### `codeforge goal reset`

Clear active goal state after confirmation, or immediately with `--yes`.

Do not delete historical logs unless explicit flag is provided.

### `codeforge goal doctor`

Check:

* `.claude/settings.json` hook config.
* Skill files exist.
* Hook files exist.
* Daemon reachable.
* DB writable.
* `.claude/goal` writable.
* `.claude/session-logs` writable.
* Vercel AI SDK provider env vars/config exist.
* Optional OpenRouter/Vercel Gateway credentials exist.
* Git available.
* `jq` or equivalent not required unless hooks depend on it.

## Claude Code Skills and User-Facing Entrypoints

Use Claude Code Skills, not legacy custom command files. Skills function similarly for workflow activation but provide extra structure and capability on top. Implement Skills that support these user-facing entrypoints:

```text
/goal <objective>
/goal-status
/goal-pause
/goal-resume
/goal-clear
/daemon-status
/run-job <command or purpose>
```

Do not implement this as legacy `.claude/commands` unless forced by current Claude Code limitations. Prefer `.claude/skills/<skill-name>/SKILL.md` and any supporting files, assets, or scripts needed by each Skill.

### `/goal <objective>`

Flow:

1. Skill/workflow entrypoint receives objective.
2. Hook calls daemon `/goal/set`.
3. Daemon creates a new goal row.
4. Daemon runs `GoalPlanner` with Vercel AI SDK.
5. Daemon writes:

   * `.claude/goal/state.json`
   * `.claude/goal/plan.md`
   * `.claude/goal/progress.md`
   * initial DB events
6. Hook injects concise context into Claude:

   * active objective
   * concrete success criteria
   * current checkpoint
   * artifact paths
   * requirement to update progress
   * warning not to claim done without validation evidence

### `/goal-status`

Should show:

* Objective.
* Status.
* Current checkpoint.
* Loop count and limits.
* Last evaluator decision.
* Last validation command/result.
* Current context grade if available.
* Open blockers.
* Artifact paths.

### `/goal-pause`

Pause continuation behavior.

Stop hook must allow stop while paused.

### `/goal-resume`

Resume continuation behavior and inject current goal state.

### `/goal-clear`

Mark the active goal inactive/cleared.

Do not delete logs or artifacts unless explicitly requested.

### `/daemon-status`

Print daemon reachability and compact health summary.

### `/run-job`

Optional MVP-plus command for noisy commands.

Claude-facing idea:

```text
/run-job pnpm test
```

or:

```text
/run-job run the full test suite and summarize first root-cause failure
```

The command should route to daemon job runner. The daemon stores full output and returns only compact summary, relevant lines, exit code, and artifact paths.

## Hook Strategy

Hooks should be deterministic bridges, not large applications.

Each hook should:

* Read JSON from stdin.
* Append raw event to `raw-hooks.jsonl` when safe.
* Send normalized event to daemon.
* Fail gracefully.
* Avoid long model calls except Stop evaluation.
* Never log secrets.
* Redact obvious tokens/secrets.
* Use local HTTP to `127.0.0.1`.

### Hook: `SessionStart`

Purpose: rehydration.

On normal session start, resume, or post-compact start:

* Ask daemon if active goal exists for current cwd/session.
* If active, inject compact context:

  * objective
  * status
  * current checkpoint
  * relevant constraints
  * handoff path
  * instruction to read `.claude/goal/handoff.md` and `.claude/goal/progress.md` when needed
* If context grade says rehydration is needed, inject `recommendedRehydrationText`.

This is the core fix for context loss after compaction.

### Hook: `UserPromptSubmit`

Purpose: turn boundary and user intent capture.

Log:

* timestamp
* cwd
* session id
* transcript path
* prompt excerpt or full prompt if safe
* active goal id

Optionally trigger context grading when prompt indicates:

* correction from user
* frustration
* scope change
* failed previous attempt
* “you forgot”
* “that’s wrong”
* “continue”
* “where were we”

### Hook: `UserPromptExpansion`

Purpose: Skills/workflow entrypoint handling.

For `/goal` and related Skill-triggered workflows:

* Parse command args.
* Call daemon.
* Return hook-specific additional context for Claude.

### Hook: `PostToolUse` or `PostToolBatch`

Purpose: evidence capture.

Prefer `PostToolBatch` if available. Otherwise use `PostToolUse` and aggregate.

Persist:

* tool name
* file path if available
* bash command if available
* result status
* output excerpt
* errors
* changed files if inferable
* test/build/lint command evidence

Do not send huge outputs to model immediately. Append raw event and let daemon process deltas.

### Hook: `Stop`

Purpose: Codex-style goal continuation.

Flow:

1. Stop hook receives event.
2. Hook posts to daemon `/goal/evaluate-stop`.
3. Daemon gathers evidence:

   * active goal state
   * plan.md
   * progress.md
   * handoff.md
   * validation.md
   * recent tool events
   * recent turn summaries
   * last assistant message if available
   * git status
   * git diff summary
   * unchecked checklist items
   * validation outputs
   * repeated failures/loop counters
4. Daemon runs `GoalEvaluator` via Vercel AI SDK.
5. Daemon returns `allow` or `block`.

Allowed response:

```json
{
  "decision": "allow",
  "status": "done",
  "reason": "Goal complete with validation evidence."
}
```

Blocked response:

```json
{
  "decision": "block",
  "status": "continue",
  "reason": "Goal is not complete. Missing full validation and one unchecked milestone remains.",
  "nextInstruction": "Run pnpm test, fix the auth refresh regression failure, update .claude/goal/progress.md, then re-evaluate."
}
```

Needs-user response:

```json
{
  "decision": "allow",
  "status": "needs_user",
  "reason": "The task is blocked by a product decision: choose between preserving the old config format or migrating fully."
}
```

Stop hook should only block when continuation is useful and safe.

### Hook: `StopFailure`

Purpose: failure telemetry.

Log:

* failure reason
* partial context if available
* active goal
* last known checkpoint

Use this to classify recurring failures.

### Hook: `PreCompact`

Purpose: compaction preparation.

Before compaction:

* Ask daemon to write/update `.claude/goal/handoff.md`.
* Ask daemon to update `.claude/goal/context-summary.md`.
* Optionally run `ContextGrader` on current handoff.
* Inject short compact instructions:

  * preserve active objective
  * preserve current checkpoint
  * preserve incomplete milestones
  * preserve validation failures
  * preserve user constraints
  * preserve handoff path
  * drop stale exploration and dead ends

Do not block compaction by default. Blocking compaction can break recovery if context is already exhausted.

### Hook: `PostCompact`

Purpose: audit and rehydration preparation.

After compaction:

* Save `compact_summary` to durable log.
* Compare compact summary against handoff.
* Run `ContextGrader`.
* Update `.claude/goal/context-summary.md`.
* If compact summary dropped critical facts, store `recommendedRehydrationText` for next `SessionStart` injection.

### Hook: `SessionEnd`

If available:

* Finalize session log.
* Summarize final state.
* Mark any active goal as incomplete/paused unless completed.

## Daemon API

Implement local HTTP endpoints.

```http
GET  /health
GET  /status
GET  /goal/current?cwd=<path>
POST /goal/set
POST /goal/status
POST /goal/pause
POST /goal/resume
POST /goal/clear
POST /goal/evaluate-stop
POST /events/hook
POST /events/tool
POST /events/turn
POST /events/compact/pre
POST /events/compact/post
POST /context/summarize
POST /context/grade
POST /jobs/run
GET  /jobs/:id
GET  /jobs/:id/summary
GET  /jobs/:id/output
POST /jobs/:id/cancel
```

All endpoints use JSON.

Bind only to `127.0.0.1` by default.

## SQLite Schema

Implement migrations.

```sql
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  cwd TEXT NOT NULL,
  session_id TEXT,
  objective TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paused INTEGER NOT NULL DEFAULT 0,
  loop_count INTEGER NOT NULL DEFAULT 0,
  max_loops INTEGER NOT NULL DEFAULT 30,
  failed_validation_count INTEGER NOT NULL DEFAULT 0,
  repeated_instruction_count INTEGER NOT NULL DEFAULT 0,
  state_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goal_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id TEXT,
  session_id TEXT,
  cwd TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id TEXT,
  session_id TEXT,
  cwd TEXT NOT NULL,
  turn_index INTEGER,
  created_at TEXT NOT NULL,
  user_prompt TEXT,
  assistant_last_message TEXT,
  status TEXT,
  summary_json TEXT
);

CREATE TABLE IF NOT EXISTS tool_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id TEXT,
  session_id TEXT,
  cwd TEXT NOT NULL,
  created_at TEXT NOT NULL,
  tool_name TEXT,
  status TEXT,
  input_json TEXT,
  output_excerpt TEXT,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goal_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  decision TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT NOT NULL,
  next_instruction TEXT,
  confidence REAL,
  evidence_json TEXT NOT NULL,
  model_info_json TEXT
);

CREATE TABLE IF NOT EXISTS compactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id TEXT,
  session_id TEXT,
  cwd TEXT NOT NULL,
  created_at TEXT NOT NULL,
  phase TEXT NOT NULL,
  trigger TEXT,
  compact_summary TEXT,
  handoff_path TEXT,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS context_grades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id TEXT,
  session_id TEXT,
  cwd TEXT NOT NULL,
  created_at TEXT NOT NULL,
  score REAL,
  grade_json TEXT NOT NULL,
  model_info_json TEXT
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  goal_id TEXT,
  session_id TEXT,
  cwd TEXT NOT NULL,
  command TEXT NOT NULL,
  purpose TEXT,
  status TEXT NOT NULL,
  exit_code INTEGER,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  stdout_path TEXT,
  stderr_path TEXT,
  summary_path TEXT,
  result_json TEXT,
  model_info_json TEXT
);

CREATE TABLE IF NOT EXISTS model_failures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  task TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  status TEXT NOT NULL,
  duration_ms INTEGER,
  error_class TEXT,
  error_message TEXT,
  fallback_used TEXT,
  payload_json TEXT
);
```

Keep raw JSON payloads. Claude Code hook schemas may change.

## Vercel AI SDK Model Layer

Use Vercel AI SDK structured outputs with Zod.

Create a model router:

```ts
export interface ModelRouter {
  planner(): LanguageModel;
  evaluator(): LanguageModel;
  summarizer(): LanguageModel;
  grader(): LanguageModel;
  failureClassifier(): LanguageModel;
  jobSummarizer(): LanguageModel;
}
```

Config-driven providers/models:

```json
{
  "server": {
    "host": "127.0.0.1",
    "port": 17371
  },
  "models": {
    "planner": ["anthropic:claude-sonnet-4-5", "openai:gpt-5-mini"],
    "evaluator": ["anthropic:claude-haiku-4-5", "openrouter:qwen/qwen3-coder"],
    "summarizer": ["openrouter:openrouter/free", "openai:gpt-5-mini"],
    "grader": ["anthropic:claude-haiku-4-5", "openrouter:z-ai/glm-4.5-air"],
    "failureClassifier": ["openrouter:openrouter/free"],
    "jobSummarizer": ["openrouter:openrouter/free", "anthropic:claude-haiku-4-5"]
  },
  "limits": {
    "maxGoalLoops": 30,
    "maxRepeatedInstructions": 3,
    "maxFailedValidations": 5,
    "maxJobRuntimeSeconds": 300,
    "maxHookOutputChars": 8000
  },
  "validation": {
    "autoRunCommands": false,
    "suggestCommandsOnly": true
  },
  "security": {
    "bindHost": "127.0.0.1",
    "allowlistedCwdRoots": [],
    "denyDestructiveCommands": true,
    "redactSecrets": true
  }
}
```

Implement fallback/retry:

* Try configured models in order.
* Timeout per model.
* Validate structured output with Zod.
* Log model failures.
* Record fallback used.
* Do not let model failures brick Claude Code.

## AI Agents

### 1. GoalPlanner

Purpose: turn user objective into concrete, verifiable plan.

Input:

* objective
* cwd
* repo hints
* package manager detection
* optional README/package metadata

Schema:

```ts
const GoalPlanSchema = z.object({
  objective: z.string(),
  successCriteria: z.array(z.string()),
  milestones: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    done: z.boolean().default(false),
    validation: z.string().optional()
  })),
  suggestedValidationCommands: z.array(z.string()),
  risks: z.array(z.string()),
  nextCheckpoint: z.string()
});
```

Rules:

* Criteria must be concrete.
* Prefer validation commands over vague “looks good.”
* Keep plan small enough to be useful.
* Do not invent repo details not present in evidence.

### 2. GoalEvaluator

Purpose: decide whether Claude Code may stop.

Input:

* goal state
* success criteria
* plan.md
* progress.md
* validation.md
* handoff.md
* recent turn summaries
* recent tool events
* last assistant message
* git status
* git diff stat/name-only
* unchecked checklist items
* validation evidence
* loop safety counters

Schema:

```ts
const GoalEvaluationSchema = z.object({
  decision: z.enum(["allow", "block"]),
  status: z.enum(["done", "continue", "blocked", "needs_user", "paused", "budget_limited"]),
  reason: z.string(),
  nextInstruction: z.string().optional(),
  confidence: z.number().min(0).max(1),
  missingEvidence: z.array(z.string()).default([]),
  completedCriteria: z.array(z.string()).default([]),
  incompleteCriteria: z.array(z.string()).default([])
});
```

Rules:

* Be skeptical.
* Claims without validation are not enough.
* If tests/build/lint are required but not run, do not mark done.
* If plan checkboxes remain unchecked, do not mark done unless explicitly justified.
* If the next action requires user judgment, return `allow + needs_user`.
* If repeated failures happen, return `allow + blocked` or `allow + needs_user`.
* Never cause infinite loops.

### 3. TurnSummarizer

Purpose: update a human-readable session/work log from deltas.

Input:

* latest user prompt
* latest assistant message
* tool events since previous turn
* existing work log excerpt

Schema:

```ts
const TurnSummarySchema = z.object({
  userIntent: z.string(),
  workPerformed: z.array(z.string()),
  decisions: z.array(z.string()),
  filesRead: z.array(z.string()),
  filesChanged: z.array(z.string()),
  commandsRun: z.array(z.string()),
  validationResults: z.array(z.string()),
  errorsSeen: z.array(z.string()),
  currentStatus: z.enum(["in_progress", "blocked", "done", "unclear"]),
  nextStep: z.string()
});
```

Use cheap model or deterministic extraction where possible.

### 4. ContextSummarizer

Purpose: maintain compact current-state summaries and handoff.

Schema:

```ts
const ContextSummarySchema = z.object({
  summary: z.string(),
  completedWork: z.array(z.string()),
  currentState: z.string(),
  nextSteps: z.array(z.string()),
  blockers: z.array(z.string()),
  validationEvidence: z.array(z.string()),
  filesLikelyRelevant: z.array(z.string())
});
```

Writes:

* `.claude/goal/context-summary.md`
* `.claude/goal/handoff.md`

### 5. ContextGrader

Purpose: score context integrity and compaction readiness.

Core metric:

> Could a fresh coding agent continue correctly from the saved log and handoff alone?

Schema:

```ts
const ContextGradeSchema = z.object({
  score: z.number().min(0).max(100),
  intentPreservation: z.number().min(0).max(100),
  workAccounting: z.number().min(0).max(100),
  evidenceQuality: z.number().min(0).max(100),
  nextStepClarity: z.number().min(0).max(100),
  compactionReadiness: z.number().min(0).max(100),
  riskOfContextLoss: z.enum(["low", "medium", "high"]),
  missingCriticalContext: z.array(z.string()),
  staleOrContradictoryContext: z.array(z.string()),
  recommendedLogUpdate: z.string(),
  recommendedRehydrationText: z.string(),
  shouldInjectRehydration: z.boolean()
});
```

Run on:

* Stop when Claude claims done.
* PreCompact.
* PostCompact.
* Test/build failure.
* Large file-change batch.
* User correction/frustration.

### 6. FailureClassifier

Purpose: identify repeated failure patterns and decide when to pause.

Schema:

```ts
const FailureClassificationSchema = z.object({
  failureType: z.enum([
    "test_failure",
    "build_failure",
    "missing_context",
    "bad_plan",
    "tooling_issue",
    "permission_issue",
    "needs_user_decision",
    "model_failure",
    "unknown"
  ]),
  diagnosis: z.string(),
  recommendedNextInstruction: z.string(),
  shouldPauseGoal: z.boolean()
});
```

### 7. JobOutputSummarizer

Purpose: summarize noisy bash output for Claude.

Schema:

```ts
const JobSummarySchema = z.object({
  status: z.enum(["passed", "failed", "timeout", "cancelled", "unknown"]),
  exitCode: z.number().nullable(),
  rootCause: z.string(),
  relevantLines: z.array(z.string()),
  recommendedNextAction: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
  rawLogs: z.object({
    stdout: z.string(),
    stderr: z.string()
  })
});
```

Rules:

* Find first meaningful root-cause failure, not every cascading error.
* Preserve paths and exact error snippets.
* Return compact summary and raw log paths.
* Never dump huge output into Claude context.

## Durable Artifacts

### `.claude/goal/state.json`

```json
{
  "id": "goal_...",
  "active": true,
  "paused": false,
  "status": "running",
  "objective": "...",
  "successCriteria": [],
  "currentCheckpoint": "...",
  "loopCount": 0,
  "maxLoops": 30,
  "failedValidationCount": 0,
  "repeatedInstructionCount": 0,
  "createdAt": "...",
  "updatedAt": "...",
  "lastEvaluation": null,
  "lastContextGrade": null
}
```

### `.claude/goal/plan.md`

Must be concise, concrete, and checkbox-based.

````md
# Goal Plan

## Objective

...

## Success Criteria

- [ ] ...
- [ ] ...

## Milestones

- [ ] ...
- [ ] ...

## Suggested Validation Commands

```bash
pnpm test
pnpm build
````

## Risks

* ...

````

### `.claude/goal/progress.md`

Mostly append-only.

```md
## 2026-05-09T00:00:00Z

### Completed

- ...

### Evidence

- ...

### Validation

- Command: `...`
- Result: pass/fail/unknown

### Decisions

- ...

### Next

- ...
````

### `.claude/goal/handoff.md`

This is the most important compaction artifact.

```md
# Goal Handoff

## Active Objective

...

## Current Status

...

## Must Preserve

- ...

## Completed

- ...

## Incomplete

- ...

## Current Blocker

...

## Next Instruction

...

## Validation Evidence

...

## Important Files

...

## Stale / Ignore

- ...

## Do Not Do

- Do not restart from scratch.
- Do not ignore previous validation failures.
- Do not claim completion without evidence.
```

### `.claude/goal/validation.md`

Track deterministic validation attempts.

### `.claude/goal/decisions.jsonl`

Append every Stop evaluation.

### `.claude/goal/context-grades.jsonl`

Append context integrity scores.

### `.claude/goal/model-failures.jsonl`

Append model timeout/failure/fallback records.

## Context Black-Box Recorder

Implement deterministic capture first. AI should improve logs, not be the only source of truth.

Per session, maintain:

```text
raw-hooks.jsonl
turns.jsonl
work-log.md
decisions.md
files-touched.json
commands-run.jsonl
test-results.jsonl
context-grades.jsonl
compact-snapshots.md
model-failures.jsonl
```

`raw-hooks.jsonl` is the audit trail.

`turns.jsonl` normalized record:

```json
{
  "session_id": "...",
  "turn_index": 12,
  "user_prompt": "...",
  "assistant_last_message": "...",
  "files_read": [],
  "files_written": [],
  "commands_run": [],
  "tests_run": [],
  "errors_seen": [],
  "decisions": [],
  "open_todos": [],
  "status": "in_progress",
  "created_at": "..."
}
```

`work-log.md` should answer:

* What did the user ask?
* What did Claude do?
* What changed?
* What failed?
* What is still open?
* What is the next step?

## Deterministic Probes

Implement evidence gathering without AI.

At minimum:

```bash
git status --short
git diff --stat
git diff --name-only
```

Also scan:

* unchecked checkboxes in `.claude/goal/plan.md`
* recent validation commands from tool logs
* repeated evaluator next instructions
* repeated failing commands
* changed files since goal start

Do not auto-run arbitrary commands by default.

Validation commands from planner should be suggested to Claude, not executed by daemon, unless config explicitly enables safe allowlisted execution.

## Bash Job Runner / Out-of-Band Command Broker

This is optional MVP-plus, but design the daemon so it fits naturally.

Purpose:

* Run noisy shell commands outside Claude Code context.
* Capture full stdout/stderr to files.
* Summarize compactly with Vercel AI SDK.
* Return only what Claude needs.

Example tools/commands:

```text
run_bash_job(command, cwd, purpose, max_runtime, summarize=true)
get_job_status(job_id)
get_job_summary(job_id)
read_job_output(job_id, stream, range/tail/grep)
cancel_job(job_id)
```

Claude-facing result:

```json
{
  "jobId": "job_20260509_001",
  "status": "failed",
  "exitCode": 1,
  "summary": "The test run failed because auth service mock is missing getSession(). First real failure is auth.spec.ts:44. Later failures are cascade.",
  "relevantLines": [
    "auth.spec.ts:44 TypeError: mockAuth.getSession is not a function",
    "Expected status 200, received 500"
  ],
  "rawLogs": {
    "stdout": ".codeforge/jobs/job_20260509_001/stdout.log",
    "stderr": ".codeforge/jobs/job_20260509_001/stderr.log"
  }
}
```

Security requirements for job runner:

* Allowlisted cwd roots.
* Timeout per job.
* Max output size before truncation/compression.
* Env scrubber.
* Deny obvious destructive commands by default:

  * `rm -rf /`
  * `sudo`
  * `chmod -R 777`
  * `curl | bash`
  * secrets path reads
* No public network binding.
* No model-generated command execution by default.
* Raw logs local only.

## Stop Loop Safety

Mandatory.

Prevent infinite Claude continuation loops.

Implement:

* `maxGoalLoops`
* `maxRepeatedInstructions`
* `maxFailedValidations`
* optional wall-clock timeout
* pause on permission/tooling issue
* allow stop on `needs_user`
* allow stop on `blocked`
* allow stop when daemon unavailable
* record daemon unavailable event

If daemon is unavailable:

* Append local error to decisions log if possible.
* Allow stop.
* Tell user daemon was unavailable.

The Stop hook must never trap Claude Code.

## Hook Output Style

Hook-injected text should be short, specific, and actionable.

Good block reason:

```text
Goal controller says this is not complete.

Missing:
- PLAN.md still has unchecked item: Add regression test for auth refresh
- No full validation command has passed

Next checkpoint:
Run the targeted auth test, fix failures, update .claude/goal/progress.md, then re-evaluate.
```

Bad block reason:

```text
Continue working on the goal.
```

## Security Requirements

Local-first only.

* Bind daemon to `127.0.0.1`.
* Do not expose daemon to LAN.
* Do not log secrets.
* Redact common token/env patterns.
* Do not auto-run destructive commands.
* Do not auto-run model-generated shell commands by default.
* Keep command execution deterministic and allowlisted if enabled.
* Store raw outputs locally only.
* Do not read `.env`, secrets files, SSH keys, or token stores unless user explicitly allows.
* Avoid hosted control over local shell unless auth is designed later.

## Implementation Order

### Phase 1: Skeleton

* CLI with `install`, `daemon`, `status`, `doctor`, `reset`.
* Local HTTP daemon.
* SQLite migrations.
* Config loading.
* Health endpoint.
* Logging.

### Phase 2: Claude Code Integration

* Generate Skill files.
* Generate hook scripts.
* Patch `.claude/settings.json` safely.
* Hook scripts append raw events and call daemon.
* Daemon unavailable behavior works.

### Phase 3: Context Black-Box Recorder

* Capture raw hooks.
* Normalize turns.
* Track files touched.
* Track commands run.
* Track validation-looking commands.
* Write work-log.md.

Start deterministic. Add AI summarization after the log pipeline exists.

### Phase 4: Basic `/goal`

* `/goal <objective>` creates state.
* `GoalPlanner` creates plan.
* `state.json`, `plan.md`, `progress.md` written.
* `/goal-status`, `/goal-pause`, `/goal-resume`, `/goal-clear` work.

### Phase 5: Stop Evaluator

* Stop hook calls daemon.
* Daemon gathers deterministic evidence.
* `GoalEvaluator` returns structured decision.
* Stop hook allows or blocks.
* Decisions persisted.
* Loop safety implemented.

### Phase 6: Improved Compaction

* `PreCompact` writes/updates `handoff.md`.
* `PostCompact` saves compact summary.
* `ContextGrader` compares compact summary against handoff.
* `SessionStart` rehydrates active goal context.

### Phase 7: AI Context Grading

* Turn summaries via Vercel AI SDK.
* Context grades on Stop/Compact/failure/user correction.
* Model fallback telemetry.
* Model failure trimming data.

### Phase 8: Optional Bash Job Runner

* `run_bash_job` endpoint.
* Job storage.
* stdout/stderr capture.
* timeout/cancel.
* compact model summary.
* read/search/tail job output.
* `/run-job` command.

## Testing Plan

Add fixture-based tests for:

* Config loading.
* SQLite migrations.
* Hook stdin parsing.
* Raw event append.
* Goal creation.
* Planner schema validation.
* Evaluator schema validation.
* Stop allow/block mapping.
* Daemon unavailable behavior.
* Paused goal allows stop.
* Cleared goal allows stop.
* Repeated instruction protection.
* Failed validation protection.
* Handoff generation.
* PostCompact grade behavior.
* SessionStart rehydration.
* Job output summarization.
* Redaction of secrets.

Use saved sample hook payloads as fixtures.

## Manual Smoke Test

```bash
codeforge goal install
codeforge goal daemon
codeforge goal doctor
```

Inside Claude Code:

```text
/goal add a README section documenting local dev setup and validate formatting
```

Expected:

1. Goal state created.
2. Plan generated.
3. Claude works normally.
4. Progress artifacts updated.
5. Stop hook evaluates.
6. If no validation evidence exists, Stop hook blocks with concrete next instruction.
7. Claude validates and updates progress.
8. Stop hook allows completion.
9. `codeforge goal status` shows completed goal.
10. Compaction creates handoff and resume rehydrates context.

Optional job runner smoke test:

```text
/run-job pnpm test
```

Expected:

* Daemon runs command.
* Raw stdout/stderr saved.
* Claude receives compact summary and paths.

## README Requirements

README must explain:

* What this tool does.
* What it does not do.
* Claude Code CLI remains the worker.
* Vercel AI SDK powers daemon intelligence.
* How `/goal` works.
* How Stop evaluation works.
* How context black-box recording works.
* How compaction/handoff/rehydration works.
* How command-output summarization works if implemented.
* How model fallback works.
* How to recover when daemon is down.
* How to pause/resume/clear a goal.
* Security defaults.
* Known limitations.

## Architecture Note Requirements

Create `.internal/goal-daemon-architecture.md` covering:

* Why daemon instead of heavy hooks.
* Why Vercel AI SDK instead of Claude Agent SDK for MVP.
* Why Claude Code remains the worker.
* State/artifact model.
* Hook lifecycle.
* Stop evaluation lifecycle.
* Compaction lifecycle.
* Job runner design.
* Security model.
* Future expansion path.

## Future Expansion Path

Do not implement now, but keep architecture compatible with:

* Session replay.
* Token/cost tracking.
* Multiple concurrent Claude Code sessions.
* Isolated worktree agents.
* Claude Agent SDK workers.
* GitHub issue/PR integration.
* Persistent project memory.
* Cross-session lesson extraction.

## Final Quality Bar

The MVP is successful when:

* I can install it into a repo.
* I can start the daemon.
* I can run `/goal <objective>` in Claude Code.
* Goal state persists outside Claude context.
* Raw hook events are logged.
* A readable work log is maintained.
* Claude cannot casually stop after claiming done without evidence.
* Stop hook gives a concrete next checkpoint.
* Compaction creates a durable handoff.
* Resuming after compaction rehydrates key context.
* Context grading can tell whether handoff/logs are sufficient for continuation.
* Large command output can be stored as artifacts and summarized if job runner is enabled.
* If daemon fails, Claude Code is not trapped.

Build the smallest robust version that proves this loop end-to-end.
