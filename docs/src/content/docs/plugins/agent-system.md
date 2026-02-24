---
title: Agent System
description: The agent system plugin provides 17 specialized AI agents with automatic delegation, CWD injection, and read-only enforcement.
sidebar:
  order: 2
---

The agent system is CodeForge's flagship plugin. It gives you access to 17 specialized AI agents, each purpose-built for a specific kind of development task — from architecture planning and code exploration to test writing and security auditing. When you make a request, the system automatically delegates to the most appropriate agent, so you get expert-level results without having to think about which tool to use.

## How Delegation Works

When you ask Claude to do something, the agent system analyzes your request and routes it to the specialist best suited for the job. Each agent carries its own system prompt, tool restrictions, permission mode, and domain expertise. This means an architecture question goes to an agent that thinks in terms of system design, while a "write tests for this" request goes to an agent that knows testing frameworks inside and out.

Delegation happens transparently. You just describe what you need, and the right agent picks it up. Here are some examples:

- **"Plan the implementation for user notifications"** routes to the **architect** agent, which explores the codebase, identifies patterns, and produces a structured plan — without modifying any files
- **"Find all API endpoint definitions"** routes to the **explorer** agent, which uses Glob, Grep, and ast-grep to efficiently discover and map code
- **"Write tests for the auth module"** routes to the **test-writer** agent, which detects your test framework, studies existing conventions, writes comprehensive tests, and verifies they pass
- **"Refactor this function to reduce complexity"** routes to the **refactorer** agent, which works in a git worktree and runs regression checks after every edit

:::tip[You Can Be Specific]
While automatic delegation works well for most requests, you can always ask for a specific agent by name: "Use the security-auditor to review this endpoint" or "Have the architect plan this migration."
:::

### What Makes Agents Different From Regular Prompts

Each agent is more than just a system prompt. Agents carry:

- **Tool restrictions** — read-only agents physically cannot modify files. The explorer, architect, and researcher agents have their write tools removed entirely.
- **Permission modes** — some agents run in `plan` mode (read-only), others in `acceptEdits` (can write with approval), and the generalist inherits the session's default.
- **Frontloaded skills** — agents come pre-loaded with relevant skills. The architect gets `api-design` and spec skills. The test-writer gets the `testing` skill. This domain knowledge is available immediately without manual activation.
- **Custom hooks** — agents can register their own hooks. The refactorer runs `verify-no-regression.py` after every edit. The test-writer runs `verify-tests-pass.py` at the end of every turn.
- **Isolation** — destructive agents like the refactorer and test-writer work in git worktrees, keeping your main branch clean until changes are verified.

## Built-In Agent Redirection

One of CodeForge's most distinctive features is that it **completely replaces Claude Code's built-in agents** with enhanced custom specialists. This is not a prompt-level suggestion — it is a hook-level interception that guarantees every agent spawn uses a CodeForge specialist instead of a stock agent.

### How It Works

The `redirect-builtin-agents.py` script registers as a `PreToolUse` hook on the `Task` tool. Every time Claude spawns a subagent, the hook fires before the agent is created:

1. The hook reads the requested `subagent_type` from the Task tool input
2. It checks the type against a redirect map of built-in → custom agent mappings
3. If the type matches a built-in agent, the hook rewrites the `subagent_type` to the fully-qualified custom agent name (e.g., `Explore` becomes `agent-system:explorer`)
4. The modified request proceeds, and the custom agent spawns instead of the stock one
5. All other parameters — the prompt, description, and context — pass through unchanged

The redirect map covers all six of Claude Code's built-in agent types:

```python
REDIRECT_MAP = {
    "Explore":            "explorer",
    "Plan":               "architect",
    "general-purpose":    "generalist",
    "Bash":               "bash-exec",
    "claude-code-guide":  "claude-guide",
    "statusline-setup":   "statusline-config",
}
```

### What the Upgrade Delivers

Each redirect is a strict improvement. The custom agents carry capabilities that stock agents lack:

- **Frontloaded skills** — the architect loads `api-design`, the explorer loads `ast-grep-patterns`, the claude-guide loads `claude-code-headless` and `claude-agent-sdk`. Stock agents load nothing.
- **Calibrated models** — the architect uses Opus for deep reasoning, the explorer uses Haiku for speed. Stock agents all inherit the session default.
- **Safety hooks** — read-only agents have `guard-readonly-bash.py` blocking write operations. The refactorer runs regression checks after every edit. Stock agents have no per-agent safety enforcement.
- **Focused system prompts** — each custom agent has a detailed system prompt shaping its behavior, expertise boundaries, and workflow. Stock agents use a generic prompt.
- **Worktree isolation** — the test-writer, refactorer, migrator, and doc-writer work in isolated git worktrees. Stock agents always work on the active branch.

