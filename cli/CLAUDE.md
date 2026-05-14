# cli

TypeScript/Bun CLI (`codeforge`) for CodeForge development workflows — session search, plugin management, devcontainer control, and environment diagnostics.

Entry: `src/index.ts` — commander root; registers all subcommands and the container-proxy `preAction` hook.

## Key Files

- `src/index.ts` — program root; proxy middleware (auto-forwards to container when outside one)
- `src/commands/session/search.ts` — `codeforge session search`; boolean query, role/project/time filters
- `src/search/engine.ts` — JSONL streaming search engine; `SearchOptions`, `SearchResult`, `readLines`
- `src/search/query-parser.ts` — AND/OR/NOT AST query parser used by the engine
- `src/search/filter.ts` — `createFilter(FilterOptions)` predicate factory
- `src/schemas/session-message.ts` — JSONL message types (`SessionMessage`, `SearchableMessage`, extractors)
- `src/loaders/` — file-system loaders: `history-loader`, `session-meta`, `plan-loader`, `task-loader`, `plugin-loader`, `hooks-loader`, `settings-writer`
- `src/output/` — formatters keyed by domain: `text.ts`, `json.ts`, `stats.ts`, `session-list.ts`, `session-show.ts`, `plugin-*.ts`, etc.
- `src/utils/context.ts` — `isInsideContainer()`, `proxyCommand()` (docker exec)
- `src/utils/time.ts` — `parseRelativeTime()`, `parseTime()` used by all date-filtered commands
- `src/commands/doctor/index.ts` — `codeforge doctor`; parallel health checks, `--fix` mode

## Subdirectories

- `src/commands/` — one subdirectory per command group: `session/`, `task/`, `plan/`, `plugin/`, `hooks/`, `config/`, `index/`, `container/`, `mount/`, `doctor/`
- `src/search/` — query parsing, filtering, and JSONL stream engine
- `src/loaders/` — data access layer (reads Claude Code files from `~/.claude/`)
- `src/schemas/` — TypeScript interfaces for JSONL wire formats
- `src/output/` — rendering layer; formatters per domain and format (text/json/stats)
- `src/utils/` — shared utilities: context, docker, glob, time, platform, mitmproxy
- `src/indexer/` — codebase symbol index: `db.ts`, `extractor.ts`, `scanner.ts`, `folders.ts`
- `tests/` — bun test suites, one file per module area

## Dependencies

Imports from: `commander`, `@clack/prompts`, `chalk`, `@devcontainers/cli`
Used by: container package (ships the compiled binary); `codeforge` binary on PATH inside devcontainer

## Conventions

- Every command module exports a single `registerXxxCommand(parent: Command): void` function; registered in `src/index.ts`.
- Command actions wrap their body in `try/catch`; errors print `Error: <message>` to stderr and call `process.exit(1)`.
- Output format controlled by `--format text|json` option; color disabled via `chalk.level = 0` when `--no-color` is passed.
- Loaders live in `src/loaders/`; formatters live in `src/output/`; commands are thin orchestrators that call both.
- Use `Bun.file().stream()` (not `fs.readFile`) for JSONL streaming; see `readLines` in `engine.ts`.

## Build & Test

```
bun run build               # bundle to dist/codeforge.js (bun target)
bun run dev                 # run src/index.ts directly
bun test                    # run all tests
bun run build:binary        # compile self-contained binary
bun run build:binary:linux  # cross-compile for linux-x64
```
