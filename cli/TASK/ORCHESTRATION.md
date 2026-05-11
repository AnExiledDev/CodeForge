# Goal Daemon — Agent Orchestration Plan

## Overview

This document defines how the orchestrator (Claude Code main thread) coordinates
a sequential pipeline of agents to implement the goal daemon feature across 5
sessions, with validation and drift detection after each.

**Branch:** `feat/goal-daemon` from `staging`
**Runtime:** sequential, no worktrees, single branch
**Rollback:** git commits after each validated wave

## Agent Layers

Every wave uses a three-layer pattern:

| Layer | Agent Type | Role | Mode |
|-------|-----------|------|------|
| **Implementer** | generalist (write-capable) | Write code per session TASK file | Read/Write |
| **Validator** | explorer (read-only) | Run tests, check acceptance criteria, verify behavior | Read-only |
| **Auditor** | architect (read-only) | Compare implementation against spec, classify drift | Read-only |

### Layer 1: Implementer

Receives:
- The session TASK file (full content, not just a path reference)
- The README.md decisions table
- Current file state of files it will modify (read by orchestrator before spawn)
- Accumulated context from previous waves (what was actually built)
- Explicit instruction: "implement exactly what the TASK file specifies"

Must NOT:
- Touch files outside its session's scope
- Add dependencies not listed in the TASK file
- Implement features from later sessions
- Skip tests listed in the TASK file

### Layer 2: Validator

Receives:
- The session TASK file's acceptance criteria (extracted as a checklist)
- The session TASK file's test list
- Explicit validation commands to run
- Instruction to also run `bun test` for full regression check

Produces a structured report:
```
## Validation Report — Session N

### Acceptance Criteria
- [x] Criterion 1 — PASS (evidence: ...)
- [ ] Criterion 2 — FAIL (evidence: ...)

### Tests
- [x] All session tests pass
- [x] All previous session tests pass (regression)
- [ ] Build succeeds (`bun build`)

### Issues Found
1. (description, severity, file, recommendation)
```

### Layer 3: Auditor

Receives:
- The session TASK file (full spec)
- The git diff of everything the implementer changed
- The validator's report
- Instruction to classify all drift

Produces a structured report:
```
## Drift Audit — Session N

### Files Changed
| File | Expected | Actual | Status |
|------|----------|--------|--------|
| src/daemon/server.ts | Create | Created | Conforming |
| src/utils/helpers.ts | — | Created | Drift (beneficial/harmful) |

### Drift Classification
- **Conforming**: changes match the TASK spec
- **Beneficial drift**: additions that improve the implementation
  - (description, justification, recommendation: keep/discuss)
- **Harmful drift**: changes that contradict spec or add unwanted complexity
  - (description, what's wrong, recommendation: revert/fix)

### Scope Violations
- Files modified outside session scope: (list)
- Dependencies added not in spec: (list)
- Features from future sessions implemented early: (list)

### Verdict: PROCEED / FIX REQUIRED / DISCUSS WITH USER
```

## Orchestrator Responsibilities

The orchestrator (main thread) does NOT delegate understanding. Between each
agent spawn, the orchestrator:

1. **Reads actual file state** — not just agent summaries
2. **Synthesizes reports** — combines validator + auditor findings
3. **Makes go/no-go decisions**:
   - All criteria pass + no harmful drift → commit and proceed
   - Criteria failures → spawn fix agent with specific instructions
   - Harmful drift → spawn fix agent to revert/correct
   - Beneficial drift → note for user, proceed
   - Ambiguous drift → surface to user, wait for decision
4. **Builds context bridge** — reads key files and includes their state in
   the next implementer's prompt
5. **Commits work** — creates a git commit after each validated wave
6. **Reports to user** — after each wave, brief summary of what was built,
   what passed, any drift, and what's next

## Pre-Flight Phase

Before Wave 1, spawn a pre-flight agent to verify the environment.

