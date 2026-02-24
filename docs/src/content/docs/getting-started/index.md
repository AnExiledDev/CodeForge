---
title: Getting Started
description: Quick start guide to setting up CodeForge for AI-assisted development with Claude Code.
sidebar:
  order: 1
---

CodeForge is a DevContainer configuration that transforms your development environment into an AI-powered workspace. It bundles 12 plugins, 21 tools, 17 specialized agents, and 21 skills into a single `npx codeforge-dev` install.

## What is CodeForge?

CodeForge provides a fully configured DevContainer for AI-assisted development with Claude Code. Instead of spending hours wiring up linters, formatters, language servers, and shell aliases, you get a single command that installs everything and configures it to work together out of the box.

Inside the container, Claude Code gains superpowers: specialized agents handle architecture reviews, security audits, and test generation, while plugins enforce workspace safety, inject session context, and manage specification-driven workflows. The result is a development environment where AI assistance is deeply integrated, not bolted on.

## Quick Install

```bash
npx codeforge-dev
```

This sets up the `.devcontainer/` configuration in your project. Open the project in VS Code and reopen in the container when prompted. That's it — your AI-powered workspace is ready.

:::tip[Try it in under five minutes]
If you already have Docker and VS Code installed, you can go from zero to a running CodeForge session in under five minutes. See the [Installation Guide](./installation/) for the full walkthrough.
:::

## Why CodeForge?

**Start productive immediately.** New projects and new team members skip the setup ritual entirely. One command installs a complete, consistent environment with every tool pre-configured.

**AI that understands your workflow.** CodeForge doesn't just install Claude Code — it teaches it. System prompts, plugin hooks, and rules give Claude deep context about your project structure, coding standards, and preferred workflows. The agent system provides 17 specialized AI agents, each tuned for a specific task like architecture planning, debugging, or security auditing.

**Safety built in.** Workspace scope guards prevent accidental writes outside your project directory. Dangerous command blockers catch destructive shell commands before they run. Protected file guards keep secrets and lock files safe. You get the power of AI-assisted development with guardrails that prevent costly mistakes.

**Specification-driven development.** The spec workflow plugin brings structure to feature development. Write a spec, refine it with your team, build from it, and keep it updated as-built — all with dedicated skills that guide each step.

## What's Included

### 12 Plugins

Plugins are the backbone of CodeForge. They hook into Claude Code's lifecycle to enhance, guard, and automate your workflow. Highlights include:

- **Agent System** — 17 specialized agents for architecture, debugging, testing, security, and more
- **Skill Engine** — 21 domain-specific knowledge packs covering frameworks, patterns, and workflows
- **Spec Workflow** — specification-driven development with 8 lifecycle skills
- **Session Context** — automatic git state injection, TODO harvesting, and commit reminders
- **Auto Code Quality** — formatting, linting, and advisory test runs on every change
- **Safety Guards** — workspace scope, dangerous command blocking, and protected file enforcement

See the [Plugins Overview](../plugins/) for the full list and detailed documentation.

### 21 Features and Tools

CodeForge installs a comprehensive toolchain so you never have to stop and install something mid-session:

- **Language Runtimes** — Python 3.14, Node.js LTS, Rust, Bun, with Go available as an opt-in
- **Package Managers** — uv (Python), npm, Bun, pip/pipx
- **Code Intelligence** — tree-sitter, ast-grep, Pyright, TypeScript LSP
- **Linters and Formatters** — Ruff, Biome, shfmt, ShellCheck, hadolint, dprint
- **CLI Utilities** — GitHub CLI, Docker, jq, tmux, and CodeForge-specific tools like ccms, ccusage, and ccburn

See the [Features Overview](../features/) for the complete reference.

### 17 Custom Agents

Agents are specialized AI personas that Claude delegates to based on your request. Each agent carries domain-specific instructions and behavioral guidelines:

- **Architect** — system design, dependency analysis, and architecture decisions
- **Explorer** — codebase navigation and structural understanding
- **Test Writer** — test generation with framework-aware patterns
- **Security Auditor** — vulnerability detection and security review
- **Refactorer** — safe, incremental code transformations
- And 12 more covering debugging, documentation, migration, performance, and beyond

See [Agents](../features/agents/) for the full roster.

### 21 Skills

Skills are domain-specific knowledge packs that Claude can draw on. They provide curated best practices, patterns, and workflows for specific technologies and tasks:

- **Framework skills** — FastAPI, Svelte 5, Pydantic AI, Docker
- **Pattern skills** — API design, refactoring, migration, testing
- **Workflow skills** — specification writing, debugging, dependency management, git forensics

See [Skills](../features/skills/) for the complete catalog.

## How It All Fits Together

When you launch a session with the `cc` command, CodeForge loads your system prompt, activates all enabled plugins, and registers their hooks. As you work, plugins fire at key moments — before a tool runs, after a tool completes, and when Claude finishes a turn. Agents and skills are surfaced automatically based on what you're working on, or you can invoke them directly.

The environment is designed to stay out of your way while quietly making everything better: session context appears when you need it, dangerous commands get blocked before they cause damage, and specs stay in sync with your implementation.

## Next Steps

- [System Requirements](./requirements/) — verify your system is ready
- [Installation Guide](./installation/) — detailed setup instructions
- [First Session](./first-session/) — walk through your first Claude Code session
- [Plugins Overview](../plugins/) — explore the plugin ecosystem
- [Features Overview](../features/) — browse available agents, skills, and tools
