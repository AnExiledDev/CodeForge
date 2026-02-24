---
title: Skills
description: Complete reference for all 22 CodeForge skills — domain knowledge packs for frameworks, patterns, and workflows.
sidebar:
  order: 3
---

Skills are domain-specific knowledge packs that give Claude deep expertise in specific technologies, patterns, and workflows. Instead of relying on general training data, a loaded skill injects structured, curated knowledge — best practices, code patterns, API references, mental models, and common pitfalls — directly into Claude's context for your current task.

## How Skills Work

Each skill is a `SKILL.md` file containing structured knowledge organized around a central mental model. When loaded, this knowledge becomes part of Claude's working context, giving it the equivalent of having a senior specialist's reference guide open while working on your code.

### Auto-Suggestion

The skill engine monitors your conversation and automatically suggests relevant skills based on context. If you start discussing FastAPI routes, the `fastapi` skill is suggested. If you mention refactoring a class, `refactoring-patterns` appears. You can accept the suggestion to load the skill, or ignore it and continue working.

### Manual Invocation

You can also load skills explicitly when you know you need specific expertise. Skills declared in an agent's configuration are loaded automatically when that agent is spawned.

:::tip[When skills shine]
Skills are most valuable when you are working in a specific domain and need Claude to follow established patterns rather than improvise. Loading the `testing` skill before writing tests ensures Claude follows your project's pytest conventions. Loading `security-checklist` before a review ensures no OWASP category is missed.
:::

## Framework Skills

These skills provide deep knowledge of specific frameworks and technologies — API patterns, configuration idioms, testing approaches, and common pitfalls.

### fastapi

Modern FastAPI development including REST APIs, Pydantic v2 models, SSE streaming, dependency injection, and ASGI middleware patterns. Covers the type-driven contract model where function signatures define the entire API contract — path parameters, query parameters, request bodies, and response models all declared through type annotations.

**Key topics:** Route definitions, dependency injection graphs, Pydantic v2 validation, SSE streaming with sse-starlette, background tasks, middleware ordering, OpenAPI schema customization.

**Auto-suggested when:** You mention FastAPI, Pydantic models, APIRouter, SSE streaming, or ASGI middleware.

### svelte5

Svelte 5 development with the new runes reactivity system. Covers the shift from Svelte 4's compiler-magic reactivity to Svelte 5's explicit runes — `$state`, `$derived`, `$effect`, `$props`, and `$bindable`. Includes component patterns, event handling, and migration guidance from Svelte 4.

**Key topics:** Rune-based reactivity, component composition, snippet blocks, event handling with `onclick` instead of `on:click`, SvelteKit integration, transition and animation patterns.

**Auto-suggested when:** You mention Svelte, runes, `$state`, `$derived`, SvelteKit, or component rendering.

### docker

Docker and Docker Compose patterns for containerized development and deployment. Covers Dockerfile best practices (multi-stage builds, layer caching, security hardening), Compose service orchestration, networking, volumes, and health checks.

**Key topics:** Multi-stage builds, layer optimization, .dockerignore, Compose service dependencies, named volumes, bridge networks, health check configuration, production hardening.

**Auto-suggested when:** You mention Docker, Dockerfile, Compose, container builds, or image optimization.

### docker-py

Python Docker SDK for managing containers, images, networks, and volumes programmatically. Covers the `docker` Python package API for automation scripts, CI/CD tooling, and container orchestration from Python code.

**Key topics:** Container lifecycle management, image operations, network configuration, volume management, streaming logs, exec commands, Docker API authentication.

**Auto-suggested when:** You mention the Docker Python SDK, `docker.from_env()`, or programmatic container management.

### pydantic-ai

Pydantic AI agent framework for building structured AI agents in Python. Covers agent definition, tool registration, structured outputs with Pydantic models, streaming, dependency injection, and testing patterns.

**Key topics:** Agent definition with system prompts, tool decorators, structured result types, streaming responses, RunContext dependencies, testing with `TestModel`, multi-model support.

**Auto-suggested when:** You mention Pydantic AI, AI agents in Python, structured AI outputs, or tool-using agents.

### sqlite

SQLite database patterns for embedded and application databases. Covers schema design, query optimization, WAL mode for concurrent access, connection management, migration strategies, and common pitfalls that trip up developers coming from client-server databases.

**Key topics:** WAL mode configuration, `PRAGMA` tuning, connection pooling, schema migrations, full-text search (FTS5), JSON functions, transaction isolation, backup strategies.

**Auto-suggested when:** You mention SQLite, database queries, schema migrations, or WAL mode.

## Practice Skills

These skills teach methodologies, checklists, and established patterns that apply across frameworks and languages.

### testing

Test writing patterns for FastAPI endpoints and Svelte 5 components using pytest and Vitest. Emphasizes testing behavior at public interfaces — HTTP contracts for backends, rendered output for frontends. Covers the arrange-act-assert pattern with specific isolation mechanisms for each stack.

