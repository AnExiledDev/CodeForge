---
name: team
description: >-
  Guides agent team orchestration with TeamCreate, parallel teammate
  spawning, task coordination, specialist agent selection, and
  --teammate-mode configuration for concurrent workstreams. USE WHEN
  the user asks to "spawn a team", "create a team of agents", "use a
  swarm", "work in parallel", "coordinate multiple agents", "split this
  across agents", "team up", or works with TeamCreate, SendMessage, and
  multi-agent workflows. DO NOT USE for single-agent sequential tasks
  where parallelism adds no value — a team requires 3+ independent
  workstreams.
version: 0.2.0
disable-model-invocation: true
---

# Agent Team Orchestration

## Mental Model

A team is a group of specialist agents working in parallel under a lead (you). Each teammate runs independently with its own context — they share a task list but not conversation history. The lead decomposes work into parallel streams, spawns specialists, assigns tasks, and coordinates integration.

Teams add value only when work can be parallelized. If every task depends on the previous one, a single agent is faster. The threshold: **3+ independent workstreams** that can run concurrently.

```
Lead (you)
├── TeamCreate         → creates the team
├── TaskCreate (×N)    → defines work units
├── Task (×N)          → spawns specialist teammates
├── TaskUpdate (×N)    → assigns tasks to teammates
├── SendMessage        → coordinates during execution
└── TeamDelete         → cleans up after completion
```

---

## Two Modes

Parse `$ARGUMENTS` for an optional `--now` flag to determine behavior:

| Input | Mode | Behavior |
|-------|------|----------|
| `/team refactor the auth module` | Guidance | Absorb team knowledge, propose a plan, discuss with user |
| `/team --now refactor the auth module` | Immediate | Create team, spawn agents, start work without waiting |
| `/team` | Guidance | Ask the user what the team should accomplish |

Strip `--now` from the purpose string before using it. Everything remaining is `<PURPOSE>`.

### Guidance Mode (default — no `--now`)

Inject the knowledge in this skill into context. **Do not force immediate action.** Analyze the purpose, propose a team composition, and discuss the approach with the user before acting. Use your judgment about when to create the team.

### Immediate Mode (`--now` flag present)

Act now without waiting for further input:

1. **Analyze purpose** — determine workstreams and specialist roles needed
2. **Create team** — `TeamCreate` with a kebab-case name derived from purpose
3. **Create tasks** — `TaskCreate` for each work unit with dependencies via `TaskUpdate`
4. **Spawn teammates** — `Task` with `team_name`, specialist `subagent_type`, descriptive `name`
5. **Assign tasks** — `TaskUpdate` with `owner` set to each teammate's name
6. **Coordinate** — monitor via `TaskList`, message via `SendMessage`
7. **Shutdown** — `shutdown_request` to all teammates, then `TeamDelete`

---

## Team Lifecycle

### 1. Create the Team

```
TeamCreate:
  team_name: "auth-refactor"     # kebab-case, descriptive
  description: "Refactor auth module for OAuth2 support"
```

One team per lead session. No nested teams.

### 2. Create Tasks

Each task should be independently completable by one agent:

```
TaskCreate:
  subject: "Write unit tests for OAuth2 flow"          # imperative
  description: "Full context the assignee needs..."     # self-contained
  activeForm: "Writing OAuth2 unit tests"               # present continuous
```

Set ordering constraints with `TaskUpdate`:
- `addBlockedBy: ["1"]` — this task waits for task 1
- `addBlocks: ["3"]` — task 3 waits for this task

### 3. Spawn Teammates

Each teammate is spawned via the `Task` tool with `team_name`:

```
Task:
  team_name: "auth-refactor"
  subagent_type: "agent-system:test-writer"   # specialist agent type
  name: "test-writer"                            # used for messaging and assignment
  prompt: "All context needed for the work..."   # teammates have NO prior history
```

**Critical:** Teammates do not inherit your conversation. The spawn `prompt` must include every piece of context the teammate needs — file paths, requirements, constraints, conventions.

### 4. Assign Tasks

```
TaskUpdate:
  taskId: "2"
  owner: "test-writer"    # matches the teammate's name
```