The redirect is fully transparent to you and to Claude. Using either name works — `Explore` and `explorer` both resolve to the same enhanced agent.

:::note[The Seventh Agent Type]
Claude Code has a seventh built-in agent type, `magic-docs`, used internally for documentation updates. This agent is **not** redirected — it runs natively. All other six built-in types are intercepted and replaced.
:::

## Safety Mechanisms

The agent system includes two key safety mechanisms that run automatically.

### CWD Injection

Every time a subagent starts, the `inject-cwd.py` hook fires. It reads the current working directory and injects it as context for the agent, ensuring every agent knows exactly which project directory to work in. This prevents agents from accidentally operating in the wrong directory — a subtle but important safeguard when working across multiple projects.

The hook fires on the `SubagentStart` event and adds a message like: *"Working Directory: /workspaces/projects/MyApp — restrict all file operations to this directory."*

### Read-Only Enforcement

Agents marked as read-only (architect, explorer, researcher, and others) are protected by `guard-readonly-bash.py`. This hook intercepts every Bash command before execution and blocks anything that would modify state.

The guard is thorough. It blocks:

- **File mutations** — `rm`, `mv`, `cp`, `mkdir`, `touch`, `chmod`, and dozens more
- **Git writes** — `git push`, `git commit`, `git merge`, `git reset`, and other state-changing git commands
- **Package managers** — `pip install`, `npm install`, `cargo install`, and similar
- **Redirections** — output redirection (`>`, `>>`) that would create or overwrite files
- **Bypass attempts** — command chaining (`&&`, `||`, `;`), piping into interpreters (`curl | bash`), command substitution (`$(rm file)`), and path-prefixed commands (`/usr/bin/rm`)

The guard supports two modes: `general-readonly` (blocklist approach — blocks known write commands) and `git-readonly` (allowlist approach — only permits specific safe commands like `git log`, `git diff`, `git blame`, and a curated set of read-only utilities).

:::caution[Read-Only Is Enforced, Not Requested]
Read-only agents don't just have instructions saying "don't write files." The guard script actively intercepts and blocks write operations at the hook level. Even if an agent's system prompt were ignored, the hook would still prevent modifications.
:::

## Agent Reference

CodeForge includes 17 specialized agents. Each one is tailored for a specific class of development task.

### Read-Only Agents

These agents investigate, analyze, and report — they never modify files.

| Agent | Role | Model | Skills |
|-------|------|-------|--------|
| **architect** | System design, implementation planning, trade-off analysis | Opus | api-design, spec skills |
| **explorer** | Fast codebase navigation, file discovery, pattern matching | Haiku | ast-grep-patterns |
| **researcher** | Deep investigation, information gathering, web research | Sonnet | documentation-patterns |
| **claude-guide** | Claude Code usage guidance and best practices | Haiku | claude-code-headless, claude-agent-sdk |
| **debug-logs** | Log analysis, error diagnosis, debugging | Sonnet | debugging |
| **dependency-analyst** | Dependency analysis, version conflicts, upgrade paths | Haiku | dependency-management |
| **git-archaeologist** | Git history analysis, blame, bisect, forensics | Haiku | git-forensics |
| **perf-profiler** | Performance profiling, bottleneck identification | Sonnet | performance-profiling |
| **security-auditor** | Security audit, vulnerability assessment, OWASP checks | Sonnet | security-checklist |
| **spec-writer** | Specification authoring and refinement | Opus | specification-writing |

### Full-Access Agents

These agents can read and write files, run commands, and make changes to your codebase.

| Agent | Role | Model | Isolation | Skills |
|-------|------|-------|-----------|--------|
| **generalist** | General-purpose development tasks | Inherited | No | spec skills |
| **test-writer** | Test creation, coverage analysis, framework detection | Opus | Worktree | testing |
| **refactorer** | Behavior-preserving code transformations | Opus | Worktree | refactoring-patterns |
| **doc-writer** | Documentation writing and maintenance | Opus | Worktree | documentation-patterns |
| **migrator** | Code migration, framework upgrades | Opus | Worktree | migration-patterns |
| **bash-exec** | Shell command execution and scripting | Sonnet | No | — |
| **statusline-config** | Statusline customization | Sonnet | No | — |

:::note[Model Selection]
Agents use different Claude models based on task complexity. The architect, test-writer, refactorer, doc-writer, migrator, and spec-writer use Opus for maximum reasoning capability. The explorer, dependency-analyst, and git-archaeologist use Haiku for speed. The researcher, security-auditor, debug-logs, perf-profiler, bash-exec, and statusline-config use Sonnet for balanced performance. The generalist inherits the session's model setting.
:::