**Key topics:** pytest fixtures and parametrize, httpx AsyncClient for FastAPI, `app.dependency_overrides`, Vitest with @testing-library/svelte, MSW for network mocking, test organization strategies.

**Auto-suggested when:** You mention writing tests, pytest, Vitest, test coverage, or mocking dependencies.

### debugging

Systematic log analysis and error diagnosis across Docker, systemd, and application environments. Treats logs as forensic evidence and follows a scientific method: observe symptoms, form hypotheses, gather evidence, test hypotheses, converge on root cause.

**Key topics:** Docker exit code interpretation, container log analysis, Python traceback reading, error cascade identification, chronology-based diagnosis, cross-source correlation, OOM detection.

**Auto-suggested when:** You mention debugging, log analysis, "why did this crash," Docker logs, or error investigation.

### refactoring-patterns

Behavior-preserving code transformations with a smell-detect, transform, verify cycle. Covers the full catalog of code smells (god class, feature envy, data clumps, primitive obsession) and their corresponding mechanical transformations, with language-specific idioms for Python and TypeScript.

**Key topics:** Extract function/class, inline function, replace conditional with polymorphism, introduce parameter object, guard clauses, consolidate duplicate logic, smell severity assessment.

**Auto-suggested when:** You mention refactoring, code smells, extracting functions, reducing complexity, or cleaning up code.

### security-checklist

Defense-in-depth security review covering OWASP Top 10, secrets detection, and dependency CVE scanning. Built around the principle that every vulnerability exists at a boundary where untrusted data is treated as trusted.

**Key topics:** Input boundary validation, SQL/command/template injection patterns, secret scanning regex, dependency auditing (pip-audit, npm audit, trivy), CORS configuration, JWT validation, password hashing algorithms.

**Auto-suggested when:** You mention security, vulnerabilities, OWASP, secrets scanning, or dependency auditing.

### api-design

REST API design conventions covering the full lifecycle from URL structure to error responses. Provides consistent patterns for resource naming, HTTP method semantics, pagination, filtering, and versioning.

**Key topics:** URL structure and naming, HTTP method/status code conventions, pagination strategies, filtering and sorting, error response format, API versioning, HATEOAS considerations.

**Auto-suggested when:** You mention API design, REST endpoints, pagination, or API versioning.

### documentation-patterns

Documentation standards and templates for technical writing. Covers README structure, API documentation, inline comments, architectural decision records (ADRs), and documentation generation tooling.

**Key topics:** README template sections, API documentation structure, docstring conventions, ADR format, when to document vs when code should be self-explanatory, documentation-as-code practices.

**Auto-suggested when:** You mention writing documentation, README files, API docs, or docstrings.

### performance-profiling

Performance measurement and optimization methodology. Follows a rigorous measure-first approach — identify metrics, establish baselines, profile, then optimize based on data rather than intuition.

**Key topics:** CPU profiling (cProfile, py-spy), memory analysis, I/O bottleneck identification, database query optimization (EXPLAIN ANALYZE), benchmarking techniques, complexity analysis.

**Auto-suggested when:** You mention profiling, performance, bottlenecks, "why is this slow," or benchmarking.

### dependency-management

Dependency analysis and management across package ecosystems. Covers version resolution strategies, conflict detection, upgrade planning, vulnerability assessment, and lockfile management for npm, pip/uv, Cargo, and Go modules.

**Key topics:** Semantic versioning, version pinning strategies, lockfile management, vulnerability scanning, license compliance, dependency graph analysis, upgrade path planning.

**Auto-suggested when:** You mention dependency updates, version conflicts, package auditing, or lockfile issues.

### migration-patterns

Migration strategies for frameworks, databases, and architectures. Covers incremental migration techniques that keep the system deployable at every step, with rollback strategies for when things go wrong.

**Key topics:** Strangler fig pattern, database migration tools (Alembic, Prisma, goose), schema evolution, data migration scripts, forward/backward compatibility, feature flags for gradual rollout.

**Auto-suggested when:** You mention migration, upgrading frameworks, database schema changes, or version bumps.

## Claude & CodeForge Skills

These skills help you build on and extend the Claude ecosystem itself.

### claude-agent-sdk

Claude Agent SDK patterns in TypeScript for building programmatic AI agents. Covers the `query()` function, permission callbacks, MCP tool integration, subagent orchestration, and hooks — the same agent loop that powers Claude Code, available as a library.

**Key topics:** `query()` async generator, `canUseTool` permission callback, `createSdkMcpServer` for custom tools, subagent definitions, message streaming, Bedrock/Vertex AI/Azure AI Foundry configuration.