### 5. Coordinate

- **Check progress:** `TaskList` shows all tasks with status and owner
- **Direct message:** `SendMessage` with `type: "message"` and `recipient: "test-writer"`
- **Broadcast:** `SendMessage` with `type: "broadcast"` — use ONLY for critical team-wide issues
- **Idle is normal:** Teammates go idle after each turn. This is expected. Send a message to wake them.
- **Quality gate hooks:** TeammateIdle and TaskCompleted hooks run automatically. TeammateIdle checks for incomplete tasks (exit 2 → teammate keeps working); TaskCompleted runs the test suite (exit 2 → task stays open). See agent-system plugin hooks.

**In-process mode keyboard shortcuts:**

| Shortcut | Action |
|----------|--------|
| `Shift+Down` | Cycle through teammates |
| `Ctrl+T` | Toggle task list |
| `Enter` | View a teammate's session |
| `Escape` | Interrupt teammate's current turn |

> **Tip:** Use `claude --teammate-mode in-process` for per-session display mode override. Configure permanently via `teammateMode` in settings.json.

### 5a. Plan Approval

When `CLAUDE_CODE_PLAN_MODE_REQUIRED` is `true` (current setting), teammates run in read-only plan mode until the lead approves their plan.

**Workflow:**
1. Teammate enters plan mode → creates an implementation plan
2. Lead receives `plan_approval_request` message with the plan
3. Lead reviews the plan and sends `plan_approval_response` (approve or reject)
4. On approval → teammate exits plan mode and implements
5. On rejection → teammate stays in plan mode, revises, resubmits

**Influencing plans:** Include criteria in the spawn `prompt` to shape what the lead should look for (e.g., "only approve plans that include test coverage", "reject plans that modify shared utilities without coordination").

### 6. Shutdown

When all tasks are complete:

1. Send `shutdown_request` to each teammate via `SendMessage`
2. Wait for confirmations
3. `TeamDelete` to remove team and task directories
4. Report results to the user

---

## Specialist Agent Types

Choose the agent whose domain matches the work. **Generalist is a last resort.**

| Agent Type | Domain | Capabilities |
|-----------|--------|-------------|
| `researcher` | Codebase & web research | Read-only |
| `test-writer` | Write test suites | Read + Write + Bash |
| `refactorer` | Safe code transformations | Read + Write + Bash |
| `documenter` | README, API docs, docstrings | Read + Write |
| `migrator` | Framework upgrades, version bumps | Read + Write + Bash |
| `security-auditor` | OWASP audit, secrets scan | Read-only |
| `git-archaeologist` | Git history investigation | Read-only + Bash |
| `dependency-analyst` | Outdated/vulnerable deps | Read-only + Bash |
| `spec-writer` | Requirements & acceptance criteria | Read-only |
| `perf-profiler` | Profiling & benchmarks | Read-only + Bash |
| `debug-logs` | Log analysis & diagnostics | Read-only + Bash |
| `architect` | Implementation planning | Read-only |
| `explorer` | Fast codebase search | Read-only |
| `generalist` | Multi-step tasks (last resort) | All tools |
| `bash-exec` | Command execution | Bash only |

Prefix with `agent-system:` when spawning (e.g., `agent-system:test-writer`).

---

## Use Cases

**Parallel code review** — split review criteria into independent domains (security, performance, test coverage). Each reviewer focuses on one lens, reducing blind spots.

**Competing hypotheses** — adversarial investigation where teammates explore different theories about a bug or design decision. Each builds evidence for their hypothesis; lead synthesizes findings.

**Cross-layer coordination** — frontend, backend, and tests each owned by a different teammate. Clear file ownership prevents conflicts; integration points are managed by the lead.

**Research sweep** — parallel investigation of libraries, APIs, or approaches. Each researcher covers one option; lead compares findings and makes the selection.

---

## Team Composition Examples

