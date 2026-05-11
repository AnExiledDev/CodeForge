# Session 5: Hook Integration + End-to-End

## Goal

Wire everything together: Stop hook calls daemon evaluator, SessionStart
rehydrates active goals, PostToolUse records events, loop safety prevents
infinite continuation. After this session, the full MVP loop works end-to-end.

## Depends On

Session 3 (install — hook templates exist).
Session 4 (AI agents — evaluator + planner are callable).

## Files to Modify

| File | Change |
|------|---------|
| `src/daemon/routes.ts` | Finalize evaluate-stop route with full evidence pipeline |
| `src/daemon/evaluator.ts` | Stop evaluation orchestration (new file) |
| `src/daemon/goal-manager.ts` | Loop counter updates, repeated instruction detection |
| `src/daemon/templates/hooks/stop.ts` | Finalize hook output format |
| `src/daemon/templates/hooks/session-start.ts` | Finalize rehydration injection |

## Files to Create

| File | Purpose |
|------|---------|
| `src/daemon/evaluator.ts` | Orchestrates Stop evaluation: evidence → agent → decision |
| `tests/e2e/goal-loop.test.ts` | End-to-end: create goal → record events → evaluate stop |

## Detailed Changes

### Stop Evaluation Orchestrator (`src/daemon/evaluator.ts`)

This is the core of the MVP. It coordinates:
1. Load active goal from DB
2. Gather deterministic evidence (git, plan checkboxes, tool events)
3. Check loop safety (pre-AI escape hatches)
4. Call GoalEvaluator agent
5. Store evaluation result
6. Update goal counters
7. Return decision to hook

```typescript
interface EvaluateStopResult {
  decision: "allow" | "block";
  status: string;
  reason: string;
  nextInstruction?: string;
}

async function evaluateStop(
  db: Database,
  cwd: string,
  sessionId: string,
  hookPayload: Record<string, unknown>,
  modelRouter: ModelRouter,
): Promise<EvaluateStopResult>
```

**Pre-AI escape hatches (checked before calling model):**

These bypass the AI evaluator entirely for safety:

| Condition | Decision | Rationale |
|-----------|----------|-----------|
| No active goal | allow | Nothing to enforce |
| Goal is paused | allow + paused | User explicitly paused |
| Goal is cleared | allow | Goal no longer active |
| `loop_count >= maxGoalLoops` | allow + budget_limited | Safety valve |
| `repeated_instruction_count >= max` | allow + blocked | Infinite loop detection |
| `failed_validation_count >= max` | allow + needs_user | Needs human intervention |

**Repeated instruction detection:**

Track the last N `nextInstruction` values from evaluations. If the same instruction
appears 3+ times consecutively, increment `repeated_instruction_count`.

Comparison should be normalized (lowercase, trimmed, collapse whitespace).

### Loop Safety Counters

On every Stop evaluation:
1. Increment `loop_count` on the goal
2. If evaluator returns `block`, check if `nextInstruction` matches previous
3. If repeated, increment `repeated_instruction_count`
4. If evaluator returns `block` and validation command was suggested but failed,
   increment `failed_validation_count`

Reset `repeated_instruction_count` when instruction changes.

### Stop Hook Output Format

The hook script must output JSON that Claude Code's Stop hook protocol expects.

**Block response** (from hook stdout):

```json
{
  "decision": "block",
  "reason": "Goal controller: not complete.\n\nMissing:\n- Plan item unchecked: Add regression test for auth refresh\n- No validation command has passed\n\nNext:\nRun `bun test`, fix failures, update .claude/goal/progress.md."
}
```

**Allow response:**

```json
{
  "decision": "allow"
}
```

The `reason` field for blocks should be specific and actionable — include:
- Which plan items are unchecked
- What validation evidence is missing
- The concrete next instruction

### SessionStart Rehydration

When an active goal exists, SessionStart hook injects context into Claude:

```json
{
  "additionalContext": "## Active Goal\n\nObjective: {objective}\nStatus: {status}\nCurrent checkpoint: {checkpoint}\n\nRead `.claude/goal/plan.md` for the full plan.\nRead `.claude/goal/progress.md` for what's been done.\n\nDo not claim completion without validation evidence."
}
```

Keep injected context under 500 tokens. Claude can read the full files if needed.

If handoff.md exists (from a previous compaction), also inject:
```
Read `.claude/goal/handoff.md` for context from the previous session.
```

### PostToolUse Event Recording

The PostToolUse hook sends tool events to the daemon. The daemon should:
1. Insert into `tool_events` table
2. Detect validation-relevant commands (test, build, lint patterns)
3. Store exit codes and error excerpts for evaluator evidence

Validation command detection heuristics:
- Command contains: `test`, `build`, `lint`, `check`, `typecheck`, `tsc`
- Tool name is `Bash` and command matches above patterns

### Route Finalization

**`POST /goal/evaluate-stop`:**

Request body (from hook):
```json
{
  "cwd": "/path/to/project",
  "sessionId": "session_abc",
  "hookPayload": { /* raw Stop hook event */ }
}
```