## Hook Scripts

The agent system registers hooks across several lifecycle events:

| Script | Event | What It Does |
|--------|-------|-------------|
| `redirect-builtin-agents.py` | PreToolUse (Task) | Redirects built-in agent types to CodeForge's custom specialists |
| `inject-cwd.py` | SubagentStart | Injects the working directory so agents operate in the correct project |
| `guard-readonly-bash.py` | PreToolUse (Bash) | Blocks write operations for read-only agents |
| `verify-no-regression.py` | PostToolUse (Edit) | Checks for test regressions after code edits (refactorer) |
| `verify-tests-pass.py` | Stop | Validates all tests pass at the end of a turn (test-writer) |
| `task-completed-check.py` | TaskCompleted | Verifies task results meet requirements in team workflows |
| `teammate-idle-check.py` | TeammateIdle | Monitors teammate activity and reassigns work if needed |

## How Agent Definitions Work

Each agent is defined as a Markdown file in the plugin's `agents/` directory. The file's YAML frontmatter configures the agent's technical properties, while the Markdown body contains the agent's system prompt.

Here is a simplified example of what an agent definition looks like:

```yaml
---
name: architect
description: >-
  Read-only software architect agent that designs implementation plans...
tools: Read, Glob, Grep, Bash, WebSearch, WebFetch
model: opus
permissionMode: plan
skills:
  - api-design
  - spec-new
hooks:
  PreToolUse:
    - matcher: Bash
      type: command
      command: "python3 ${CLAUDE_PLUGIN_ROOT}/scripts/guard-readonly-bash.py --mode general-readonly"
---

# Architect Agent

You are a **senior software architect** specializing in implementation planning...
```

The `tools` field controls which tools the agent can access. The `permissionMode` sets the approval level. The `hooks` section registers agent-specific hooks that only fire for that particular agent. The `skills` field pre-loads domain knowledge.

The frontmatter also supports several other configuration options:

| Field | Purpose | Example Values |
|-------|---------|----------------|
| `model` | Which Claude model the agent uses | `opus`, `sonnet`, `haiku`, `inherit` |
| `color` | Agent identifier color in the UI | `magenta`, `blue`, `green`, `yellow` |
| `permissionMode` | Tool approval level | `plan`, `acceptEdits`, `default` |
| `isolation` | Whether the agent works in a git worktree | `worktree` (or omitted for no isolation) |
| `memory` | Memory persistence scope | `project` |
| `disallowedTools` | Tools explicitly blocked for the agent | `EnterPlanMode`, `TeamCreate` |

### Project Context Discovery

Every agent follows a standardized project context discovery process before starting work. This ensures agents respect project-specific conventions, tech stack choices, and architectural boundaries:

1. **Read Claude Rules** — agents scan `.claude/rules/*.md` for mandatory constraints like workspace scoping and spec workflow rules
2. **Read CLAUDE.md files** — agents walk up the directory tree reading `CLAUDE.md` files at each level, where more specific files take precedence over general ones
3. **Apply conventions** — naming patterns, framework choices, architecture boundaries, and workflow rules discovered in these files override the agent's defaults

This discovery process is particularly important because it means agents adapt to your project rather than applying generic patterns.

## Team Workflows

The agent system supports multi-agent team workflows for complex tasks. When a task is too large for a single agent, the system can spawn a team of specialists that work in parallel on different aspects of the problem.

For example, implementing a feature from a specification might involve:
- A **researcher** exploring the codebase for patterns and conventions
- A **test-writer** creating tests in a worktree
- A **doc-writer** updating documentation

The team is coordinated through the task system, with hooks like `task-completed-check.py` and `teammate-idle-check.py` ensuring smooth collaboration.

The recommended team compositions vary by task type:

| Task Type | Recommended Teammates |
|-----------|----------------------|
| Full-stack feature | researcher + test-writer + doc-writer |
| Backend-heavy work | researcher + test-writer |
| Security-sensitive feature | security-auditor + test-writer |
| Refactoring | refactorer + test-writer |
| Multi-service change | researcher per service + test-writer |

See the [Spec Workflow](./spec-workflow/) plugin for how team spawning integrates with specification-driven development.

## Related

- [Agents Reference](../features/agents/) — detailed per-agent documentation with usage examples
- [Skills Reference](../features/skills/) — skills that agents leverage for domain expertise
- [Hooks](../customization/hooks/) — how hook scripts integrate with the agent lifecycle
- [Skill Engine](./skill-engine/) — the plugin that manages skill auto-suggestion
