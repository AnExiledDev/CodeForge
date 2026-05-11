# Session 3: Install + Doctor

## Goal

Implement `codeforge goal install` to generate hook scripts, Skill files, and
patch `.claude/settings.json`. Implement `codeforge goal doctor` to verify the
installation. After this session, a user can run install → doctor and get a
fully wired Claude Code environment.

## Depends On

Session 1 (daemon server, config).
Independent of session 2 (goal state layer).

## Files to Create

| File | Purpose |
|------|---------|
| `src/commands/goal/install.ts` | Install command — generates hooks, skills, patches settings |
| `src/commands/goal/doctor.ts` | Doctor command — checks installation health |
| `src/daemon/templates/hooks/stop.ts` | Stop hook template (calls daemon /goal/evaluate-stop) |
| `src/daemon/templates/hooks/session-start.ts` | SessionStart hook template (rehydrates goal) |
| `src/daemon/templates/hooks/post-tool-event.ts` | PostToolUse hook template (records events) |
| `src/daemon/templates/hooks/user-prompt.ts` | UserPromptSubmit hook template (records turns) |
| `src/daemon/templates/skills/goal.md` | `/goal <objective>` SKILL.md |
| `src/daemon/templates/skills/goal-status.md` | `/goal-status` SKILL.md |
| `src/daemon/templates/skills/goal-pause.md` | `/goal-pause` SKILL.md |
| `src/daemon/templates/skills/goal-resume.md` | `/goal-resume` SKILL.md |
| `src/daemon/templates/skills/goal-clear.md` | `/goal-clear` SKILL.md |
| `src/daemon/templates/settings-patch.ts` | Safe merge logic for settings.json hooks config |

## Files to Modify

| File | Change |
|------|--------|
| `src/index.ts` | Register install + doctor commands |

## Detailed Changes

### Install Command (`src/commands/goal/install.ts`)

Steps (in order):
1. Detect project root (cwd or `--project` flag)
2. Create directories: `.claude/hooks/`, `.claude/skills/goal*/`, `.codeforge/goal/`
3. Write hook scripts from templates
4. Write SKILL.md files from templates
5. Patch `.claude/settings.json` to register hooks
6. Create `.codeforge/goal/config.json` with defaults if missing
7. Print summary of everything created/modified

**Safety rules:**
- Never silently overwrite. If a file exists, compare content.
  If identical: skip with "(unchanged)" message.
  If different: show diff, create `.bak` backup, then write.
- Never delete files the user may have customized.
- Use `@clack/prompts` spinner for progress feedback.

**Hook registration in settings.json:**

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [{
          "type": "command",
          "command": "bun run .claude/hooks/goal-stop.ts"
        }]
      }
    ],
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [{
          "type": "command",
          "command": "bun run .claude/hooks/goal-session-start.ts"
        }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [{
          "type": "command",
          "command": "bun run .claude/hooks/goal-post-tool.ts"
        }]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [{
          "type": "command",
          "command": "bun run .claude/hooks/goal-user-prompt.ts"
        }]
      }
    ]
  }
}
```

**Settings merge strategy:**
- Load existing settings.json (if any)
- Deep-merge hooks array — append our hooks, don't replace existing ones
- If our hooks already exist (by command path match), update in place
- Write back with `JSON.stringify(settings, null, 2)`
- Use the existing `settings-writer.ts` pattern from loaders/

### Hook Script Templates

Each hook is a standalone TypeScript file that:
1. Reads JSON from stdin
2. Does minimal local work (extract relevant fields)
3. POSTs to daemon HTTP endpoint
4. Returns hook response JSON to stdout
5. Fails gracefully (if daemon unreachable: log warning, allow action)

**Stop hook** (`goal-stop.ts`):
- Read stop event from stdin
- POST to `http://127.0.0.1:{port}/goal/evaluate-stop`
- If daemon returns `block`: output `{ "decision": "block", "reason": "..." }`
- If daemon returns `allow`: output `{ "decision": "allow" }`
- If daemon unreachable: output `{ "decision": "allow" }` (never trap Claude)
- Timeout: 30 seconds (evaluator may call an AI model)

**SessionStart hook** (`goal-session-start.ts`):
- POST to `http://127.0.0.1:{port}/goal/current?cwd={cwd}`
- If active goal exists: inject goal context into Claude via hook response
- If no active goal: no-op

