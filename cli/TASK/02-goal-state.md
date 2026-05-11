# Session 2: Goal State Layer

## Goal

Implement goal CRUD, state transitions, event recording, and artifact writing.
After this session, the daemon can create, query, pause, resume, and clear goals
via HTTP, and writes `.claude/goal/` artifacts to disk.

## Depends On

Session 1 (daemon server, DB, config, routes).

## Files to Create

| File | Purpose |
|------|---------|
| `src/daemon/goal-manager.ts` | Goal CRUD, state machine, DB queries |
| `src/daemon/event-recorder.ts` | Append raw events to JSONL + insert into DB |
| `src/daemon/evidence.ts` | Deterministic probes: git status, plan checkbox scan |

## Files to Modify

| File | Change |
|------|--------|
| `src/daemon/routes.ts` | Add goal endpoints |
| `src/commands/goal/status.ts` | Full implementation querying daemon |
| `src/commands/goal/reset.ts` | Full implementation with `--yes` flag |
| `src/schemas/goal.ts` | Add goal state interfaces, event types |

## Detailed Changes

### Goal Manager (`src/daemon/goal-manager.ts`)

State machine:

```
          set                 pause              resume
  (none) ───→ active ──────→ paused ──────────→ active
                │                                  │
                │ clear                            │ clear
                ▼                                  ▼
             cleared                            cleared
                │
                │ evaluate-stop (decision=allow, status=done)
                ▼
              done
```

Functions:
- `createGoal(db, { cwd, objective, sessionId })` → goal row + initial event
- `getActiveGoal(db, cwd)` → goal or null (only one active per cwd)
- `getGoal(db, goalId)` → goal
- `updateGoalStatus(db, goalId, status, updates)` → updated goal
- `pauseGoal(db, goalId)` → set paused=1
- `resumeGoal(db, goalId)` → set paused=0
- `clearGoal(db, goalId)` → set status=cleared, active=false
- `completeGoal(db, goalId)` → set status=done
- `incrementLoopCount(db, goalId)` → loop_count++
- `listRecentGoals(db, cwd, limit)` → for status display

Constraint: only one active goal per `cwd`. Creating a new goal when one is active
should return an error (user must clear/complete first).

### Event Recorder (`src/daemon/event-recorder.ts`)

Two outputs per event:
1. **JSONL append** to `.codeforge/goal/events.jsonl` — raw audit trail, no DB dependency
2. **DB insert** to `goal_events` table — queryable

Event kinds: `goal_created`, `goal_paused`, `goal_resumed`, `goal_cleared`,
`goal_completed`, `hook_event`, `tool_event`, `evaluation`, `error`.

```typescript
interface GoalEvent {
  goalId: string | null;
  sessionId: string | null;
  cwd: string;
  kind: string;
  payload: Record<string, unknown>;
}
```

JSONL writes should be non-blocking — use `Bun.write()` in append mode.
DB inserts should be transactional when batched.

### Evidence Gatherer (`src/daemon/evidence.ts`)

Deterministic probes (no AI). Used later by the evaluator (session 4/5).

```typescript
interface Evidence {
  gitStatus: string[];       // git status --short lines
  gitDiffStat: string[];     // git diff --stat lines
  gitDiffNames: string[];    // git diff --name-only lines
  uncheckedPlanItems: string[];  // unchecked [ ] lines from plan.md
  checkedPlanItems: string[];    // checked [x] lines from plan.md
  recentValidationCommands: string[];  // from tool_events (test/build/lint)
  changedFilesSinceGoalStart: string[];
}
```

Implement:
- `gatherEvidence(cwd, goalId, db)` → Evidence
- Shell out to git via `Bun.spawn()` for git commands
- Parse `.claude/goal/plan.md` for checkbox state
- Query `tool_events` for recent validation-looking commands

### Artifact Writing

When a goal is created, write these files:

**`.claude/goal/state.json`** — current goal snapshot (re-written on every state change)
**`.claude/goal/progress.md`** — append-only (initial entry on creation)

