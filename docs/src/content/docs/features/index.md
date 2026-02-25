---
title: Features
description: Overview of CodeForge features — agents, skills, CLI tools, and code intelligence capabilities.
sidebar:
  order: 1
---

CodeForge turns your DevContainer into a fully equipped AI development environment. Every feature is pre-configured and ready to use the moment your container starts — no setup scripts to run, no extensions to install, no configuration files to write.

This section is your reference guide to everything CodeForge provides. Whether you need a specialized AI agent to audit your security posture, a skill pack to guide your FastAPI development, or a CLI tool to search your session history, you will find it documented here.

## What You Get

Out of the box, CodeForge gives you:

- **17 specialized AI agents** with focused expertise and safety-calibrated tool access
- **34 domain knowledge packs** (skills) for frameworks, patterns, and workflows
- **21 CLI tools** for session management, code quality, and development
- **3 layers of code intelligence** — AST-based search, syntax parsing, and LSP semantic analysis
- **12 plugins** that wire everything together with hooks, guards, and automation

All of these features work together. An agent can load skills for domain expertise, use CLI tools for code quality checks, and leverage code intelligence for precise navigation — all orchestrated automatically.

## AI Agents

CodeForge includes **17 specialized AI agents**, each with focused expertise, calibrated tool access, and a detailed system prompt that shapes its behavior. When you ask Claude a question, the agent system automatically delegates to the right specialist — an architect for design questions, a security auditor for vulnerability reviews, a test writer for coverage gaps.

Agents fall into two categories:

- **Read-only agents** (10 total) — can search, read, and analyze your codebase but never modify it. These include the architect, explorer, security auditor, researcher, dependency analyst, and spec-writer.
- **Full-access agents** (7 total) — can read, write, and execute commands. These include the test writer, refactorer, migrator, doc writer, and generalist.

A key distinction: CodeForge doesn't just add new agents — it **replaces Claude Code's six built-in agent types entirely**. A `PreToolUse` hook intercepts every agent spawn and transparently redirects stock agents (Explore, Plan, general-purpose, Bash, claude-code-guide, statusline-setup) to enhanced custom specialists with frontloaded skills, calibrated models, and safety hooks. You never interact with a generic agent — every request is silently upgraded. The remaining 11 agents (test-writer, refactorer, security-auditor, and others) are entirely new specialists with no built-in equivalent.

Key safety features set CodeForge agents apart:

- **Worktree isolation** — agents like the refactorer, test-writer, migrator, and doc-writer work in git worktrees, so their changes never touch your working branch until you merge them.
- **Background execution** — agents like the security auditor, dependency analyst, and perf profiler run asynchronously, returning results while you continue working.
- **Hook enforcement** — read-only agents have bash guards that block any command that could modify files. The refactorer runs tests after every single edit. The test writer verifies all tests pass before completing.
- **Built-in replacement** — all six of Claude Code's stock agents are intercepted at the hook level and replaced with strictly better specialists. This is enforced, not suggested.

[View all 17 agents →](./agents/)

## Skills

**34 domain-specific knowledge packs** give Claude deep expertise in frameworks, patterns, and workflows. The skill engine provides 21 core skills covering frameworks, practices, and Claude/CodeForge topics. Additional skills come from the spec-workflow (8), ticket-workflow (4), and agent-system (1) plugins. When you start discussing FastAPI routes or Svelte 5 runes, the skill engine detects the context and auto-suggests the relevant skill. Once loaded, the skill injects structured knowledge — best practices, code patterns, API references, and common pitfalls — directly into Claude's context for the current task.

Each skill is built around a "mental model" — a concise explanation of how a technology works, followed by concrete patterns, code examples, and guidance. This is not generic documentation; skills encode the kind of working knowledge a senior specialist carries.

Skills cover three categories:

| Category | Examples | What They Provide |
|----------|----------|-------------------|
| **Frameworks** | FastAPI, Svelte 5, Docker, Pydantic AI, SQLite | Framework-specific patterns, API usage, and testing guidance |
| **Practices** | Testing, Debugging, Security, Refactoring, API Design | Methodology, checklists, and established patterns |
| **Claude & CodeForge** | Agent SDK, Headless Mode, Skill Building, Spec Writing | Guidance for building on and extending CodeForge itself |

[View all 34 skills →](./skills/)

## CLI Tools

CodeForge pre-installs **21 tools and utilities** covering session management, code quality, language runtimes, and development infrastructure. Every tool is available on your `PATH` from the first terminal session — run `cc-tools` to see everything installed and its version.

Highlights include:

- **`cc`** — Launch Claude Code with full CodeForge configuration (plugins, system prompt, agents)
- **`ccms`** — Search your Claude Code session history with boolean queries, role filtering, and time scoping
- **`ccusage`** / **`ccburn`** — Track your Claude API token usage and burn rate
- **`ruff`**, **`biome`**, **`shellcheck`** — Code quality tools for Python, JS/TS, and Shell
- **`sg`** (ast-grep), **`tree-sitter`** — Structural code search and syntax tree operations

[View CLI tools reference →](./tools/)

## Code Intelligence

Understanding code requires more than text search. CodeForge provides three complementary layers of code intelligence that give Claude (and you) progressively deeper understanding of your codebase:

| Layer | Tool | Strength |
|-------|------|----------|
| **Pattern matching** | ast-grep (`sg`) | Find code patterns across files using AST-aware search |
| **Syntax parsing** | tree-sitter | Parse files into syntax trees, extract symbols and structure |
| **Semantic analysis** | LSP servers | Type information, go-to-definition, find-references, and more |

CodeForge installs LSP servers for Python (Pyright), TypeScript/JavaScript, and Go (gopls), giving Claude access to the same semantic operations your IDE uses — but available programmatically from the terminal.

[View code intelligence features →](./code-intelligence/)

## Feature Summary

| Category | Count | Highlights |
|----------|-------|------------|
| [Agents](./agents/) | 17 | Architect, Explorer, Security Auditor, Test Writer, Refactorer, and 12 more |
| [Skills](./skills/) | 34 | FastAPI, Svelte 5, Docker, Testing, Debugging, Security, and 28 more |
| [CLI Tools](./tools/) | 21 | Session search, token tracking, code quality, formatters, and runtimes |
| [Code Intelligence](./code-intelligence/) | 3 | ast-grep, tree-sitter, LSP servers for Python/TS/Go |

## How Features Are Delivered

All CodeForge features are delivered through the [plugin system](../plugins/). Agents come from the [Agent System Plugin](../plugins/agent-system/), skills from the [Skill Engine Plugin](../plugins/skill-engine/), and code quality tools are automated by the [Auto Code Quality Plugin](../plugins/auto-code-quality/). CLI tools are installed as [DevContainer features](../customization/devcontainer/) during container build.

This architecture means you can enable, disable, or customize any feature without modifying the others:

- **Add an agent** — drop a Markdown file in the agents directory with the right frontmatter
- **Create a skill** — write a `SKILL.md` file following the skill template
- **Install a tool** — add a DevContainer feature to your `devcontainer.json`
- **Disable anything** — set `"version": "none"` for features, or remove plugins from the enabled list

Everything is modular and extensible. See [Customization](../customization/) for the full guide.

## Related

- [Plugins](../plugins/) — the plugin system that delivers these features
- [Customization](../customization/) — configure and extend features
- [Commands Reference](../reference/commands/) — all CLI commands in one table
