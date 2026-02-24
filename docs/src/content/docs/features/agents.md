---
title: Agents
description: Complete reference for all 17 CodeForge agents — capabilities, tool access, and use cases.
sidebar:
  order: 2
---

CodeForge provides 17 specialized agents, each configured with a focused system prompt, specific tool access, and domain expertise. Claude automatically delegates to the appropriate agent based on your request — ask about architecture and you get the architect; ask for a security review and you get the security auditor.

## How Agents Work

Each agent is defined as a Markdown file in the agent system plugin's `agents/` directory. The file contains a YAML frontmatter header specifying the agent's name, tools, model, permission mode, and associated skills, followed by a detailed system prompt that shapes the agent's behavior, expertise, and constraints.

When Claude receives your request, the agent system evaluates which specialist best matches your intent and spawns that agent as a subagent. The specialist operates within its defined boundaries — a read-only agent cannot modify files, and a full-access agent in a worktree cannot touch your main branch.

### Built-In Agents, Replaced and Upgraded

Claude Code ships with six built-in agent types: Explore, Plan, general-purpose, Bash, claude-code-guide, and statusline-setup. These are functional but generic — they carry no domain skills, have no safety hooks, and run with default tool access.

CodeForge **entirely replaces** all six built-in agents with enhanced custom specialists. This happens transparently through a `PreToolUse` hook that intercepts every agent spawn request and redirects it before execution. You never interact with a stock agent — every request is silently upgraded to a purpose-built specialist with frontloaded skills, calibrated model selection, and hook-based safety enforcement.

| Built-In Agent | Replaced By | What Changes |
|----------------|-------------|--------------|
| `Explore` | **explorer** | Haiku model for speed, ast-grep patterns skill, read-only enforcement |
| `Plan` | **architect** | Opus model for deep reasoning, api-design skill, structured 4-phase workflow |
| `general-purpose` | **generalist** | Full skill stack, spec workflow integration, plan mode support |
| `Bash` | **bash-exec** | Git safety protocols, path quoting enforcement, command validation |
| `claude-code-guide` | **claude-guide** | Pre-loaded Claude SDK and headless mode skills, documentation-first approach |
| `statusline-setup` | **statusline-config** | Sonnet model, focused tool access for status line configuration |

The redirect is fully transparent — you can use either the built-in name or the custom name interchangeably. Asking Claude to "explore the codebase" triggers the same enhanced explorer agent whether the system selects the `Explore` type or the `explorer` type.

Beyond the six replacements, CodeForge adds **11 entirely new specialists** that have no built-in equivalent: architect, researcher, test-writer, refactorer, doc-writer, migrator, security-auditor, dependency-analyst, git-archaeologist, perf-profiler, debug-logs, and spec-writer. These are available only in CodeForge.

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

### bash-exec

<span class="badge badge--orange">Full</span> <span class="badge badge--blue">Sonnet</span>

A command execution specialist for terminal operations. Handles git operations, build commands, test execution, process management, and complex shell scripting. Follows strict git safety protocols — never force-pushes, never amends without explicit permission, always quotes paths with spaces.

**When activated:** Shell scripting tasks, git operations, build automation, "run this command."

:::tip[Try this]
"Run the test suite for the auth module and show me a summary of results."
:::

### claude-guide

<span class="badge badge--green">Read-only</span> <span class="badge badge--blue">Haiku</span> <span class="badge badge--purple">claude-code-headless</span> <span class="badge badge--purple">claude-agent-sdk</span>

Your go-to expert for questions about Claude Code itself, the Claude Agent SDK, and the Claude API. Provides documentation-based guidance with specific examples and configuration snippets. Proactively suggests related features you might find useful.

**When activated:** Questions about Claude Code features, "how do I configure hooks," "how do I use the Agent SDK," "can Claude do X."

:::tip[Try this]
"How do I set up MCP tools with the Claude Agent SDK? Show me a TypeScript example."
:::

### debug-logs

<span class="badge badge--green">Read-only</span> <span class="badge badge--blue">Sonnet</span> <span class="badge badge--purple">debugging</span>