### Pre-Flight Agent (explorer, read-only)

**Check:**
1. `bun --version` works
2. `bun install` can reach the registry (dry-run or check connectivity)
3. Git status is clean enough to branch from
4. Current branch is `staging`
5. No uncommitted changes that would conflict
6. `.codeforge/` directory conventions are intact
7. Existing `bun test` passes (baseline)
8. Disk space sufficient for SQLite DB + deps

**On failure:** Surface blockers to user before starting any implementation.

**On success:** Orchestrator creates `feat/goal-daemon` branch from `staging`.

## Wave 1: Foundation (Session 1)

### Context to Pass

```
Source of truth: cli/TASK/01-foundation.md (included below in full)
Decisions: cli/TASK/README.md (included below in full)
```

Implementer also receives:
- Current content of `cli/src/index.ts` (will be modified)
- Current content of `cli/src/indexer/db.ts` (pattern to follow for SQLite)
- Current content of `cli/package.json` (no new deps this session)

### Implementer Prompt Shape

> You are implementing Session 1 (Foundation) of the CodeForge goal daemon.
>
> **Source of truth:** The TASK file below defines exactly what to build.
> Do not add features from later sessions. Do not skip anything listed.
>
> **Existing patterns to follow:**
> - Command registration: see index.ts (included below)
> - SQLite: see indexer/db.ts (included below) — use bun:sqlite, WAL mode
> - No new dependencies this session
>
> [Full content of 01-foundation.md]
> [Full content of README.md decisions section]
> [Current content of index.ts]
> [Current content of indexer/db.ts]
>
> Implement all files listed. Write all tests listed. Run `bun test` to verify.

### Validator Prompt Shape

> Validate Session 1 (Foundation) implementation.
>
> **Acceptance criteria** (from TASK file):
> [extracted checklist from 01-foundation.md]
>
> **Validation commands:**
> 1. `bun test` — all tests pass
> 2. `bun build` — build succeeds
> 3. `bun run src/index.ts -- goal daemon --help` — shows help
> 4. Start daemon, curl health endpoint, verify JSON response
> 5. Check SQLite DB created with expected tables
> 6. Check PID file behavior
>
> **Report format:** Use the structured report template above.
> Be specific about what passed and what failed. Include command output as evidence.

### Auditor Prompt Shape

