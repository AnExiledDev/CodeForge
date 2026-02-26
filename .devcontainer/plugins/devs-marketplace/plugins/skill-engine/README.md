# skill-engine

Claude Code plugin that provides 22 coding knowledge packs (skills) with automatic suggestion based on user prompts. Each skill contains domain-specific instructions and reference material that Claude loads on demand via the `/skill` command.

## What It Does

Two capabilities:

1. **Skill library** — 22 skills covering frameworks, tools, and development patterns. Each skill is a structured knowledge pack with a `SKILL.md` entrypoint and `references/` subdirectory containing detailed reference docs.

2. **Auto-suggestion** — A `UserPromptSubmit` hook watches user prompts for keyword matches and suggests relevant skills as context, so Claude can proactively load the right knowledge.

### Skill Catalog

| Skill | Domain |
|-------|--------|
| api-design | REST conventions, error handling, API patterns |
| ast-grep-patterns | Semantic code search patterns by language |
| claude-agent-sdk | Building custom agents with the Agent SDK (TypeScript) |
| claude-code-headless | CLI flags, output parsing, SDK and MCP integration |
| debugging | Error patterns, log locations, diagnosis procedures |
| dependency-management | Package managers, ecosystem commands, license compliance |
| docker | Dockerfile patterns, docker-compose services |
| docker-py | Docker SDK for Python, container lifecycle |
| documentation-patterns | API doc templates, docstring formats |
| fastapi | Routing, Pydantic v2, SSE streaming, middleware, dependencies |
| git-forensics | Advanced git commands, blame history, investigation playbooks |
| migration-patterns | Framework/version migrations for JavaScript and Python |
| performance-profiling | Profiling tools, interpreting results, optimization |
| pydantic-ai | Building AI agents with Pydantic, tools, models, streaming |
| refactoring-patterns | Safe transformations, code smell catalog |
| security-checklist | OWASP patterns, secrets management, vulnerability detection |
| skill-building | How to author skills, patterns and anti-patterns |
| sqlite | Schema, pragmas, advanced queries, FTS5, JS/Python patterns |
| svelte5 | Runes, reactivity, components, SPA routing, LayerCake |
| team | Agent team orchestration, parallel workstreams, task coordination |
| testing | Testing frameworks, FastAPI testing, Svelte testing |
| worktree | Git worktree lifecycle, EnterWorktree, parallel development |

### Auto-Suggestion

The `skill-suggester.py` hook matches user prompts against keyword maps defined in each skill. When a match is found, it injects a suggestion via `additionalContext` so Claude knows a relevant skill is available.

Keywords are defined per skill as:
- **Phrases** — Multi-word patterns (e.g., "docker compose", "REST API")
- **Terms** — Single keywords (e.g., "FastAPI", "pytest")

## How It Works

### Hook Lifecycle

```
User submits a prompt
  |
  +-> UserPromptSubmit fires
        |
        +-> skill-suggester.py
              |
              +-> Scan prompt against all skill keyword maps
              +-> Match found? -> Inject skill suggestion as additionalContext
              +-> No match? -> Silent (no output)
```

### Skill Structure

Each skill follows a standard layout:

```
skills/
+-- skill-name/
    +-- SKILL.md             # Entrypoint: instructions, patterns, key concepts
    +-- references/          # Detailed reference material
        +-- topic-a.md
        +-- topic-b.md
```

Skills are loaded via Claude Code's `/skill` slash command (e.g., `/skill fastapi`). The `SKILL.md` file is the primary document Claude reads; references are loaded as needed for deeper detail.

### Exit Code Behavior

| Exit Code | Meaning |
|-----------|---------|
| 0 | Suggestion injected (or no match — silent) |

The hook never blocks operations.

### Timeouts

| Hook | Timeout |
|------|---------|
| Skill suggestion (UserPromptSubmit) | 3s |

## Installation

### CodeForge DevContainer

Pre-installed and activated automatically — no setup needed.

### From GitHub

Use this plugin in any Claude Code setup:

1. Clone the [CodeForge](https://github.com/AnExiledDev/CodeForge) repository:

   ```bash
   git clone https://github.com/AnExiledDev/CodeForge.git
   ```

2. Enable the plugin in your `.claude/settings.json`:

   ```json
   {
     "enabledPlugins": {
       "skill-engine@<clone-path>/.devcontainer/plugins/devs-marketplace": true
     }
   }
   ```

   Replace `<clone-path>` with the absolute path to your CodeForge clone.

## Plugin Structure

```
skill-engine/
+-- .claude-plugin/
|   +-- plugin.json                  # Plugin metadata
+-- hooks/
|   +-- hooks.json                   # UserPromptSubmit hook registration
+-- scripts/
|   +-- skill-suggester.py           # Keyword-based skill auto-suggestion
+-- skills/
|   +-- api-design/                  # 22 skill directories
|   +-- ast-grep-patterns/
|   +-- claude-agent-sdk/
|   +-- claude-code-headless/
|   +-- debugging/
|   +-- dependency-management/
|   +-- docker/
|   +-- docker-py/
|   +-- documentation-patterns/
|   +-- fastapi/
|   +-- git-forensics/
|   +-- migration-patterns/
|   +-- performance-profiling/
|   +-- pydantic-ai/
|   +-- refactoring-patterns/
|   +-- security-checklist/
|   +-- skill-building/
|   +-- sqlite/
|   +-- svelte5/
|   +-- team/
|   +-- testing/
|   +-- worktree/
+-- README.md                        # This file
```

## Requirements

- Python 3.11+
- Claude Code with plugin hook support (skills)