Response:
```json
{
  "decision": "block",
  "status": "continue",
  "reason": "...",
  "nextInstruction": "...",
  "confidence": 0.85,
  "loopCount": 3,
  "maxLoops": 30
}
```

### End-to-End Test

Write a test that exercises the full loop without real AI:

1. Start daemon (test port)
2. POST /goal/set with objective → goal created, plan.md written
3. POST /events/tool with simulated tool events
4. POST /goal/evaluate-stop → should block (no validation evidence)
5. POST /events/tool with simulated passing test
6. POST /goal/evaluate-stop → should allow (evidence present)
7. Verify goal state transitions in DB
8. Verify events recorded
9. Shut down daemon

Mock the AI agents to return deterministic responses.

## Acceptance Criteria

- [ ] Stop hook calls daemon and correctly blocks/allows based on evaluation
- [ ] Stop hook returns allow when daemon is unreachable
- [ ] Stop hook returns allow when no active goal
- [ ] Stop hook respects loop_count safety valve
- [ ] Stop hook detects repeated instructions and allows stop
- [ ] Block reason includes specific unchecked plan items
- [ ] Block reason includes concrete next instruction
- [ ] SessionStart hook injects goal context when active goal exists
- [ ] SessionStart hook is no-op when no active goal
- [ ] PostToolUse hook records tool events to daemon
- [ ] Validation commands detected and flagged in tool events
- [ ] Loop counters update correctly on each evaluation
- [ ] End-to-end test passes: goal → work → block → evidence → allow
- [ ] Full `install → daemon → /goal → work → stop` smoke test documented

## Tests Needed

| Test | Type |
|------|------|
| evaluateStop: returns allow when no active goal | Unit |
| evaluateStop: returns allow when goal paused | Unit |
| evaluateStop: returns allow when loop_count >= max | Unit |
| evaluateStop: returns allow when repeated_instruction >= max | Unit |
| evaluateStop: calls AI evaluator when pre-checks pass | Unit |
| evaluateStop: increments loop_count | Unit |
| evaluateStop: detects repeated nextInstruction | Unit |
| evaluateStop: resets repeated count on new instruction | Unit |
| Validation detection: "bun test" detected | Unit |
| Validation detection: "npm run build" detected | Unit |
| Validation detection: "echo hello" not detected | Unit |
| Stop hook: parses stdin correctly | Unit |
| Stop hook: returns allow on fetch failure | Unit |
| Stop hook: returns block with reason on block decision | Unit |
| SessionStart hook: injects context for active goal | Unit |
| SessionStart hook: no output when no goal | Unit |
| Full loop: create → record → block → evidence → allow | E2E |

## Risks

1. **Stop hook latency** — the entire chain (hook process start → HTTP → evidence
   gather → AI model call → response) must complete before Claude Code times out.
   Current Claude Code Stop hook timeout is ~30 seconds. Budget:
   - Hook startup: ~30ms
   - HTTP to daemon: ~5ms
   - Evidence gathering: ~200ms (git commands)
   - AI model call: ~2-10s (Groq is fast)
   - Total: ~3-11s — within budget, but monitor.

2. **Stdin parsing in hooks** — Claude Code hook protocol sends JSON on stdin.
   If the format changes, hooks break silently. Mitigate: defensive parsing,
   log parse errors to `.codeforge/goal/logs/hook-errors.log`.

3. **Concurrent Stop evaluations** — if Claude fires multiple Stop events quickly,
   evaluator could run concurrently. Mitigate: use DB transaction for counter
   updates, or simple mutex in evaluator.

4. **Model response quality on free tiers** — free models may produce poor
   evaluation decisions (always allowing or always blocking). Mitigate: the
   pre-AI escape hatches handle the dangerous cases (infinite loops). Poor
   model quality degrades UX but doesn't break safety.

## What NOT to Do

- Do not implement PreCompact/PostCompact hooks — those are phase 2.
- Do not implement context grading — phase 2.
- Do not implement turn summarization — phase 2.
- Do not implement handoff.md writing — that requires compaction hooks.
  For MVP, handoff.md is a future artifact; SessionStart checks if it exists
  but doesn't require it.
- Do not add a web UI or dashboard.
- Do not make hooks do heavy processing — they are thin bridges to the daemon.
- Do not block on PostToolUse or UserPromptSubmit hooks — fire-and-forget.
- Do not allow the Stop hook to block indefinitely — enforce timeout and default
  to allow.

## Smoke Test Script

After all 5 sessions, this manual test should work:

```bash
# 1. Install hooks and skills
codeforge goal install

# 2. Start daemon
codeforge goal daemon

# 3. Verify health
codeforge goal doctor

# 4. In Claude Code, run:
#    /goal add a utility function that formats dates as ISO strings with tests

# 5. Claude works on the goal
# 6. When Claude tries to stop without running tests:
#    → Stop hook blocks: "Run bun test first"
# 7. Claude runs tests, updates progress
# 8. When Claude tries to stop again:
#    → Stop hook allows (validation evidence present)

# 9. Check final state
codeforge goal status
```