A log analysis specialist that finds and analyzes log files across Docker containers, application frameworks, and system services. Follows a priority-based discovery strategy — Docker container logs first, then application log files, then system logs. Establishes chronology across sources to identify root causes in error cascades.

**When activated:** Debugging sessions, "check the container logs," "why did this crash," error investigation, log analysis.

:::tip[Try this]
"Investigate why the API container keeps restarting. Check the Docker logs and look for OOM kills or crash loops."
:::

### dependency-analyst

<span class="badge badge--green">Read-only</span> <span class="badge badge--blue">Haiku</span> <span class="badge badge--purple">dependency-management</span>

Analyzes project dependencies for outdated packages, security vulnerabilities, version conflicts, unused dependencies, and license compliance issues. Supports Node.js, Python, Rust, and Go ecosystems. Runs in the background so you get results without waiting.

**When activated:** "Check for outdated dependencies," "audit dependencies," "npm audit," "pip audit," dependency health checks.

:::tip[Try this]
"Audit the project dependencies for security vulnerabilities and outdated packages."
:::

### doc-writer

<span class="badge badge--orange">Full (worktree)</span> <span class="badge badge--blue">Opus</span> <span class="badge badge--purple">documentation-patterns</span>

A technical writing specialist that creates and maintains README files, API documentation, inline comments (docstrings, JSDoc), and architectural guides. Reads and understands your code first, then produces documentation that reflects actual verified behavior — never aspirational or assumed behavior. Works in a git worktree for safe isolation.

**When activated:** "Write a README," "document this module," "add docstrings," API documentation requests.

:::tip[Try this]
"Document the public API for the user service module. Include usage examples and parameter descriptions."
:::

### explorer

<span class="badge badge--green">Read-only</span> <span class="badge badge--blue">Haiku</span>

A fast codebase navigator for file discovery, pattern matching, and structural analysis. Supports three thoroughness levels — quick (minimal tool calls), medium (balanced search), and very thorough (comprehensive investigation). Uses ast-grep and tree-sitter for syntax-aware structural search alongside standard Glob and Grep.

**When activated:** "Find all files matching," "where is X defined," "how is this project structured," codebase orientation.

:::tip[Try this]
"Find all API endpoint definitions in this project — very thorough. Show me the routing patterns and any anomalies."
:::

### generalist

<span class="badge badge--orange">Full</span> <span class="badge badge--blue">Sonnet</span>

The general-purpose development agent for tasks that don't fit a specialized role. Has access to all tools and can handle mixed workloads — small features, bug fixes, multi-file investigations, and miscellaneous development tasks. Used when no specialist clearly matches.

**When activated:** General development tasks, mixed-scope requests, tasks spanning multiple domains.

:::tip[Try this]
"Fix the pagination bug in the search results endpoint and update the tests to cover the edge case."
:::

### git-archaeologist

<span class="badge badge--green">Read-only</span> <span class="badge badge--blue">Haiku</span> <span class="badge badge--purple">git-forensics</span>

A git history forensics specialist that traces code evolution, finds when bugs were introduced, identifies authorship patterns, and recovers lost work from the reflog. Uses advanced git commands — blame with rename tracking (`-C -C -C`), pickaxe search (`-S`), and regex grep (`-G`). Never modifies git history or the working tree.

**When activated:** "When was this changed," "who wrote this code," "find when this bug was introduced," git blame, git history questions.

:::tip[Try this]
"Trace the history of the authentication middleware. When was it introduced, who has modified it, and what were the major changes?"
:::

### migrator

<span class="badge badge--orange">Full (worktree)</span> <span class="badge badge--blue">Opus</span> <span class="badge badge--purple">migration-patterns</span>

Plans and executes framework upgrades, language version bumps, API changes, and dependency migrations. Works methodically — creating a migration plan, transforming code in controlled steps, and verifying functionality after each change. Uses web research to consult official migration guides. Works in a git worktree so your main branch stays clean.

