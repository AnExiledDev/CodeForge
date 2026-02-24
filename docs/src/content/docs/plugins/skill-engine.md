---
title: Skill Engine
description: The skill engine plugin provides 21 domain-specific knowledge packs with automatic suggestion based on conversation context.
sidebar:
  order: 3
---

The skill engine delivers domain-specific expertise into your Claude Code sessions through curated knowledge packs called skills. Each skill is a focused Markdown document that teaches Claude how to work with a specific framework, tool, pattern, or workflow. Skills activate automatically when the conversation context matches, or you can invoke them manually with slash commands.

Think of skills as expert consultants that join your session exactly when their knowledge is needed. Working with FastAPI? The FastAPI skill loads automatically, bringing patterns for routing, dependency injection, SSE streaming, and Pydantic v2 models. Writing tests? The testing skill surfaces with pytest fixtures, Vitest patterns, and test quality principles.

## How Auto-Suggestion Works

The skill engine includes a `skill-suggester.py` hook that analyzes every prompt you submit. It fires on the `UserPromptSubmit` event — meaning it runs before Claude processes your message. The suggester matches your prompt against two types of patterns for each skill:

- **Phrases** — natural language patterns like "build a fastapi app", "write tests", "refactor this", "debug logs"
- **Terms** — specific technical keywords like "pytest", "uvicorn", "pydantic", "ast-grep"

When your prompt matches one or more skills, the hook injects an activation directive into Claude's context. Claude then evaluates each matched skill for relevance to your actual request and loads the ones that apply.

:::tip[Auto-Suggestion Is Smart, Not Greedy]
The suggester matches broadly but Claude filters for relevance. If you mention "pytest" while discussing something unrelated to testing, the testing skill might match on the keyword but Claude will skip loading it if it is not relevant to your actual question.
:::

### How Skills Inject Context

Each skill is a `SKILL.md` file containing structured knowledge — mental models, code patterns, configuration guidance, ambiguity policies, and reference links. When a skill activates, its full content is loaded into Claude's context window. This gives Claude deep, authoritative knowledge about that specific domain for the duration of the task.

Skills are designed to be practical, not encyclopedic. A typical skill includes:

- **Mental model** — how to think about the domain (2-3 paragraphs)
- **Core patterns** — annotated code examples for the most common tasks
- **Decision guidance** — what to do when the user does not specify a preference (ambiguity policy)
- **Reference files** — links to deeper reference documents for advanced topics

## Available Skills

CodeForge ships with 22 skills organized into three categories.

### Frameworks and Libraries

Domain expertise for popular frameworks and tools. These skills cover API design, data modeling, and implementation patterns.

| Skill | What It Teaches |
|-------|----------------|
| **fastapi** | REST APIs, Pydantic v2 models, SSE streaming, dependency injection, ASGI middleware |
| **svelte5** | Svelte 5 runes, SvelteKit routing, component reactivity, state management |
| **pydantic-ai** | PydanticAI agent framework, tool definitions, streaming, model fallbacks |
| **docker** | Dockerfile best practices, multi-stage builds, Docker Compose, health checks |
| **docker-py** | Python Docker SDK, container management, log streaming, health monitoring |
| **sqlite** | SQLite patterns, WAL mode, FTS5 full-text search, CTEs, window functions |

### Development Practices

Process and methodology skills that improve code quality, security, and maintainability.

| Skill | What It Teaches |
|-------|----------------|
| **testing** | Test writing patterns for pytest, Vitest, Jest; fixtures, mocking, FIRST principles |
| **debugging** | Systematic debugging approaches, log analysis, container diagnostics |
| **refactoring-patterns** | Safe refactoring techniques, code smell identification, extract/inline patterns |
| **security-checklist** | Security audit checklists, OWASP guidance, vulnerability scanning |
| **api-design** | REST API conventions, versioning, pagination, error responses, OpenAPI docs |
| **documentation-patterns** | Documentation standards, docstrings, JSDoc, architecture docs |
| **performance-profiling** | Profiling with cProfile, py-spy, scalene; flamegraphs, benchmarking |
| **dependency-management** | Dependency auditing, outdated packages, vulnerability scanning, license checks |
| **migration-patterns** | Framework migration strategies, version upgrades, CommonJS to ESM |

### Claude Code and CodeForge

Skills for working with Claude Code itself and extending CodeForge.