> Audit Session 1 implementation for drift from spec.
>
> **Source of truth:** [Full content of 01-foundation.md]
>
> **What was changed:** [git diff output from orchestrator]
>
> **Validator report:** [validator's output]
>
> Compare every file created/modified against what the TASK file specifies.
> Classify any deviation. Use the drift report template above.
> Pay special attention to:
> - Files created that aren't in the TASK file
> - Dependencies added that aren't listed
> - Features from sessions 2-5 implemented early
> - Deviations from the existing CodeForge patterns

### Post-Wave 1

Orchestrator:
1. Read validator + auditor reports
2. If PROCEED: `git add` + `git commit -m "feat(cli): session 1 — goal daemon foundation"`
3. If FIX REQUIRED: spawn fix agent with specific issues, re-validate
4. Brief user on results

## Wave 2a: Goal State Layer (Session 2)

### Context to Pass

Everything from Wave 1 plus:
- Current content of files created in session 1 (server.ts, routes.ts, db.ts, config.ts, schemas/goal.ts)
- Note: "Session 1 created the daemon server, DB, and config. You are adding goal CRUD and event recording on top of that foundation."

### Implementer Prompt Shape

> You are implementing Session 2 (Goal State Layer).
>
> **Source of truth:** [Full content of 02-goal-state.md]
> **Decisions:** [README.md decisions section]
>
> **What exists from Session 1:**
> [List files with brief description of their content — read by orchestrator]
> [Current content of key files: routes.ts, db.ts, schemas/goal.ts]
>
> Build on top of session 1's code. Do not rewrite session 1 files from scratch.
> Add routes to the existing routes.ts. Add schemas to the existing goal.ts.
>
> [Full content of 02-goal-state.md]

### Validator + Auditor

Same pattern. Validator runs session 2's acceptance criteria + `bun test` for regression.
Auditor checks session 2's diff against spec.

### Post-Wave 2a

Commit: `feat(cli): session 2 — goal state layer and event recording`

## Wave 2b: Install + Doctor (Session 3)

### Context to Pass

Everything from Waves 1 + 2a plus:
- Current content of `src/index.ts` (needs install + doctor command registration)
- Current content of `src/daemon/config.ts` (install reads config for port/paths)
- Note: "Sessions 1 and 2 built the daemon and goal state layer. You are adding the install command (generates hooks and skills into .claude/) and doctor command."

### Implementer Prompt Shape

> You are implementing Session 3 (Install + Doctor).
>
> **Source of truth:** [Full content of 03-install-doctor.md]
> **Decisions:** [README.md decisions section]
>
> **What exists from Sessions 1-2:**
> [File inventory with descriptions]
> [Current content of index.ts, config.ts]
>
> The install command generates files into .claude/hooks/ and .claude/skills/.
> It patches .claude/settings.json to register hooks.
> Follow the existing doctor pattern at src/commands/doctor/ for the goal doctor.
>
> [Full content of 03-install-doctor.md]

### Post-Wave 2b

Commit: `feat(cli): session 3 — goal install and doctor commands`

## Wave 3: AI Agent Layer (Session 4)

### Pre-Wave: Dependency Check

Before spawning the implementer, the orchestrator runs:
```bash
cd cli && bun add ai @ai-sdk/groq @openrouter/ai-sdk-provider zod
```

If this fails (network, registry), surface to user immediately. The implementer
cannot proceed without these packages.

### Context to Pass

Everything from previous waves plus:
- Current content of goal-manager.ts (planner integrates with goal creation)
- Current content of routes.ts (new evaluate-stop route)
- Current content of schemas/goal.ts (Zod schemas go here)
- Note: "This session adds AI dependencies and builds the planner and evaluator agents. Mock generateObject in tests — no real API calls."

### Implementer Prompt Shape

> You are implementing Session 4 (AI Agent Layer).
>
> **Source of truth:** [Full content of 04-ai-agents.md]
> **Decisions:** [README.md decisions section]
>
> **New dependencies (already installed):** ai, @ai-sdk/groq, @openrouter/ai-sdk-provider, zod
>
> **What exists from Sessions 1-3:**
> [File inventory]
> [Current content of routes.ts, goal-manager.ts, schemas/goal.ts, config.ts]
>
> Key constraints:
> - Mock generateObject() in all tests — no real API calls
> - Model router must handle missing API keys gracefully (no crash)
> - Evaluator timeout defaults to 15s, planner to 30s
> - All AI agent calls must have fallback behavior
>
> [Full content of 04-ai-agents.md]

### Post-Wave 3

Commit: `feat(cli): session 4 — AI agent layer with model router`

## Wave 4: Hook Integration + E2E (Session 5)

### Context to Pass

Everything from all previous waves plus:
- Current content of all daemon files (this session wires everything together)
- Current content of hook templates (this session finalizes them)
- Content of generated SKILL.md files
- Note: "This is the final integration session. Wire the Stop hook through the daemon evaluator. Build the end-to-end test. After this, the full loop should work."

### Implementer Prompt Shape

> You are implementing Session 5 (Hook Integration + End-to-End).
>
> **Source of truth:** [Full content of 05-hook-integration.md]
> **Decisions:** [README.md decisions section]
>
> **What exists from Sessions 1-4:**
> [Complete file inventory]
> [Current content of: evaluator agent, routes.ts, goal-manager.ts,
>  hook templates, evidence.ts]
>
> Key constraints:
> - Stop hook must NEVER trap Claude — default to allow on any error
> - Loop safety counters are mandatory pre-AI escape hatches
> - E2E test must mock AI agents but exercise the full HTTP flow
> - PostToolUse and UserPromptSubmit hooks are fire-and-forget (no blocking)
>
> [Full content of 05-hook-integration.md]

### Post-Wave 4

Commit: `feat(cli): session 5 — hook integration and stop evaluator`

## Wave 5: Final Integration Validation

No implementer. Single comprehensive validation agent.

### Final Validator Prompt Shape

> Run final integration validation for the complete goal daemon feature.
>
> **Full acceptance criteria:** [combined from all 5 TASK files]
>
> **Validation steps:**
>
> 1. **Build check:**
>    - `cd /workspaces/projects/CodeForge/cli && bun test` — all tests pass
>    - `cd /workspaces/projects/CodeForge/cli && bun build` — build succeeds
>    - No TypeScript errors
>
> 2. **Command registration:**
>    - `bun run src/index.ts -- goal --help` shows all subcommands
>    - `bun run src/index.ts -- goal daemon --help` shows options
>    - `bun run src/index.ts -- goal install --help` shows options
>    - `bun run src/index.ts -- goal status --help` shows options
>    - `bun run src/index.ts -- goal reset --help` shows options
>    - `bun run src/index.ts -- goal doctor --help` shows options
>
> 3. **Daemon lifecycle:**
>    - Start daemon in background
>    - Verify /health endpoint responds
>    - Verify /status endpoint responds
>    - Verify SQLite DB created with all tables
>    - Stop daemon via PID
>
> 4. **Goal lifecycle (via HTTP):**
>    - POST /goal/set creates goal
>    - GET /goal/current returns active goal
>    - POST /goal/pause pauses
>    - POST /goal/resume resumes
>    - POST /goal/clear clears
>    - Second POST /goal/set returns 409 while one is active
>
> 5. **Install output:**
>    - Run install command in temp directory
>    - Verify hook files created in .claude/hooks/
>    - Verify skill files created in .claude/skills/
>    - Verify settings.json patched correctly
>    - Verify re-run is idempotent
>
> 6. **File inventory:**
>    - List all new files created
>    - Verify no files outside cli/src/ and test directories
>    - Verify no unexpected dependencies in package.json
>
> 7. **Code quality:**
>    - No TODO/FIXME comments left behind
>    - No console.log debugging left in production code
>    - No hardcoded API keys or secrets
>    - Error handling present at all boundaries
>
> Report: structured pass/fail for each check with evidence.

### Final Auditor Prompt Shape

> Audit the complete goal daemon implementation against all 5 TASK files.
>
> [Full content of all 5 TASK files]
> [Complete git diff from branch creation to HEAD]
>
> Produce a comprehensive drift report covering all sessions.
> For each session, verify:
> 1. All files listed were created
> 2. No unlisted files were created
> 3. All acceptance criteria are addressed in code
> 4. No features from phase 2 (deferred) were implemented
> 5. Dependencies match what was specified
>
> Classify all drift. Produce final verdict.

## Fix Agent Protocol

When a validator or auditor identifies issues:

### For test failures:

> Fix the following test failure from Session N.
>
> **Failure:** [test name, error output]
> **File:** [file path]
> **Context:** [what the test is supposed to verify]
> **TASK spec:** [relevant section from TASK file]
>
> Fix the code to make the test pass. Do not modify the test unless
> the test itself has a bug. Do not change unrelated code.

### For harmful drift:

> The auditor found harmful drift in Session N implementation.
>
> **Issue:** [description]
> **File:** [file path]
> **Expected (from TASK):** [what the spec says]
> **Actual:** [what was implemented]
>
> Correct the implementation to match the TASK spec.
> Do not add or remove other functionality.

### For scope violations:

> The auditor found out-of-scope changes in Session N.
>
> **Files that shouldn't exist:** [list]
> **Changes to out-of-scope files:** [list]
>
> Remove or revert these changes. The session scope is defined in
> [TASK file] — only those files should be affected.

## Commit History (Expected)

After full execution, the branch should have these commits:

```
feat(cli): session 5 — hook integration and stop evaluator
feat(cli): session 4 — AI agent layer with model router
feat(cli): session 3 — goal install and doctor commands
feat(cli): session 2 — goal state layer and event recording
feat(cli): session 1 — goal daemon foundation
chore(cli): create feat/goal-daemon branch
```

Plus any fix commits from validator/auditor findings:
```
fix(cli): session N — [specific fix description]
```

## Orchestrator Checklist

Per-wave checklist the orchestrator follows:

```
Wave N:
  [ ] Read current state of files the implementer will modify
  [ ] Spawn implementer with full context (TASK file + file contents + decisions)
  [ ] Wait for implementer to complete
  [ ] Read key output files to verify they exist
  [ ] Spawn validator with acceptance criteria + validation commands
  [ ] Wait for validator report
  [ ] Spawn auditor with TASK spec + git diff + validator report
  [ ] Wait for auditor report
  [ ] Synthesize findings:
      [ ] All criteria pass?
      [ ] Any harmful drift?
      [ ] Any beneficial drift to note?
      [ ] Any regressions?
  [ ] If issues: spawn fix agent, re-validate
  [ ] If clean: commit with session-specific message
  [ ] Brief user on wave results
  [ ] Build context bridge for next wave
```

## Estimated Agent Spawns

| Wave | Implementer | Validator | Auditor | Fix (est.) | Total |
|------|------------|-----------|---------|------------|-------|
| Pre-flight | — | 1 | — | — | 1 |
| Wave 1 | 1 | 1 | 1 | 0-1 | 3-4 |
| Wave 2a | 1 | 1 | 1 | 0-1 | 3-4 |
| Wave 2b | 1 | 1 | 1 | 0-1 | 3-4 |
| Wave 3 | 1 | 1 | 1 | 0-1 | 3-4 |
| Wave 4 | 1 | 1 | 1 | 0-1 | 3-4 |
| Wave 5 | — | 1 | 1 | — | 2 |
| **Total** | **5** | **7** | **6** | **0-5** | **18-23** |

## Context Window Budget

Each agent gets a substantial prompt. Estimated token budgets:

- Implementer: ~4K (TASK file) + ~2K (README) + ~3K (existing file contents) = ~9K input
- Validator: ~2K (criteria) + ~1K (commands) = ~3K input
- Auditor: ~4K (TASK file) + ~5K (git diff) + ~2K (validator report) = ~11K input

Later waves have larger context (accumulated file state). Wave 4 implementer
may need ~15K input. This is within bounds for all agent types.

## Failure Modes

| Failure | Detection | Response |
|---------|-----------|----------|
| Implementer skips files | Auditor file inventory | Fix agent: create missing files |
| Tests fail | Validator test run | Fix agent: specific test fix |
| Build fails | Validator bun build | Fix agent: type/import errors |
| Out-of-scope changes | Auditor drift check | Fix agent: revert scope violations |
| Dependency install fails | Pre-wave 3 check | Surface to user, may need network fix |
| AI SDK import errors | Validator + build | Fix agent: correct import paths |
| Harmful drift | Auditor classification | Fix agent or user decision |
| Beneficial drift | Auditor classification | Note to user, proceed |
| Agent produces no output | Orchestrator timeout | Re-spawn with same prompt |
| Accumulated drift across waves | Wave 5 final audit | Fix agent or user decision |

## What This Plan Does NOT Cover

- Phase 2 features (context grading, compaction hooks, job runner, turn summarizer)
- PR creation (done manually after user reviews final state)
- Documentation updates (README, CLAUDE.md for cli/)
- Real-world smoke test with actual Claude Code + daemon running
- Model API key provisioning (user responsibility)
- Deployment or npm publish
