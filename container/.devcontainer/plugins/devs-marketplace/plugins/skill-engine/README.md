# skill-engine

Claude Code plugin that provides 24 coding knowledge packs (skills). Each skill contains domain-specific instructions and reference material that Claude loads on demand via the `/skill` command.

## What It Does

A skill library of 24 skills covering frameworks, tools, and development patterns. Each skill is a structured knowledge pack with a `SKILL.md` entrypoint and `references/` subdirectory containing detailed reference docs.

### Skill Catalog

| Skill | Domain |
|-------|--------|
| agent-browser | Headless browser automation, CLI reference, workflows |
| api-design | REST conventions, error handling, API patterns |
| ast-grep-patterns | Semantic code search patterns by language |
| claude-agent-sdk | Building custom agents with the Agent SDK (TypeScript) |
| claude-code-headless | CLI flags, output parsing, SDK and MCP integration |
| codeforge | Container environment context: toolchain, filesystem, constraints |
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

## How It Works

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
|   +-- hooks.json                   # Hook registration (empty — no active hooks)
+-- skills/
|   +-- agent-browser/               # 24 skill directories
|   +-- api-design/
|   +-- ast-grep-patterns/
|   +-- claude-agent-sdk/
|   +-- claude-code-headless/
|   +-- codeforge/
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

- Claude Code with plugin hook support (skills)
