# agent-system

Claude Code plugin that provides 4 custom agents with automatic built-in agent redirection, working directory injection, read-only bash enforcement, and team quality gates. 15 additional agents are archived in `agents/_archived/` pending rewrite.

## What It Does

Replaces Claude Code's built-in agents with enhanced custom agents that carry domain-specific instructions, safety hooks, and tailored tool configurations. Also provides team orchestration quality gates.

### Active Agents

| Agent | Specialty | Access | Model |
|-------|-----------|--------|-------|
| architect | Implementation planning, trade-off analysis | Read-only | Opus |
| claude-guide | Claude Code features, configuration, best practices | Read-only | Opus |
| explorer | Fast codebase search and structure mapping | Read-only | Haiku |
| generalist | General-purpose multi-step tasks | Full access | Opus |

### Agent Redirection

Built-in agent types are transparently redirected to their enhanced custom equivalents:

| Built-in Type | Redirects To |
|---------------|-------------|
| Explore | explorer |
| Plan | architect |
| general-purpose | generalist |
| claude-code-guide | claude-guide |

### Archived Agents

The following agents are preserved in `agents/_archived/` for future rewrite:

bash-exec, debug-logs, dependency-analyst, documenter, git-archaeologist, implementer, investigator, migrator, perf-profiler, refactorer, researcher, security-auditor, spec-writer, statusline-config, test-writer

### Quality Gates

| Hook | Script | Purpose |
|------|--------|---------|
| TeammateIdle | `teammate-idle-check.py` | Prevents teammates from going idle with incomplete tasks |
| TaskCompleted | `task-completed-check.py` | Runs test suite before allowing task completion |

## How It Works

### Hook Lifecycle

```
Claude calls the Task tool (spawning a subagent)
  |
  +-> PreToolUse/Task fires
  |     |
  |     +-> redirect-builtin-agents.py
  |           |
  |           +-> Built-in agent name? -> Rewrite to custom agent
  |           +-> Already custom? -> Pass through
  |
  +-> Subagent works...
  |
  +-> TaskCompleted fires
  |     |
  |     +-> task-completed-check.py
  |           |
  |           +-> Detect test framework -> Run tests
  |           +-> Tests pass? -> Allow completion
  |           +-> Tests fail? -> Block, send feedback
  |
  +-> TeammateIdle fires (team mode)
        |
        +-> teammate-idle-check.py
              |
              +-> Check task list for incomplete tasks
              +-> Found? -> Send feedback to resume work
```

### Read-Only Bash Enforcement

Read-only agents (explorer, architect) have their Bash access restricted by `guard-readonly-bash.py`. Blocked operations include:

- File mutations: `rm`, `mv`, `cp`, `mkdir`, `touch`, `chmod`, `chown`
- Output redirection: `>`, `>>`, `tee`
- Command chaining with writes: pipes to destructive commands
- Eval/exec patterns

### Exit Code Behavior

| Script | Exit 0 | Exit 2 |
|--------|--------|--------|
| redirect-builtin-agents.py | Allow (or rewrite) | Block with error |
| guard-readonly-bash.py | Allow command | Block write operation |
| task-completed-check.py | Tests pass | Tests fail (block completion) |
| teammate-idle-check.py | No incomplete tasks | Has incomplete tasks |

### Timeouts

| Hook | Timeout |
|------|---------|
| Agent redirection (PreToolUse) | 5s |
| Teammate idle check | 10s |
| Task completed check | 60s |

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
       "agent-system@<clone-path>/.devcontainer/plugins/devs-marketplace": true
     }
   }
   ```

   Replace `<clone-path>` with the absolute path to your CodeForge clone.

## Plugin Structure

```
agent-system/
+-- .claude-plugin/
|   +-- plugin.json                  # Plugin metadata
+-- agents/
|   +-- architect.md                 # 4 active agents
|   +-- claude-guide.md
|   +-- explorer.md
|   +-- generalist.md
|   +-- _archived/                   # 15 agents pending rewrite
|       +-- bash-exec.md
|       +-- debug-logs.md
|       +-- dependency-analyst.md
|       +-- documenter.md
|       +-- git-archaeologist.md
|       +-- implementer.md
|       +-- investigator.md
|       +-- migrator.md
|       +-- perf-profiler.md
|       +-- refactorer.md
|       +-- researcher.md
|       +-- security-auditor.md
|       +-- spec-writer.md
|       +-- statusline-config.md
|       +-- test-writer.md
+-- hooks/
|   +-- hooks.json                   # Hook registrations
+-- scripts/
|   +-- guard-readonly-bash.py       # Read-only bash enforcement
|   +-- redirect-builtin-agents.py   # Built-in agent redirection
|   +-- task-completed-check.py      # Test suite quality gate
|   +-- teammate-idle-check.py       # Incomplete task checker
|   +-- verify-no-regression.py      # Post-edit regression tests (dormant — agents archived)
|   +-- verify-tests-pass.py         # Test verification (dormant — agents archived)
+-- skills/
|   +-- _archived/
|       +-- debug/
|           +-- SKILL.md             # Log investigation skill (archived)
+-- AGENT-REDIRECTION.md             # Redirection mechanism docs
+-- REVIEW-RUBRIC.md                 # Agent/skill quality rubric
+-- README.md                        # This file
```

## Requirements

- Python 3.11+
- Claude Code with plugin hook support (agents, hooks, skills)