**PostToolUse hook** (`goal-post-tool.ts`):
- Extract tool name, file path, command, status from stdin
- POST to `http://127.0.0.1:{port}/events/tool`
- Fire-and-forget (don't block Claude)
- Timeout: 5 seconds

**UserPromptSubmit hook** (`goal-user-prompt.ts`):
- Extract prompt text, session info from stdin
- POST to `http://127.0.0.1:{port}/events/hook`
- Fire-and-forget
- Timeout: 5 seconds

### Skill Templates

Each SKILL.md should instruct Claude to interact with the goal daemon
via the hook system. Skills are instructions, not code.

**`/goal <objective>`** — tells Claude to:
1. Acknowledge the goal objective
2. Note that the goal daemon will track progress
3. Read `.claude/goal/plan.md` after it's generated
4. Follow the plan checkpoints
5. Update `.claude/goal/progress.md` as work is completed
6. Not claim completion without running validation commands

**`/goal-status`** — tells Claude to read `.claude/goal/state.json` and
`.claude/goal/progress.md` and summarize current state.

**`/goal-pause`**, **`/goal-resume`**, **`/goal-clear`** — tell Claude to
inform the user about the state change (daemon handles it via hooks).

### Doctor Command (`src/commands/goal/doctor.ts`)

Follow the existing `src/commands/doctor/` pattern exactly:
- Define check functions that return `CheckResult`
- Run checks in parallel where possible
- Format as text or JSON

Checks:
1. `.claude/hooks/goal-stop.ts` exists and is readable
2. `.claude/hooks/goal-session-start.ts` exists and is readable
3. `.claude/hooks/goal-post-tool.ts` exists and is readable
4. `.claude/hooks/goal-user-prompt.ts` exists and is readable
5. `.claude/skills/goal/SKILL.md` exists (and other skill files)
6. `.claude/settings.json` contains goal hook registrations
7. `.codeforge/goal/config.json` exists
8. Daemon reachable (GET /health succeeds)
9. DB writable (daemon /status reports db: connected)
10. `.claude/goal/` directory is writable
11. `GROQ_API_KEY` env var set (for evaluator model)
12. `OPENROUTER_API_KEY` env var set (for planner model)
13. `git` available in PATH

## Acceptance Criteria

- [ ] `codeforge goal install` creates all hook files in `.claude/hooks/`
- [ ] `codeforge goal install` creates all SKILL.md files in `.claude/skills/`
- [ ] `codeforge goal install` patches `.claude/settings.json` with hook config
- [ ] Existing settings.json entries preserved during patch
- [ ] Re-running install updates changed files, skips unchanged
- [ ] Changed files get `.bak` backup before overwrite
- [ ] `codeforge goal doctor` reports pass/fail for each check
- [ ] `codeforge goal doctor --format json` returns structured report
- [ ] Hook scripts handle daemon-unreachable gracefully
- [ ] Stop hook returns `allow` when daemon is down
- [ ] All generated hook scripts are syntactically valid TypeScript

## Tests Needed

| Test | Type |
|------|------|
| Install: creates hook files in temp dir | Integration |
| Install: creates skill files in temp dir | Integration |
| Install: patches empty settings.json | Unit |
| Install: merges with existing hooks in settings.json | Unit |
| Install: re-run is idempotent (no unnecessary changes) | Integration |
| Install: backs up changed files | Integration |
| Settings merge: preserves unrelated keys | Unit |
| Settings merge: appends to existing hooks array | Unit |
| Settings merge: updates existing goal hooks in place | Unit |
| Doctor: all checks pass in healthy environment | Integration |
| Doctor: reports daemon unreachable when not running | Integration |
| Doctor: reports missing hook files | Integration |
| Doctor: JSON output format correct | Unit |
| Hook stop template: parses stdin JSON | Unit |
| Hook stop template: returns allow on daemon-down | Unit |
| Hook session-start template: no-op with no active goal | Unit |

## Risks

1. **settings.json format changes** — Claude Code may change the hooks config
   structure. Mitigate: version-check in doctor, defensive parsing.

2. **Hook script runtime** — hooks run as separate processes. Each hook invocation
   pays Bun startup cost (~30ms). Acceptable for PostToolUse but monitor Stop
   hook total latency.

3. **Bun availability in hook context** — hooks run via `bun run`. If Bun isn't
   in PATH when Claude Code invokes hooks, they fail silently. Doctor should
   check this.

4. **Skill format stability** — Claude Code Skills are new. The SKILL.md format
   may evolve. Mitigate: keep skill content simple and text-only.

## What NOT to Do

- Do not implement the actual Stop evaluation logic — hooks just call the daemon.
  The daemon's evaluator is session 5.
- Do not add AI model calls in hooks — hooks are thin HTTP bridges.
- Do not generate `.claude/commands/` fallback files.
- Do not auto-start the daemon from the install command.
- Do not modify any files outside `.claude/` and `.codeforge/`.
- Do not hardcode the daemon port in hook scripts — read from config or
  use a well-known default with env var override.
