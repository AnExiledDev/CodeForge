# Session 1: Foundation

## Goal

Stand up the `codeforge goal` command group, a working `Bun.serve()` daemon
with SQLite, config loading, and a health endpoint. After this session,
`codeforge goal daemon` starts a server that responds to `/health`.

## Files to Create

| File | Purpose |
|------|---------|
| `src/commands/goal/daemon.ts` | `codeforge goal daemon [--detach] [--port]` command |
| `src/commands/goal/status.ts` | `codeforge goal status` — stub that queries `/status` |
| `src/commands/goal/reset.ts` | `codeforge goal reset [--yes]` — stub |
| `src/daemon/server.ts` | `Bun.serve()` HTTP server, signal handlers, PID file |
| `src/daemon/routes.ts` | Route dispatch: GET /health, GET /status |
| `src/daemon/db.ts` | SQLite open, WAL mode, migration runner |
| `src/daemon/config.ts` | Load `.codeforge/goal/config.json`, merge defaults |
| `src/schemas/goal.ts` | TypeScript interfaces for config, goal state, events |

## Files to Modify

| File | Change |
|------|--------|
| `src/index.ts` | Register `goal` command group + subcommands |

## Detailed Changes

### Command Group Registration (`src/index.ts`)

Follow the existing pattern exactly:

```typescript
const goal = program.command("goal").description("Goal daemon and lifecycle");
registerGoalDaemonCommand(goal);
registerGoalStatusCommand(goal);
registerGoalResetCommand(goal);
```

Install and doctor are session 3 — don't add them yet.

### Daemon Command (`src/commands/goal/daemon.ts`)

Options:
- `--port <port>` — default 17332 (avoid 17371 conflict if anything else uses it)
- `--detach` — fork to background, write PID file, redirect output to log
- `stop` subcommand or `--stop` flag — read PID file, send SIGTERM

Foreground mode:
- Import and call `startServer()` from `src/daemon/server.ts`
- Log startup banner to stdout: port, DB path, PID
- Handle SIGINT/SIGTERM for clean shutdown

Detach mode:
- Use `Bun.spawn()` to re-launch self with `--_foreground` internal flag
- Write PID to `.codeforge/goal/daemon.pid`
- Redirect stdout/stderr to `.codeforge/goal/logs/daemon.log`
- Exit parent immediately after confirming child is alive

### HTTP Server (`src/daemon/server.ts`)

Use `Bun.serve()` directly. No framework.

```typescript
export async function startServer(config: DaemonConfig): Promise<void> {
  const db = openGoalDatabase(config.dbPath);
  const server = Bun.serve({
    hostname: config.host,  // always "127.0.0.1"
    port: config.port,
    fetch(req) { return handleRequest(req, { db, config }); },
  });
  // Signal handlers for graceful shutdown
}
```

Route dispatch in `routes.ts` — simple URL pathname switch, not a router library.

### SQLite (`src/daemon/db.ts`)

Follow the `src/indexer/db.ts` pattern exactly:
- `openGoalDatabase(dbPath: string): Database`
- `PRAGMA journal_mode = WAL`
- `PRAGMA foreign_keys = ON`
- Inline SQL for table creation
- Export typed query functions

MVP tables (create all, but only `goals` and `goal_events` are used in session 1):

```sql
goals           — id, cwd, session_id, objective, status, timestamps, counters, state_json
goal_events     — id, goal_id, session_id, cwd, kind, created_at, payload_json
goal_evaluations — id, goal_id, decision, status, reason, evidence_json, model_info_json
```

Full schema from TASK.md section "SQLite Schema" — include `turns`, `tool_events`,
`compactions`, `context_grades`, `jobs`, `model_failures` tables too.
They cost nothing to create and avoid future migrations.

### Config (`src/daemon/config.ts`)

Default config shape:

```typescript
interface DaemonConfig {
  host: string;          // "127.0.0.1"
  port: number;          // 17332
  dbPath: string;        // ".codeforge/goal/daemon.db"
  logPath: string;       // ".codeforge/goal/logs/daemon.log"
  pidPath: string;       // ".codeforge/goal/daemon.pid"
  models: ModelConfig;   // provider/model pairs per role
  limits: LimitsConfig;  // maxGoalLoops, maxRepeatedInstructions, etc.
}
```

Load from `.codeforge/goal/config.json` if exists, deep-merge with defaults.
Config file is optional — sane defaults should work out of the box.

### Health Endpoint

`GET /health` returns:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 1234,
  "db": "connected",
  "pid": 12345
}
```

`GET /status` returns:

```json
{
  "daemon": "running",
  "port": 17332,
  "db": { "path": "...", "size": 1234 },
  "activeGoal": null,
  "uptime": 1234
}
```

## Acceptance Criteria

- [ ] `codeforge goal daemon` starts HTTP server on 127.0.0.1:17332
- [ ] `GET /health` returns 200 with status JSON
- [ ] `GET /status` returns 200 with daemon info
- [ ] SQLite DB created at `.codeforge/goal/daemon.db` with all tables
- [ ] `codeforge goal daemon --detach` forks to background, writes PID file
- [ ] `codeforge goal daemon stop` sends SIGTERM to PID, cleans up PID file
- [ ] `codeforge goal status` queries daemon and prints human-readable output
- [ ] `codeforge goal reset` prints stub message (full implementation in session 2)
- [ ] SIGINT/SIGTERM gracefully closes DB and server
- [ ] Daemon refuses to bind to non-loopback addresses

## Tests Needed

| Test | Type |
|------|------|
| Config loading: defaults when no file | Unit |
| Config loading: merge with partial file | Unit |
| Config loading: reject non-loopback host | Unit |
| DB open: creates tables, WAL mode enabled | Unit |
| DB open: idempotent (run twice, no error) | Unit |
| Server: /health returns 200 | Integration |
| Server: /status returns daemon info | Integration |
| Server: unknown route returns 404 | Integration |
| PID file: written on start, cleaned on stop | Integration |

Use temp directories for DB and config files in tests.
For integration tests, start server on random port, make fetch() calls, shut down.

## Risks

1. **`--detach` with Bun.spawn()** — Bun's spawn may not support full daemonization
   (detach from parent, new session). If it doesn't, fall back to documenting
   "run in a separate terminal" and defer proper daemonization.

2. **Port conflicts** — another process on 17332. Mitigate: config-driven port,
   clear error message on EADDRINUSE.

3. **DB path creation** — `.codeforge/goal/` may not exist. `mkdir -p` equivalent
   before opening DB (`mkdirSync` with `recursive: true`).

## What NOT to Do

- Do not add Express, Hono, or any HTTP framework. `Bun.serve()` is sufficient.
- Do not implement goal CRUD yet — that's session 2.
- Do not add install/doctor commands — that's session 3.
- Do not add AI/model dependencies yet — that's session 4.
- Do not create `.claude/` directory structures — that's session 3.
- Do not add the daemon to the Docker proxy preAction skip list yet — wait until
  we know whether the daemon should proxy or not.
