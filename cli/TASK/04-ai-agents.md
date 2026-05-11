# Session 4: AI Agent Layer

## Goal

Set up Vercel AI SDK with Groq + OpenRouter providers, implement the model
router with fallback, and build the GoalPlanner and GoalEvaluator agents
with Zod structured output. After this session, the daemon can generate a
structured plan from an objective and make structured stop decisions.

## Depends On

Session 2 (goal state layer — goal manager, DB queries, evidence gatherer).

## Files to Create

| File | Purpose |
|------|---------|
| `src/daemon/agents/model-router.ts` | Provider init, role→model mapping, fallback chain |
| `src/daemon/agents/planner.ts` | GoalPlanner — objective → structured plan |
| `src/daemon/agents/evaluator.ts` | GoalEvaluator — evidence → allow/block decision |

## Files to Modify

| File | Change |
|------|--------|
| `src/daemon/routes.ts` | Wire planner into `POST /goal/set`, add `POST /goal/evaluate-stop` |
| `src/daemon/goal-manager.ts` | Call planner on goal creation, write plan.md |
| `src/daemon/config.ts` | Add model config types |
| `src/schemas/goal.ts` | Add Zod schemas for plan + evaluation |

## New Dependencies

Add to `cli/package.json`:

```json
{
  "ai": "^4",
  "@ai-sdk/groq": "^1",
  "@openrouter/ai-sdk-provider": "^0.4",
  "zod": "^3.23"
}
```

**Note:** Zod is a peer dependency of the AI SDK. Pin a compatible version.

## Detailed Changes

### Model Router (`src/daemon/agents/model-router.ts`)

```typescript
import { createGroq } from "@ai-sdk/groq";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

interface ModelRouter {
  planner(): LanguageModel;
  evaluator(): LanguageModel;
}
```

Config-driven model selection from `.codeforge/goal/config.json`:

```json
{
  "models": {
    "planner": ["openrouter:meta-llama/llama-4-scout", "openrouter:qwen/qwen3-30b-a3b"],
    "evaluator": ["groq:meta-llama/llama-4-scout-17b-16e-instruct", "openrouter:meta-llama/llama-4-scout"]
  }
}
```

Fallback logic:
1. Try models in configured order
2. Per-model timeout (configurable, default 15s for evaluator, 30s for planner)
3. On timeout or error: log failure to `model_failures` table, try next
4. If all fail: return a fallback result (planner: error; evaluator: allow-stop)
5. Never let model failure brick Claude Code

Provider construction:
- Parse `"groq:model-name"` → `createGroq()` + model ID
- Parse `"openrouter:model-name"` → `createOpenRouter()` + model ID
- API keys from env: `GROQ_API_KEY`, `OPENROUTER_API_KEY`

Record every call: provider, model, duration_ms, success/failure, fallback_used.

### GoalPlanner (`src/daemon/agents/planner.ts`)

Input:
- objective (string)
- cwd (string)
- optional context: package.json name/scripts, README excerpt, .claude/CLAUDE.md excerpt

Zod output schema:

```typescript
const GoalPlanSchema = z.object({
  objective: z.string(),
  successCriteria: z.array(z.string()),
  milestones: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    done: z.boolean().default(false),
    validation: z.string().optional(),
  })),
  suggestedValidationCommands: z.array(z.string()),
  risks: z.array(z.string()),
  nextCheckpoint: z.string(),
});
```

Use `generateObject()` from `ai` package with the Zod schema.

System prompt should:
- Emphasize concrete, verifiable criteria
- Prefer validation commands over vague "looks good"
- Keep plan small (3-7 milestones)
- Not invent repo details not present in evidence

After successful generation:
1. Store plan in goal's `state_json`
2. Write `.claude/goal/plan.md` as checkbox-formatted markdown
3. Update `.claude/goal/state.json` with plan details
4. Record `goal_planned` event

**plan.md format:**

```markdown
# Goal Plan

## Objective
{objective}

## Success Criteria
- [ ] {criterion 1}
- [ ] {criterion 2}

## Milestones
- [ ] {milestone 1}: {description}
- [ ] {milestone 2}: {description}

## Suggested Validation Commands
\`\`\`bash
{command 1}
{command 2}
\`\`\`

## Risks
- {risk 1}
```

### GoalEvaluator (`src/daemon/agents/evaluator.ts`)

Input (assembled by the evaluator orchestrator in session 5):
- goal state (objective, criteria, milestones)
- plan.md content
- progress.md content
- evidence (git status, diff, unchecked items, validation commands)
- loop counters (loop_count, failed_validation_count, repeated_instruction_count)
- last assistant message excerpt (if available from hook event)

Zod output schema:

