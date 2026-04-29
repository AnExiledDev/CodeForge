---
title: Agents
description: Complete reference for all 4 CodeForge agents — capabilities, tool access, and use cases.
sidebar:
  order: 4
---

CodeForge provides 4 specialized agents, each configured with a focused system prompt, specific tool access, and domain expertise. Claude automatically delegates to the appropriate agent based on your request — ask about architecture and you get the architect; ask to explore the codebase and you get the explorer.

## How Agents Work

Each agent is defined as a Markdown file in the agent system plugin's `agents/` directory. The file contains a YAML frontmatter header specifying the agent's name, tools, model, permission mode, and associated skills, followed by a detailed system prompt that shapes the agent's behavior, expertise, and constraints.

When Claude receives your request, the agent system evaluates which specialist best matches your intent and spawns that agent as a subagent. The specialist operates within its defined boundaries — a read-only agent cannot modify files, and a full-access agent in a worktree cannot touch your main branch.

### Built-In Agents, Replaced and Upgraded

Claude Code ships with built-in agent types: Explore, Plan, general-purpose, Bash, claude-code-guide, and statusline-setup. These are functional but generic — they carry no domain skills, have no safety hooks, and run with default tool access.

CodeForge **replaces four** of these built-in agents with enhanced custom specialists. This happens transparently through a `PreToolUse` hook that intercepts agent spawn requests and redirects them before execution. The remaining built-in agents (`Bash`, `statusline-setup`) run natively.

| Built-In Agent | Replaced By | What Changes |
|----------------|-------------|--------------|
| `Explore` | **explorer** | Haiku model for speed, read-only enforcement |
| `Plan` | **architect** | Opus model for deep reasoning, structured 4-phase workflow |
| `general-purpose` | **generalist** | Full tool access, plan mode support |
| `claude-code-guide` | **claude-guide** | Pre-loaded Claude SDK and headless mode skills, documentation-first approach |

The redirect is fully transparent — you can use either the built-in name or the custom name interchangeably. Asking Claude to "explore the codebase" triggers the same enhanced explorer agent whether the system selects the `Explore` type or the `explorer` type.

:::note[Archived Agents]
15 additional specialist agents (bash-exec, debug-logs, dependency-analyst, documenter, git-archaeologist, implementer, investigator, migrator, perf-profiler, refactorer, researcher, security-auditor, spec-writer, statusline-config, test-writer) were previously available and have been archived to `agents/_archived/`. They can be restored by moving them back to the `agents/` directory and adding redirect entries if needed.
:::

:::tip[Why This Matters]
The redirect happens at the hook level, not the prompt level. This means the upgrade is enforced — not suggested. Even if Claude's internal routing tries to use a stock Explore agent, the hook intercepts the call and swaps in the enhanced explorer before any code executes. The result is a strictly better agent every time, with zero user effort.
:::

### Key Properties

Every agent definition includes:

- **Tools** — which Claude Code tools the agent can use (Read, Write, Edit, Bash, Glob, Grep, WebSearch, etc.)
- **Model** — which Claude model powers the agent (opus, sonnet, or haiku)
- **Permission mode** — `plan` (read-only), `acceptEdits` (can write with approval), or `default` (full access)
- **Isolation** — some agents run in git worktrees so their changes are isolated from your working branch
- **Background** — some agents run asynchronously, returning results while you continue working
- **Skills** — domain knowledge packs automatically loaded for the agent
- **Memory** — whether the agent remembers context across sessions (project-scoped or user-scoped)

## Agent Reference

### architect

<span class="badge badge--green">Read-only</span> <span class="badge badge--blue">Opus</span> <span class="badge badge--purple">api-design</span>

A senior software architect that designs implementation plans, analyzes trade-offs, and identifies critical files for proposed changes. The architect follows a structured four-phase workflow: understand requirements, explore the codebase, analyze and design, then structure the plan. It produces detailed implementation plans with phased steps, risk assessments, and testing strategies — but never modifies any files.

**When activated:** Architecture questions, design reviews, "plan the implementation," "how should we architect this," system structure analysis.

:::tip[Try this]
"Plan the implementation for adding WebSocket support to our API. Consider the existing REST patterns and suggest a phased approach."
:::

### claude-guide

<span class="badge badge--green">Read-only</span> <span class="badge badge--blue">Haiku</span> <span class="badge badge--purple">claude-code-headless</span> <span class="badge badge--purple">claude-agent-sdk</span>

Your go-to expert for questions about Claude Code itself, the Claude Agent SDK, and the Claude API. Provides documentation-based guidance with specific examples and configuration snippets. Proactively suggests related features you might find useful.

**When activated:** Questions about Claude Code features, "how do I configure hooks," "how do I use the Agent SDK," "can Claude do X."

:::tip[Try this]
"How do I set up MCP tools with the Claude Agent SDK? Show me a TypeScript example."
:::

### explorer

<span class="badge badge--green">Read-only</span> <span class="badge badge--blue">Haiku</span>

A fast codebase navigator for file discovery, pattern matching, and structural analysis. Supports three thoroughness levels — quick (minimal tool calls), medium (balanced search), and very thorough (comprehensive investigation). Uses ast-grep and tree-sitter for syntax-aware structural search alongside standard Glob and Grep.

**When activated:** "Find all files matching," "where is X defined," "how is this project structured," codebase orientation.

:::tip[Try this]
"Find all API endpoint definitions in this project — very thorough. Show me the routing patterns and any anomalies."
:::

### generalist

<span class="badge badge--orange">Full</span> <span class="badge badge--blue">Inherited</span>

The general-purpose development agent for tasks that don't fit a specialized role. Has access to all tools and can handle mixed workloads — small features, bug fixes, multi-file investigations, and miscellaneous development tasks. Used when no specialist clearly matches.

**When activated:** General development tasks, mixed-scope requests, tasks spanning multiple domains.

:::tip[Try this]
"Fix the pagination bug in the search results endpoint and update the tests to cover the edge case."
:::

## Agent Capabilities Matrix

| Agent | Access | Model | Isolation | Background | Key Skills |
|-------|--------|-------|-----------|------------|------------|
| architect | Read-only | Opus | -- | -- | api-design |
| claude-guide | Read-only | Haiku | -- | -- | claude-code-headless, claude-agent-sdk |
| explorer | Read-only | Haiku | -- | -- | -- |
| generalist | Full | Inherited | -- | -- | -- |

## Access Levels at a Glance

| Access Level | Agents |
|-------------|--------|
| **Read-only** | architect, claude-guide, explorer |
| **Full** | generalist |

:::note[About Model Selection]
Agents use different Claude models based on task complexity. Opus handles the most demanding tasks (architecture planning). Haiku powers fast, focused tasks (exploration, Claude Code guidance). The generalist inherits whichever model the main session is using.
:::

## Safety Mechanisms

Read-only agents (architect, explorer, claude-guide) have a PreToolUse hook (`guard-readonly-bash.py`) that blocks any Bash command that could modify files or state.

## Related

- [Agent System Plugin](/extend/plugins/agent-system/) — how the agent system works
- [Skills Reference](./skills/) — knowledge packs agents can leverage
- [Hooks](/customize/hooks/) — hook scripts that support agents
