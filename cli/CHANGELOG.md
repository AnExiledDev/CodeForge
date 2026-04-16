# CodeForge CLI Changelog

## v0.2.0 — 2026-04-16

### New Command

- **`codeforge session tokens`** — Analyze thinking token usage across Claude Code sessions
  - Shows exact billed output tokens (from API) and visible content breakdown (thinking, text, tool chars)
  - **Thinking Density** table: % of turns with thinking, avg chars per thinking turn, session intensity breakdown (none/light/medium/heavy)
  - **Per-session breakdown**: turns with thinking, density %, avg chars per thinking turn
  - Filter by `--project`, `--model`, `--since`, `--until`
  - Output formats: text (colorized tables) and JSON (`--format json`)

### Purpose

Benchmarks thinking token costs to compare extended thinking behavior across models (e.g., Opus 4.5 vs 4.6). Since `output_tokens` is a combined total (thinking + text + tool_use) with no separate `thinking_tokens` field, this command provides visibility into thinking patterns through empirical measurement of visible content.

---

## v0.1.0 — 2026-03-14 (Experimental)

### Package Rename

- **`codeforge-dev-cli`** has been renamed to **`@coredirective/cf-cli`** on npm
- Install via: `npm install -g @coredirective/cf-cli`
- The old `codeforge-dev-cli` package name is deprecated

Initial release. Ships with CodeForge v2.1.1.

### Command Groups

- **`codeforge session`** — search, list, and show Claude Code session history
- **`codeforge task`** — search tasks
- **`codeforge plan`** — search plans
- **`codeforge plugin`** — manage plugins (list, show, enable, disable, hooks, agents, skills)
- **`codeforge config`** — show and apply configuration (`apply` deploys config to `~/.claude/`)
- **`codeforge index`** — build and search a codebase symbol index (build, search, show, stats, tree, clean)
- **`codeforge container`** — manage CodeForge devcontainers (up, down, rebuild, exec, ls, shell)

### Features

- Container proxy — commands auto-proxy into the running devcontainer when run from the host; use `--local` to bypass
- `--container <name>` flag to target a specific container