**Auto-suggested when:** You mention the Claude Agent SDK, building agents with Claude, `@anthropic-ai/claude-agent-sdk`, or programmatic Claude usage.

### claude-code-headless

Running Claude Code in headless and CI mode for automation. Covers non-interactive usage, piping prompts, parsing JSON output, CI/CD integration patterns, and automating repetitive development tasks.

**Key topics:** `--print` flag for non-interactive mode, JSON output parsing, CI pipeline integration, automation scripts, session management for headless runs.

**Auto-suggested when:** You mention running Claude in CI, headless mode, automation with Claude Code, or non-interactive usage.

### skill-building

Creating new skills for the CodeForge skill engine. Covers the `SKILL.md` format, content structure, mental model design, and best practices for writing skills that effectively transfer domain knowledge to Claude.

**Key topics:** SKILL.md YAML frontmatter, mental model section design, pattern documentation, when-to-use triggers, skill versioning, testing skill effectiveness.

**Auto-suggested when:** You mention creating skills, writing a SKILL.md, extending the skill engine, or customizing CodeForge knowledge.

### git-forensics

Git history analysis techniques for tracing code evolution and investigating changes. Covers advanced git commands for blame, bisect, reflog archaeology, and commit pattern analysis.

**Key topics:** `git blame -C -C -C` for rename tracking, pickaxe search with `-S` and `-G`, reflog recovery, `git shortlog` for contribution analysis, merge-base identification, commit archaeology.

**Auto-suggested when:** You mention git history, git blame, bisect, "when was this changed," or code archaeology.

### specification-writing

EARS format specification authoring for structured technical requirements. Covers the five requirement types (ubiquitous, event-driven, state-driven, optional, unwanted) and Given/When/Then acceptance criteria patterns.

**Key topics:** EARS requirement syntax, Given/When/Then acceptance criteria, requirement traceability, spec organization in `.specs/` directories, approval workflow (draft to approved).

**Auto-suggested when:** You mention writing specs, defining requirements, acceptance criteria, or EARS format.

### ast-grep-patterns

Syntax-aware code search using ast-grep (`sg`) and tree-sitter. Teaches when to use structural search over text search and how to write effective AST patterns with metavariables.

**Key topics:** `$NAME` single-node metavariables, `$$$ARGS` variadic metavariables, language-specific patterns (Python, TypeScript, JavaScript, Rust), rule composition, combining ast-grep with tree-sitter for deep structural analysis.

**Auto-suggested when:** You mention ast-grep, structural search, syntax-aware search, tree-sitter queries, or code pattern matching.

### team

Agent team orchestration for parallel workstreams. Guides the creation and coordination of specialist agent teams using `TeamCreate`, task assignment, and message passing. Teams add value when work can be parallelized across 3 or more independent streams.

**Key topics:** Team creation, task decomposition, specialist selection, parallel vs sequential work assessment, message coordination, result integration, team lifecycle management.

**Auto-suggested when:** You mention spawning a team, working in parallel, coordinating multiple agents, or splitting work across agents.

### worktree

Git worktree creation, management, and cleanup for parallel development workflows. Covers the full worktree lifecycle — creating worktrees via `EnterWorktree` or CLI, setting up `.worktreeinclude` for environment files, managing active worktrees, and cleanup. Integrates with CodeForge's Project Manager auto-detection and agent isolation system.

**Key topics:** `EnterWorktree` tool, `--worktree` CLI flag, `.worktreeinclude` setup, worktree naming conventions, cleanup and merging, agent isolation via `isolation: worktree`, native vs legacy path conventions.

**Auto-suggested when:** You mention creating a worktree, `EnterWorktree`, git worktree commands, parallel branches, or isolating work.

## Skill Categories Summary

| Category | Skills | Focus |
|----------|--------|-------|
| **Frameworks** | fastapi, svelte5, pydantic-ai, docker, docker-py, sqlite | Framework-specific patterns and APIs |
| **Practices** | testing, debugging, refactoring-patterns, security-checklist, api-design, documentation-patterns, performance-profiling, dependency-management, migration-patterns | Methodologies and established patterns |
| **Claude & CodeForge** | claude-code-headless, claude-agent-sdk, skill-building, git-forensics, specification-writing, ast-grep-patterns, team, worktree | Building on and extending the Claude ecosystem |

:::note[Skills vs Agents]
Skills and agents serve different purposes. An **agent** is a specialized Claude instance with specific tools and constraints — it *does work*. A **skill** is a knowledge pack that *informs work* — it provides the patterns, best practices, and domain knowledge that make an agent (or the main Claude session) more effective. Many agents have associated skills that load automatically when the agent is spawned.
:::

## Related

- [Skill Engine Plugin](../plugins/skill-engine/) — how the skill engine works
- [Agents](./agents/) — agents that leverage skills
- [Spec Workflow](../plugins/spec-workflow/) — the specification-writing skill in action