**When activated:** "Migrate from X to Y," "upgrade to version N," "update the framework," "modernize the codebase."

:::tip[Try this]
"Migrate our Pydantic v1 models to Pydantic v2 syntax. Plan the migration first, then execute it step by step."
:::

### perf-profiler

<span class="badge badge--green">Read-only</span> <span class="badge badge--blue">Sonnet</span> <span class="badge badge--purple">performance-profiling</span>

A performance engineer that measures application performance, identifies bottlenecks, and recommends targeted optimizations backed by profiling data. Follows a rigorous measure-first approach — collects data before making claims, and every recommendation references specific measurements. Runs in the background. Never modifies code directly.

**When activated:** "Profile this," "why is this slow," "find the bottleneck," "benchmark this function," performance questions.

:::tip[Try this]
"Profile the database query in the search endpoint. Measure response times and identify the bottleneck."
:::

### refactorer

<span class="badge badge--orange">Full (worktree)</span> <span class="badge badge--blue">Opus</span> <span class="badge badge--purple">refactoring-patterns</span>

A disciplined refactoring specialist that performs behavior-preserving code transformations. Identifies code smells (god classes, deep nesting, duplication, long parameter lists), applies established refactoring patterns (extract function, replace conditional with polymorphism, introduce parameter object), and rigorously verifies that tests pass after every single edit via a PostToolUse hook. Works in a git worktree.

**When activated:** "Refactor this," "clean up this code," "reduce complexity," "extract this function," "remove duplication."

:::tip[Try this]
"Refactor the OrderProcessor class — it's a god class with 400 lines. Split it into focused components while keeping all tests green."
:::

### researcher

<span class="badge badge--green">Read-only</span> <span class="badge badge--blue">Sonnet</span> <span class="badge badge--purple">documentation-patterns</span>

A technical research analyst that investigates codebases, searches documentation, and gathers web-based evidence to answer technical questions. Follows a disciplined codebase-first, web-second approach — local evidence is more reliable than generic documentation. Evaluates source recency, authority, and specificity. Produces structured reports with citations.

**When activated:** "How does X work," "research this topic," "compare X vs Y," technology evaluation, technical deep-dives.

:::tip[Try this]
"Research how our project handles authentication. Trace the full flow from request to authorization decision, then compare it against OWASP best practices."
:::

### security-auditor

<span class="badge badge--green">Read-only</span> <span class="badge badge--blue">Sonnet</span> <span class="badge badge--purple">security-checklist</span>

A senior application security engineer that audits codebases for vulnerabilities using a structured four-phase methodology: reconnaissance (map the attack surface), OWASP Top 10 scan (check every category systematically), secrets scan (find hardcoded credentials), and configuration review (Docker, environment variables). Rates findings from CRITICAL to INFO with specific remediation guidance. Runs in the background. Never exposes actual secret values in output.

**When activated:** "Audit this for security," "check for vulnerabilities," "scan for secrets," "OWASP review," security assessments.

:::tip[Try this]
"Run a full security audit on the project. Check for OWASP Top 10 vulnerabilities, hardcoded secrets, and dependency CVEs."
:::

### spec-writer

<span class="badge badge--green">Read-only</span> <span class="badge badge--blue">Opus</span> <span class="badge badge--purple">specification-writing</span>

A requirements engineer that creates structured technical specifications using the EARS (Easy Approach to Requirements Syntax) format for requirements and Given/When/Then patterns for acceptance criteria. Grounds every specification in the actual codebase state — reads existing code, tests, and interfaces before writing requirements.

**When activated:** "Write a spec for," "define requirements," "create acceptance criteria," specification authoring.

:::tip[Try this]
"Write a spec for the new notification preferences feature. Ground it in our existing user model and settings patterns."
:::

### statusline-config

<span class="badge badge--orange">Full</span> <span class="badge badge--blue">Sonnet</span>

A specialist for configuring the Claude Code terminal statusline. Converts shell PS1 prompts to statusline commands, builds custom status displays, and integrates project-specific information into the status bar. Only modifies Claude Code settings files.