`plan.md` and `handoff.md` are written by the GoalPlanner (session 4) and
evaluator/compaction (session 5). Don't write them here — just create the
directory and leave them for later.

### Route Additions (`src/daemon/routes.ts`)

```
POST /goal/set          — create new goal (body: { cwd, objective, sessionId })
GET  /goal/current      — get active goal (query: ?cwd=<path>)
POST /goal/pause        — pause active goal (body: { cwd })
POST /goal/resume       — resume paused goal (body: { cwd })
POST /goal/clear        — clear/archive goal (body: { cwd })
POST /events/hook       — record raw hook event
POST /events/tool       — record tool event
```

All POST endpoints accept JSON body. All return JSON.
Error responses: `{ error: string, code: string }` with appropriate HTTP status.

### Status Command (full implementation)

`codeforge goal status` should:
1. Try to reach daemon at configured host:port
2. If reachable: show goal state, last evaluation, loop count, artifact paths
3. If unreachable: show "daemon not running" + how to start it
4. Support `--format json` for machine-readable output

### Reset Command (full implementation)

`codeforge goal reset`:
1. Prompt for confirmation (unless `--yes`)
2. POST /goal/clear to daemon
3. Optionally `--purge` to delete `.claude/goal/` artifacts (not just DB state)

## Acceptance Criteria

- [ ] `POST /goal/set` creates a goal, returns goal object, writes state.json
- [ ] `GET /goal/current?cwd=...` returns active goal or 404
- [ ] Only one active goal per cwd — second set returns 409
- [ ] `POST /goal/pause` sets paused, `POST /goal/resume` unsets
- [ ] `POST /goal/clear` marks goal cleared
- [ ] Events appended to both JSONL file and DB on every state change
- [ ] `gatherEvidence()` returns git status + plan checkbox state
- [ ] `codeforge goal status` shows goal info when daemon running
- [ ] `codeforge goal status` shows "not running" when daemon down
- [ ] `codeforge goal reset --yes` clears without prompt
- [ ] `.claude/goal/state.json` updated on every state transition
- [ ] `.claude/goal/progress.md` gets initial entry on goal creation

## Tests Needed

| Test | Type |
|------|------|
| createGoal: inserts row, returns goal | Unit |
| createGoal: rejects when active goal exists | Unit |
| getActiveGoal: returns null when none | Unit |
| getActiveGoal: returns goal when active | Unit |
| pauseGoal: sets paused flag | Unit |
| resumeGoal: unsets paused flag, only if paused | Unit |
| clearGoal: sets status=cleared | Unit |
| State transitions: invalid transitions rejected | Unit |
| Event recorder: appends to JSONL | Unit |
| Event recorder: inserts into DB | Unit |
| Evidence: parses plan.md checkboxes | Unit |
| Evidence: handles missing plan.md gracefully | Unit |
| Route /goal/set: returns 201 + goal | Integration |
| Route /goal/current: returns 404 when none | Integration |
| Route /goal/set: returns 409 on duplicate | Integration |
| Status command: formats text output | Unit |
| Status command: formats JSON output | Unit |

Fixtures: sample plan.md with mixed checkboxes, sample git status output.

## Risks

1. **JSONL append concurrency** — multiple hooks could write simultaneously.
   Mitigate: use file locking or route all writes through the daemon
   (hooks POST to daemon, daemon does the append).

2. **git commands in evidence** — may fail if not in a git repo.
   Mitigate: catch errors, return empty arrays.

3. **Large state.json rewrites** — atomic write (write to temp, rename).

## What NOT to Do

- Do not implement the GoalPlanner AI agent — that's session 4.
  Goal creation here stores the objective but doesn't generate a plan.
- Do not implement Stop evaluation — that's session 5.
- Do not write plan.md or handoff.md — the planner writes plan.md (session 4),
  the evaluator writes handoff.md (session 5).
- Do not add model/AI dependencies.
- Do not build the hook scripts — that's session 3.