| Skill | What It Teaches |
|-------|----------------|
| **claude-code-headless** | Running Claude Code in CI/CD pipelines, stream-json output, headless permissions |
| **claude-agent-sdk** | Claude Agent SDK usage, MCP tools, subagent definitions, SDK hooks |
| **skill-building** | How to create new skills for the skill engine |
| **git-forensics** | Git history analysis, blame, bisect, pickaxe search, reflog recovery |
| **ast-grep-patterns** | AST-grep pattern writing for syntax-aware code search |
| **team** | Multi-agent team coordination, task decomposition, parallel workstreams |

:::note[Cross-Plugin Skills]
The `specification-writing` skill and the spec lifecycle skills (`spec-new`, `spec-build`, etc.) live in the [Spec Workflow](./spec-workflow/) plugin, not the skill engine. However, the skill-suggester registers keywords for them so they are auto-suggested alongside skill-engine skills.
:::

## Skill Activation Patterns

Here is a sampling of the phrases and terms that trigger each category of skill, so you know what to expect:

| When You Say... | Skills That Activate |
|-----------------|---------------------|
| "Build a FastAPI app" | fastapi |
| "Write tests for this module" | testing |
| "Refactor this function" | refactoring-patterns |
| "Check for security vulnerabilities" | security-checklist |
| "Profile this code" or "find the bottleneck" | performance-profiling |
| "Create a spec for this feature" | spec-new |
| "Build from the spec" | spec-build |
| "Debug the logs" or "what went wrong" | debugging |
| "Spawn a team" or "work in parallel" | team |
| "Search with ast-grep" | ast-grep-patterns |

## Skills and Agents

Skills and agents are complementary. Agents define *who* does the work (with what tools and constraints), while skills define *what knowledge* they bring.

Many agents come pre-loaded with relevant skills through their frontmatter configuration. For example:

- The **architect** agent loads `api-design` and spec lifecycle skills
- The **test-writer** agent loads the `testing` skill
- The **refactorer** agent loads `refactoring-patterns`
- The **security-auditor** agent loads `security-checklist`
- The **explorer** agent loads `ast-grep-patterns`

This means when the agent system delegates to a specialist, that specialist already has the domain knowledge it needs. The skill engine's auto-suggestion layer adds a second pathway — skills can also activate based on your prompt, even when no agent delegation occurs.

## Creating Custom Skills

You can create your own skills by adding a `SKILL.md` file to the skill engine's `skills/` directory. The built-in **skill-building** skill teaches you exactly how to do this — just ask Claude to "build a skill" or "create a skill" and it will activate.

A skill file follows this structure:

```markdown
---
name: my-custom-skill
description: >-
  What this skill teaches, when to use it, and when not to use it.
version: 0.1.0
---

# Skill Title

## Mental Model
[How to think about this domain — 2-3 paragraphs]

## Core Patterns
[Annotated code examples for common tasks]

## Ambiguity Policy
[Default choices when the user doesn't specify preferences]

## Reference Files
[Links to deeper reference documents]
```

The `description` field in the frontmatter is important — it tells the system (and other developers) when this skill should activate and when it should not. Be specific about both use cases and anti-patterns.

:::note[Keyword Registration]
For your custom skill to participate in auto-suggestion, you need to add its phrases and terms to the `skill-suggester.py` script's `SKILLS` dictionary. Without this registration, the skill can still be activated manually but will not be auto-suggested.
:::

## Configuration

The skill engine is configured through its plugin manifest at `.devcontainer/plugins/devs-marketplace/plugins/skill-engine/.claude-plugin/plugin.json`. The hook registration in `hooks/hooks.json` controls when the suggester fires.

Skill files live in the `skills/` directory, with each skill in its own subfolder containing a `SKILL.md` and optionally a `references/` directory for supplementary documentation.

```
skill-engine/
├── .claude-plugin/
│   └── plugin.json
├── hooks/
│   └── hooks.json          # UserPromptSubmit → skill-suggester.py
├── scripts/
│   └── skill-suggester.py  # Phrase/term matching logic
└── skills/
    ├── fastapi/
    │   ├── SKILL.md
    │   └── references/      # Deep-dive docs on routing, SSE, etc.
    ├── testing/
    │   └── SKILL.md
    ├── debugging/
    │   └── SKILL.md
    └── ...                  # 22 skills total
```

## Related

- [Skills Reference](../features/skills/) — detailed per-skill documentation
- [Agent System](./agent-system/) — agents that carry pre-loaded skills
- [Spec Workflow](./spec-workflow/) — the specification-writing skill powers spec authoring
- [Hooks](../customization/hooks/) — how the skill suggester hook integrates