**When activated:** "Set up my status line," "customize the status bar," "show git branch in status line."

:::tip[Try this]
"Convert my current PS1 prompt to a Claude Code statusline. Include git branch, Python version, and working directory."
:::

### test-writer

<span class="badge badge--orange">Full (worktree)</span> <span class="badge badge--blue">Opus</span> <span class="badge badge--purple">testing</span>

A senior test engineer that analyzes existing code and writes comprehensive test suites. Detects test frameworks (pytest, Vitest, Jest, Go testing, Rust tests), follows project conventions exactly, and verifies all written tests pass before completing. A Stop hook automatically checks that no tests are failing when the agent finishes. Works in a git worktree. Never modifies source code — if a bug is found, it reports the bug rather than fixing it.

**When activated:** "Write tests for," "add tests," "increase test coverage," "create unit tests," test writing requests.

:::tip[Try this]
"Write comprehensive tests for the payment processing module. Cover happy paths, edge cases, and error scenarios. Follow our existing pytest conventions."
:::

## Agent Capabilities Matrix

| Agent | Access | Model | Isolation | Background | Key Skills |
|-------|--------|-------|-----------|------------|------------|
| architect | Read-only | Opus | -- | -- | api-design |
| bash-exec | Full | Sonnet | -- | -- | -- |
| claude-guide | Read-only | Haiku | -- | -- | claude-code-headless, claude-agent-sdk |
| debug-logs | Read-only | Sonnet | -- | -- | debugging |
| dependency-analyst | Read-only | Haiku | -- | Yes | dependency-management |
| doc-writer | Full | Opus | Worktree | -- | documentation-patterns  |
| explorer | Read-only | Haiku | -- | -- | ast-grep-patterns |
| generalist | Full | Inherited | -- | -- | spec workflow |
| git-archaeologist | Read-only | Haiku | -- | -- | git-forensics |
| migrator | Full | Opus | Worktree | -- | migration-patterns |
| perf-profiler | Read-only | Sonnet | -- | Yes | performance-profiling |
| refactorer | Full | Opus | Worktree | -- | refactoring-patterns |
| researcher | Read-only | Sonnet | -- | -- | documentation-patterns |
| security-auditor | Read-only | Sonnet | -- | Yes | security-checklist |
| spec-writer | Read-only | Opus | -- | -- | specification-writing |
| statusline-config | Full | Sonnet | -- | -- | -- |
| test-writer | Full | Opus | Worktree | -- | testing |

## Access Levels at a Glance

| Access Level | Agents |
|-------------|--------|
| **Read-only** | architect, claude-guide, debug-logs, dependency-analyst, explorer, git-archaeologist, perf-profiler, researcher, security-auditor, spec-writer |
| **Full** | bash-exec, doc-writer, generalist, migrator, refactorer, statusline-config, test-writer |

:::note[About Model Selection]
Agents use different Claude models based on task complexity. Opus handles the most demanding tasks (architecture, refactoring, test writing, migration). Sonnet covers analytical tasks that need strong reasoning (security audits, research, debugging). Haiku powers fast, focused tasks (exploration, dependency analysis, git history). The generalist inherits whichever model the main session is using.
:::

## Safety Mechanisms

Several agents include built-in safety hooks:

- **Read-only bash guard** — The architect, explorer, security auditor, dependency analyst, and git-archaeologist all have a PreToolUse hook that blocks any Bash command that could modify files or state.
- **Git-readonly guard** — The git-archaeologist has a specialized guard that only permits read-only git subcommands (log, blame, show, diff, reflog, etc.).
- **Post-edit test verification** — The refactorer runs tests automatically after every single Edit operation. If tests fail, the change is immediately reverted.
- **Stop verification** — The test-writer has a Stop hook that verifies all written tests pass before the agent completes.

## Related

- [Agent System Plugin](../plugins/agent-system/) — how the agent system works
- [Skills](./skills/) — knowledge packs agents can leverage
- [Hooks](../customization/hooks/) — hook scripts that support agents
