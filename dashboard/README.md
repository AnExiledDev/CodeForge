# CodeForge Dashboard

Session analytics dashboard for Claude Code. Parses JSONL session files into a SQLite database and serves a Svelte 5 SPA for browsing sessions, conversations, plans, tasks, agents, and memory.

> **v0.1.0** — Ships with CodeForge v2.1.0.

## Quick Start

```bash
# Development — starts the Bun backend (port 7847) and Vite frontend (port 5173)
bun run dev

# Development — starts only the Vite frontend dev server
bun run dev:web

# Build the SPA for production
bun run build

# Preview the production build
bun run preview

# Run tests
bun test
```

Requires [Bun](https://bun.sh) >= 1.0.0.

## Architecture

The dashboard is a three-layer pipeline:

1. **Parser** (`src/parser/`) — Reads `~/.claude/` session JSONL files, detects projects, extracts messages/tokens/tool calls, and writes everything into a local SQLite database at `~/.codeforge/data/dashboard.db`.
2. **Server** (`src/server/`) — A `Bun.serve` HTTP server that exposes a REST API over the database, watches for file changes via SSE, and runs memory analysis.
3. **Web** (`src/web/`) — A Svelte 5 SPA built with SvelteKit's static adapter. Routes, components, and shared state live here.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| Frontend | Svelte 5, SvelteKit (static adapter) |
| Styling | TailwindCSS 4 |
| Charts | LayerChart (d3-scale) |
| Database | SQLite (bun:sqlite, WAL mode) |
| Markdown | marked + shiki |
| Build | Vite 8 |
| Language | TypeScript 5 |

## API Reference

All endpoints are defined in `src/server/routes/api.ts`.

### GET Endpoints

| Path | Description |
|------|-------------|
| `/api/projects` | List all projects |
| `/api/projects/:id` | Project detail |
| `/api/sessions` | List sessions (filterable by project, model, since; paginated) |
| `/api/sessions/:id` | Session detail (tokens, files touched, cost, agents) |
| `/api/sessions/:id/messages` | Session messages (supports incremental fetch via afterId) |
| `/api/sessions/:id/plan` | Plan associated with session |
| `/api/sessions/:id/context` | Context snapshots (memories, rules) for session |
| `/api/sessions/:id/tasks` | Tasks for the session's team |
| `/api/sessions/:id/agents` | Subagents spawned by session |
| `/api/analytics/global` | Global analytics (filterable by date range) |
| `/api/analytics/project/:id` | Per-project analytics |
| `/api/plans` | List all plans |
| `/api/plans/:slug/history` | Plan version history |
| `/api/tasks` | List all task teams |
| `/api/agents` | List all agents across sessions |
| `/api/context` | All context files (memories, rules) |
| `/api/search` | Full-text search across messages (query, project, role filters) |
| `/api/ingestion/status` | Parser ingestion status |
| `/api/memory/runs` | List memory analysis runs |
| `/api/memory/runs/:id` | Memory run detail (events, result) |
| `/api/memory/observations` | List observations (filterable by project, category, status) |
| `/api/memory/observations/:id/history` | Observation change history |
| `/api/memory/memories` | List approved memories |
| `/api/memory/stats` | Memory statistics |
| `/api/memory/stats-by-project` | Observation stats grouped by project |

### POST Endpoints

| Path | Description |
|------|-------------|
| `/api/memory/analyze` | Trigger memory analysis for a session |
| `/api/memory/maintain` | Trigger maintenance for a project |
| `/api/memory/analyze-project` | Trigger project-wide analysis |
| `/api/memory/observations/:id/approve` | Promote observation to memory |
| `/api/memory/observations/:id/dismiss` | Dismiss an observation |
| `/api/memory/memories/:id/revoke` | Revoke an approved memory |

## Database Schema

The SQLite database (`~/.codeforge/data/dashboard.db`) uses WAL mode. Core tables defined in `src/parser/db.ts`:

| Table | Purpose |
|-------|---------|
| `projects` | Detected project paths and names |
| `sessions` | One row per session — tokens, timestamps, git branch, parent/agent info |
| `messages` | Individual messages with role, tokens, model, and raw JSON |
| `messages_fts` | FTS5 virtual table for full-text search |
| `tool_calls` | Tool invocations extracted from assistant messages |
| `files_touched` | Files read/written/edited per session |
| `history_entries` | Session history with display text and project |
| `file_changes` | Write/edit operations with content diffs |
| `plan_snapshots` | Plan content captured at points in time |
| `context_snapshots` | CLAUDE.md, memory, and rule file snapshots |
| `file_snapshots` | Arbitrary file content snapshots |
| `subagents` | Agent spawns linked to parent sessions |
| `memory_runs` | Memory analysis run metadata and results |
| `observations` | Extracted observations with status lifecycle |
| `memories` | Promoted memories with category and confidence |
| `run_observations` | Join table: runs to observations |
| `observation_history` | Audit log of observation changes |

## Project Structure

```
dashboard/
  bin/codeforge-dashboard    # CLI entry point (bash)
  src/
    parser/                  # Session file parsing and database
      db.ts                  # Schema, migrations, connection management
      types.ts               # TypeScript interfaces for messages/sessions
      queries.ts             # All database query functions
    server/                  # Bun HTTP server
      index.ts               # Server entry point
      routes/api.ts          # REST API route handlers
      memory-analyzer.js     # AI-powered memory extraction
      memory-sync.js         # Sync memories to MEMORY.md files
    web/                     # Svelte 5 SPA
      routes/                # SvelteKit file-based routes
      lib/                   # Shared components and utilities
      app.html               # HTML template
  tests/
    parser/                  # Parser unit tests
    server/                  # API and server tests
  mockups/                   # Static HTML mockups for design validation
  svelte.config.js           # SvelteKit config (static adapter)
  package.json
```

## Design Decisions

- **Read-only** — The dashboard never writes to `~/.claude/` session files. All state lives in its own SQLite database.
- **Dark mode only** — No light theme. Simplifies the CSS and matches terminal-centric workflows.
- **Svelte 5 runes** — Uses `$state`, `$derived`, `$effect` instead of Svelte stores. Global `runes: true` is NOT set in `svelte.config.js` (LayerChart incompatibility).
- **Fork, don't import** — Patterns from `cli/` are forked into the dashboard. The CLI is never imported as a dependency.
- **ISO 8601 UTC** — All timestamps stored and displayed in UTC.
- **Static SPA adapter** — SvelteKit builds to a static `index.html` with client-side routing, served by the Bun backend.
- **Session ID prefix matching** — API endpoints accept partial session IDs and resolve them via prefix match.

## Testing

```bash
bun test
```

Tests live in `tests/` and cover:

| File | Coverage |
|------|----------|
| `tests/parser/analytics.test.ts` | Token analytics and aggregation |
| `tests/parser/cost.test.ts` | Cost estimation logic |
| `tests/parser/project-detector.test.ts` | Project path detection |
| `tests/parser/session-reader.test.ts` | JSONL session file parsing |
| `tests/server/api.test.ts` | API route handlers |
| `tests/server/event-bus.test.ts` | SSE event bus |
| `tests/server/file-snapshots.test.ts` | File snapshot capture |

## License

GPL-3.0 — see [LICENSE](../LICENSE.txt).
