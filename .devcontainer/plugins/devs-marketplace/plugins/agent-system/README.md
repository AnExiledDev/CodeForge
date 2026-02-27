# agent-system

Claude Code plugin that provides 19 custom agents (3 workhorse + 16 specialist) with automatic built-in agent redirection, working directory injection, read-only bash enforcement, and team quality gates.

## What It Does

Replaces Claude Code's built-in agents with enhanced custom agents that carry domain-specific instructions, safety hooks, and tailored tool configurations. Also provides team orchestration quality gates.

### Workhorse Agents

General-purpose agents designed for orchestrator mode (`cc-orc`). Each covers a broad domain, carrying detailed execution discipline, code standards, and a question-surfacing protocol.

| Agent | Domain | Access | Model |
|-------|--------|--------|-------|
| investigator | Cross-domain research spanning 2+ specialist areas | Read-only | Sonnet |
| implementer | Code changes, bug fixes, refactoring, migrations | Full access (worktree) | Opus |
| documenter | Documentation, specs, spec lifecycle, docstrings, architecture docs | Full access (worktree) | Opus |

### Specialist Agents

Domain-specific agents for targeted tasks. Used by both `cc` (monolithic) and `cc-orc` (orchestrator) modes.

| Agent | Specialty | Access |
|-------|-----------|--------|
| architect | Implementation planning, trade-off analysis | Read-only |
| bash-exec | Terminal command execution | Bash only |
| claude-guide | Claude Code features, configuration, best practices | Read-only |
| debug-logs | Log investigation and issue diagnosis | Read-only |
| dependency-analyst | Outdated/vulnerable dependency analysis | Read-only |
| explorer | Fast codebase search and structure mapping | Read-only |
| generalist | General-purpose multi-step tasks | Full access |
| git-archaeologist | Git history, blame, branch analysis | Read-only |
| migrator | Framework/version upgrades and migrations | Full access |
| perf-profiler | Profiling, benchmarks, bottleneck identification | Read-only |
| refactorer | Safe code transformations with regression testing | Full access |
| researcher | Web research, technology investigation | Read-only |
| security-auditor | OWASP audit, secrets scan, vulnerability detection | Read-only |
| spec-writer | EARS requirements, acceptance criteria, feature specs | Read-only |
| statusline-config | Claude Code status line configuration | Full access |
| test-writer | Test suites with auto-verification | Full access |

### Agent Redirection

Built-in agent types are transparently redirected to their enhanced custom equivalents:

| Built-in Type | Redirects To |
|---------------|-------------|
| Explore | explorer |
| Plan | architect |
| general-purpose | generalist |
| Bash | bash-exec |
| claude-code-guide | claude-guide |
| statusline-setup | statusline-config |

### Quality Gates

| Hook | Script | Purpose |
|------|--------|---------|
| TeammateIdle | `teammate-idle-check.py` | Prevents teammates from going idle with incomplete tasks |
| TaskCompleted | `task-completed-check.py` | Runs test suite before allowing task completion |

Per-agent hooks (registered within agent definitions, not in hooks.json):

| Agent | Hook | Script | Purpose |
|-------|------|--------|---------|
| implementer | PostToolUse (Edit) | `verify-no-regression.py` | Runs tests after each edit to catch regressions |
| refactorer | PostToolUse (Edit) | `verify-no-regression.py` | Runs tests after each edit to catch regressions |
| test-writer | Stop | `verify-tests-pass.py` | Verifies written tests actually pass |

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
  +-> SubagentStart fires (all subagents)
  |     |
  |     +-> inject-cwd.py
  |           |
  |           +-> Injects working directory as additionalContext
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

Read-only agents (explorer, researcher, architect, etc.) have their Bash access restricted by `guard-readonly-bash.py`. Blocked operations include:

- File mutations: `rm`, `mv`, `cp`, `mkdir`, `touch`, `chmod`, `chown`
- Output redirection: `>`, `>>`, `tee`
- Command chaining with writes: pipes to destructive commands
- Eval/exec patterns

### Exit Code Behavior

| Script | Exit 0 | Exit 2 |
|--------|--------|--------|
| redirect-builtin-agents.py | Allow (or rewrite) | Block with error |
| inject-cwd.py | Inject context | N/A |
| guard-readonly-bash.py | Allow command | Block write operation |
| task-completed-check.py | Tests pass | Tests fail (block completion) |
| teammate-idle-check.py | No incomplete tasks | Has incomplete tasks |

### Timeouts

| Hook | Timeout |
|------|---------|
| Agent redirection (PreToolUse) | 5s |
| CWD injection (SubagentStart) | 3s |
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
|   +-- investigator.md              # 3 workhorse agents (orchestrator mode)
|   +-- implementer.md
|   +-- documenter.md
|   +-- architect.md                 # 16 specialist agents
|   +-- bash-exec.md
|   +-- claude-guide.md
|   +-- debug-logs.md
|   +-- dependency-analyst.md
|   +-- explorer.md
|   +-- generalist.md
|   +-- git-archaeologist.md
|   +-- migrator.md
|   +-- perf-profiler.md
|   +-- refactorer.md
|   +-- researcher.md
|   +-- security-auditor.md
|   +-- spec-writer.md
|   +-- statusline-config.md
|   +-- test-writer.md
+-- hooks/
|   +-- hooks.json                   # Hook registrations
+-- scripts/
|   +-- guard-readonly-bash.py       # Read-only bash enforcement
|   +-- inject-cwd.py               # Working directory injection
|   +-- redirect-builtin-agents.py   # Built-in agent redirection
|   +-- task-completed-check.py      # Test suite quality gate
|   +-- teammate-idle-check.py       # Incomplete task checker
|   +-- verify-no-regression.py      # Post-edit regression tests (implementer, refactorer)
|   +-- verify-tests-pass.py         # Test verification (test-writer)
+-- skills/
|   +-- debug/
|       +-- SKILL.md                 # Structured log investigation skill
+-- AGENT-REDIRECTION.md             # Redirection mechanism docs
+-- REVIEW-RUBRIC.md                 # Agent/skill quality rubric
+-- README.md                        # This file
```

## Requirements

- Python 3.11+
- Claude Code with plugin hook support (agents, hooks, skills)
