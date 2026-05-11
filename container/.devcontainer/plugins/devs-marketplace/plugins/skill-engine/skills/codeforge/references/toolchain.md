# Toolchain Reference

## Languages & Runtimes

| Tool | Binary | Purpose |
|------|--------|---------|
| Python 3 | `python3` | General-purpose scripting, AI/ML |
| Node.js (LTS) | `node` | JavaScript runtime |
| Go | `go` | Compiled systems language |
| Rust | `rustc`, `cargo` | Systems programming |
| Bun | `bun` | Fast JS/TS runtime, package manager, test runner |

## Package Managers

| Tool | Binary | Purpose |
|------|--------|---------|
| npm | `npm` | Node.js packages |
| pip | `pip` | Python packages (prefer uv) |
| uv | `uv` | Fast Python package manager and resolver |
| bun | `bun install` | Bun/Node packages |
| cargo | `cargo` | Rust crates |

## Dev Tools

| Tool | Binary | Purpose |
|------|--------|---------|
| gh | `gh` | GitHub CLI (issues, PRs, repos, auth) |
| docker | `docker` | Container management (Docker-in-Docker) |
| git | `git` | Version control |
| jq | `jq` | JSON processing |
| curl | `curl` | HTTP requests |
| tmux | `tmux` | Terminal multiplexer (required for agent teams) |

## Formatters

| Tool | Binary | Formats |
|------|--------|---------|
| biome | `biome` | JS, TS, JSON, CSS |
| ruff | `ruff format` | Python |
| shfmt | `shfmt` | Shell scripts |
| dprint | `dprint` | Markdown, TOML, Dockerfile |

## Linters

| Tool | Binary | Lints |
|------|--------|-------|
| biome | `biome lint` | JS, TS |
| ruff | `ruff check` | Python |
| shellcheck | `shellcheck` | Shell scripts |
| hadolint | `hadolint` | Dockerfiles |

## Code Intelligence

| Tool | Binary | Purpose |
|------|--------|---------|
| ast-grep | `sg` | Structural code search and transform (syntax-aware) |
| tree-sitter | `tree-sitter` | Parse trees, syntax extraction |
| Pyright | `pyright` | Python type checking |

## AI Tools

| Tool | Binary | Purpose |
|------|--------|---------|
| Claude Code | `claude` | AI coding assistant (primary) |
| codeforge | `codeforge` | Container management CLI (doctor, config, sessions) |
| Codex | `codex` | OpenAI Codex CLI agent |
| Hermes | `hermes` | Nous Research agent CLI |
| agent-browser | `agent-browser` | Headless Chromium (Playwright-based) |
| RTK | `rtk` | Token compression proxy (transparent, auto-applied) |

## Preferred Tool for Common Tasks

| Task | Use | Not |
|------|-----|-----|
| Structural code search | `sg` (ast-grep) | regex grep |
| Python formatting | `ruff format` | black, autopep8 |
| Python linting | `ruff check` | pylint, flake8 |
| JS/TS formatting | `biome format` | prettier |
| JS/TS linting | `biome lint` | eslint |
| Shell formatting | `shfmt` | manual |
| Shell linting | `shellcheck` | manual |
| Dockerfile linting | `hadolint` | manual |
| JSON processing | `jq` | python -c |
| Python packages | `uv` | pip (fallback) |
| HTTP requests | `curl` | wget |