| Purpose | Recommended Team |
|---------|-----------------|
| Feature build | `researcher` + `test-writer` + `documenter` |
| Security hardening | `security-auditor` + `dependency-analyst` |
| Codebase cleanup | `refactorer` + `test-writer` |
| Migration project | `researcher` + `migrator` |
| Performance work | `perf-profiler` + `refactorer` |
| Full-stack feature | `architect` + `generalist` (backend) + `generalist` (frontend) + `test-writer` |
| Code audit | `security-auditor` + `dependency-analyst` + `perf-profiler` |
| Documentation sprint | `researcher` + `documenter` |

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Instead |
|-------------|-------------|---------|
| More than 5 teammates | Coordination overhead outweighs parallelism | Limit to 2–5, matching actual parallel workstreams |
| Same-file edits by two agents | Merge conflicts are unrecoverable | Assign file ownership — one agent per file |
| Sequential-only work | Team adds overhead with zero parallel benefit | Use a single agent |
| Generalist everywhere | Specialists carry domain knowledge and safety hooks | Pick the specialist whose domain matches |
| Empty spawn prompts | Teammates have no prior context | Include all requirements, file paths, conventions |
| Skipping shutdown | Orphaned agents consume resources | Always send `shutdown_request` + `TeamDelete` |
| Broadcasting for routine updates | Each broadcast = N messages (one per teammate) | Use direct `message` to specific teammates |

---

## Best Practices

- **Give teammates enough context** — they don't inherit conversation history. The spawn `prompt` must be self-contained: include file paths, requirements, constraints, and project conventions.
- **Size tasks appropriately** — too small = coordination overhead exceeds benefit; too large = work too long without check-ins. Aim for self-contained units producing clear deliverables, roughly 5-6 tasks per teammate.
- **Wait for teammates to finish** — leads sometimes start implementing work that teammates are handling. If you notice this, redirect yourself to monitoring and coordination.
- **Start with research and review** — for first-time team use, prefer tasks with clear boundaries that don't require code changes: reviewing PRs, researching libraries, investigating bugs.
- **Monitor and steer** — check progress via `TaskList`, redirect failing approaches, synthesize findings. Unattended teams risk wasted effort.
- **Avoid file conflicts** — break work so each teammate owns different files. Agents with `isolation: worktree` (test-writer, refactorer, documenter, migrator) get automatic file isolation via git worktrees.

---

## Limitations

- **No session resumption** — `/resume` does not restore in-process teammates. Plan team work to complete in one session.
- **Task status can lag** — teammates sometimes fail to mark tasks complete. Use `TaskList` to verify and `SendMessage` to prompt updates.
- **One team per session** — clean up the current team (`TeamDelete`) before starting a new one.
- **No nested teams** — teammates cannot create teams (TeamCreate/TeamDelete are disallowed for team members).
- **Lead is fixed** — leadership cannot be promoted or transferred during a session.
- **Permissions set at spawn** — all teammates inherit the lead's permission mode at spawn time.
- **Split panes require tmux or iTerm2** — in-process mode uses the terminal; external split-pane workflows need tmux or iTerm2 with `it2` CLI.

---

## Tool Reference

| Tool | Purpose | Key Parameters |
|------|---------|---------------|
| `TeamCreate` | Create the team | `team_name`, `description` |
| `Task` | Spawn teammate into team | `team_name`, `subagent_type`, `name`, `prompt` |
| `TaskCreate` | Add task to shared list | `subject`, `description`, `activeForm` |
| `TaskUpdate` | Assign, depend, complete | `taskId`, `owner`, `status`, `addBlockedBy` |
| `TaskList` | View all tasks and status | (none) |
| `TaskGet` | Read full task details | `taskId` |
| `SendMessage` | Communicate with teammates | `type`, `recipient`, `content`, `summary` |
| `TeamDelete` | Clean up after completion | (none) |

---

## Ambiguity Policy

- If `$ARGUMENTS` is empty (no purpose provided), ask: "What should the team accomplish?"
- If the purpose maps to a single workstream with no parallelism, advise against a team and offer to do the work directly.
- If unsure which specialists to pick, present 2–3 composition options with trade-offs and let the user choose.
- If the purpose is vague ("make the app better"), ask for specifics before composing a team.
- If a teammate reports a blocker, attempt to resolve it yourself or reassign the task before escalating to the user.
- In immediate mode, default to the most natural team composition. If genuinely ambiguous, fall back to guidance mode and ask.