```typescript
const GoalEvaluationSchema = z.object({
  decision: z.enum(["allow", "block"]),
  status: z.enum(["done", "continue", "blocked", "needs_user", "paused", "budget_limited"]),
  reason: z.string(),
  nextInstruction: z.string().optional(),
  confidence: z.number().min(0).max(1),
  missingEvidence: z.array(z.string()).default([]),
  completedCriteria: z.array(z.string()).default([]),
  incompleteCriteria: z.array(z.string()).default([]),
});
```

Use `generateObject()` with the Zod schema.

System prompt should:
- Be skeptical — claims without validation are insufficient
- If tests/build/lint required but not run, do not mark done
- If plan checkboxes remain unchecked, do not mark done unless justified
- If next action requires user judgment, return `allow + needs_user`
- If repeated failures (3+), return `allow + blocked` or `allow + needs_user`
- Never cause infinite loops — respect loop counters
- Give specific, actionable nextInstruction when blocking

### Route Changes

**`POST /goal/set`** (modify existing):
- After creating goal row, call GoalPlanner
- If planner succeeds: write plan.md, update state
- If planner fails: create goal anyway with no plan, log model failure
  (goal still works, Claude just doesn't get a structured plan)

**`POST /goal/evaluate-stop`** (new):
- Called by Stop hook
- Gather evidence via `gatherEvidence()`
- Read plan.md, progress.md, state.json
- Call GoalEvaluator
- Store evaluation in `goal_evaluations` table
- Return evaluation result to hook
- Update goal counters (loop_count++, etc.)

## Acceptance Criteria

- [ ] `@ai-sdk/groq` and `@openrouter/ai-sdk-provider` installed and importable
- [ ] Model router resolves provider from config string (e.g., "groq:model-name")
- [ ] Model router tries fallback on first model failure
- [ ] Model failures logged to `model_failures` table
- [ ] GoalPlanner generates valid GoalPlanSchema output
- [ ] GoalPlanner writes plan.md with checkbox format
- [ ] GoalEvaluator generates valid GoalEvaluationSchema output
- [ ] GoalEvaluator respects loop safety counters
- [ ] POST /goal/set creates goal + generates plan
- [ ] POST /goal/set succeeds even if planner model fails
- [ ] POST /goal/evaluate-stop returns evaluation JSON
- [ ] All model calls respect configured timeout
- [ ] Missing API keys produce clear error (not crash)

## Tests Needed

| Test | Type |
|------|------|
| Model router: parses "groq:model-name" correctly | Unit |
| Model router: parses "openrouter:model-name" correctly | Unit |
| Model router: returns fallback model when first unavailable | Unit |
| Model router: logs failure on model error | Unit |
| GoalPlanner: schema validates known-good output | Unit |
| GoalPlanner: writes plan.md in correct format | Unit |
| GoalEvaluator: schema validates known-good output | Unit |
| GoalEvaluator: returns allow when loop_count >= maxLoops | Unit |
| GoalEvaluator: returns allow when paused | Unit |
| Evaluate-stop route: returns evaluation JSON | Integration |
| Evaluate-stop route: returns allow when no active goal | Integration |
| Goal set route: creates goal + plan | Integration |
| Goal set route: succeeds without plan on model failure | Integration |

**Test strategy for AI calls:** Mock the `generateObject` function from `ai` package.
Do not make real model calls in tests. Use fixture responses that match the Zod schemas.

## Risks

1. **Groq/OpenRouter API key management** — keys must be in env. If missing,
   daemon should start but model calls fail gracefully with clear errors.
   Do not crash on missing keys.

2. **Rate limits on free tiers** — Groq free tier has requests-per-minute limits.
   Mitigate: model router should handle 429 responses as retryable failures
   and fall back to next model.

3. **Zod schema validation failures** — model may return output that doesn't match
   schema. `generateObject()` handles this with retries internally, but set a max
   retry count. On persistent failure, log and return graceful fallback.

4. **AI SDK version compatibility** — Vercel AI SDK moves fast. Pin versions in
   package.json. Document tested versions.

5. **Evaluator latency** — Stop hook blocks Claude while waiting. The 15s default
   timeout should be enforced strictly. If evaluator times out, default to allow.

## What NOT to Do

- Do not implement the full Stop hook → daemon → evaluator flow here.
  This session builds the *agents*. Session 5 wires them into the hook lifecycle.
- Do not add TurnSummarizer, ContextSummarizer, ContextGrader, or FailureClassifier.
  Those are phase 2.
- Do not add JobOutputSummarizer — job runner is deferred.
- Do not make real API calls in tests — mock `generateObject`.
- Do not hardcode model names — always read from config with defaults.
- Do not add streaming — `generateObject()` returns complete structured output.
