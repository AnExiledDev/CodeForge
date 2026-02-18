# code-directive

The core Claude Code plugin for CodeForge. Provides 17 custom agent definitions, 28 coding reference skills, and 12 hook scripts spanning 6 lifecycle events. Handles agent redirection, skill suggestion, syntax validation, edited file collection, advisory testing, and session-start context injection.

## What It Does

### Agents (17)

Custom agent definitions that replace Claude Code's built-in subagents with enhanced, purpose-built alternatives. Each agent is a markdown prompt file in `agents/` that defines the agent's role, constraints, tools, and workflow.

| Agent | Role |
|-------|------|
| `architect` | System design, planning, architecture decisions |
| `bash-exec` | Shell command execution with safety guardrails |
| `claude-guide` | Claude Code usage guidance and troubleshooting |
| `debug-logs` | Log analysis and debugging |
| `dependency-analyst` | Dependency auditing, upgrades, and vulnerability analysis |
| `doc-writer` | Documentation authoring |
| `explorer` | Codebase exploration and context gathering |
| `generalist` | General-purpose tasks |
| `git-archaeologist` | Git history investigation and forensics |
| `migrator` | Code migration and framework upgrades |
| `perf-profiler` | Performance profiling and optimization |
| `refactorer` | Code refactoring and restructuring |
| `researcher` | Research and information gathering |
| `security-auditor` | Security review and vulnerability assessment |
| `spec-writer` | Specification authoring |
| `statusline-config` | Status line configuration |
| `test-writer` | Test authoring |

### Agent Redirection

The `redirect-builtin-agents.py` PreToolUse hook transparently swaps built-in agent types to custom agents whenever Claude spawns a subagent via the Task tool:

| Built-in Agent | Redirects To |
|----------------|--------------|
| `Explore` | `explorer` |
| `Plan` | `architect` |
| `general-purpose` | `generalist` |
| `Bash` | `bash-exec` |
| `claude-code-guide` | `claude-guide` |
| `statusline-setup` | `statusline-config` |

See `AGENT-REDIRECTION.md` for the full technical guide on how the PreToolUse hook contract works.

### Skills (28)

Reference skill packages that provide domain-specific knowledge. Each skill lives in its own directory under `skills/` with a `SKILL.md` entry point and optional `references/` subdirectory. Skills are loaded on demand via slash commands.

| Skill | Domain |
|-------|--------|
| `api-design` | REST conventions, error handling |
| `ast-grep-patterns` | Structural code search patterns |
| `claude-agent-sdk` | Claude Agent SDK (TypeScript) |
| `claude-code-headless` | Claude Code CLI, SDK, and MCP |
| `debugging` | Error patterns, log analysis |
| `dependency-management` | Package ecosystems, license compliance |
| `docker` | Dockerfile patterns, Compose services |
| `docker-py` | Docker SDK for Python |
| `documentation-patterns` | API docs, docstring formats |
| `fastapi` | FastAPI routing, Pydantic, SSE, middleware |
| `git-forensics` | Git investigation commands, playbooks |
| `migration-patterns` | Python and JavaScript migration guides |
| `performance-profiling` | Profiling tools, result interpretation |
| `pydantic-ai` | PydanticAI agents, tools, models |
| `refactoring-patterns` | Safe transformations, code smell catalog |
| `security-checklist` | OWASP patterns, secrets management |
| `skill-building` | Skill authoring patterns and principles |
| `spec-build` | Specification-driven implementation lifecycle |
| `spec-check` | Specification health audit |
| `spec-init` | Initialize `.specs/` directory |
| `spec-new` | Create new specification from template |
| `spec-refine` | Validate spec assumptions with user |
| `spec-review` | Verify implementation against spec |
| `spec-update` | As-built spec update |
| `specification-writing` | EARS templates, criteria patterns |
| `sqlite` | SQLite patterns (Python, JavaScript, advanced) |
| `svelte5` | Svelte 5 runes, components, routing |
| `testing` | FastAPI testing, Svelte testing |

### Hook Scripts (12)

| Script | Hook Event | Matcher | Purpose |
|--------|-----------|---------|---------|
| `redirect-builtin-agents.py` | PreToolUse | Task | Redirects built-in agents to custom agents |
| `skill-suggester.py` | UserPromptSubmit | * | Suggests relevant skills based on prompt keywords |
| `ticket-linker.py` | UserPromptSubmit | * | Auto-fetches GitHub issues/PRs referenced by #123 or URL |
| `skill-suggester.py` | SubagentStart | Plan | Suggests skills for planning agents |
| `inject-cwd.py` | SubagentStart | * | Injects working directory into subagent context |
| `advisory-test-runner.py` | Stop | * | Runs affected tests and injects results as context |
| `commit-reminder.py` | Stop | * | Advises about uncommitted changes |
| `spec-reminder.py` | Stop | * | Advises about spec updates after code changes |
| `git-state-injector.py` | SessionStart | * | Injects branch, status, and recent commits at session start |
| `todo-harvester.py` | SessionStart | * | Surfaces TODO/FIXME/HACK/XXX comments from the codebase |
| `syntax-validator.py` | PostToolUse | Edit\|Write | Validates JSON, JSONC, YAML, TOML syntax after edits |
| `collect-edited-files.py` | PostToolUse | Edit\|Write | Records edited file paths for batch formatting/linting |

## How It Works

### Hook Lifecycle

```
Session starts
  │
  ├─→ git-state-injector.py     Injects branch, status, recent commits
  └─→ todo-harvester.py         Surfaces TODO/FIXME markers

User submits a prompt
  │
  ├─→ skill-suggester.py        Suggests skills matching prompt keywords
  └─→ ticket-linker.py          Fetches GitHub issues referenced by #123 or URL

Claude spawns a subagent
  │
  ├─→ redirect-builtin-agents.py  Swaps built-in agents for custom ones (Task matcher)
  ├─→ skill-suggester.py          Suggests skills for Plan agents
  └─→ inject-cwd.py               Tells subagent the working directory

Claude edits a file (Edit/Write)
  │
  ├─→ syntax-validator.py       Validates JSON/YAML/TOML syntax immediately
  └─→ collect-edited-files.py   Appends path to session temp files

Claude stops responding
  │
  ├─→ advisory-test-runner.py   Runs affected tests, injects results
  ├─→ commit-reminder.py        Advises about uncommitted changes
  └─→ spec-reminder.py          Advises about spec updates
```

### Temp File Convention

Edited file paths are stored in session-scoped temp files for downstream consumption:
- `/tmp/claude-edited-files-{session_id}` — consumed by the `auto-formatter` plugin
- `/tmp/claude-lint-files-{session_id}` — consumed by the `auto-linter` plugin

### Advisory Test Runner

The test runner maps edited source files to their corresponding test files, runs only affected tests, and injects pass/fail results as `additionalContext`. It never blocks Claude — results are purely informational.

### Skill Suggester

Matches user prompts against keyword maps (phrases + individual terms) for each skill. When a skill matches, it injects a suggestion as `systemMessage` (UserPromptSubmit) or `additionalContext` (SubagentStart) so Claude knows which skill to load.

### Ticket Linker

Detects `#123` references and full GitHub issue/PR URLs in user prompts, fetches the ticket body via `gh`, and injects it as `additionalContext`. Handles up to 3 references per prompt with a 1500-character cap per ticket body.

### Timeouts

| Script | Timeout |
|--------|---------|
| redirect-builtin-agents.py | 5s |
| skill-suggester.py | 3s |
| ticket-linker.py | 12s |
| inject-cwd.py | 3s |
| advisory-test-runner.py | 20s |
| commit-reminder.py | 8s |
| spec-reminder.py | 8s |
| git-state-injector.py | 10s |
| todo-harvester.py | 8s |
| syntax-validator.py | 5s |
| collect-edited-files.py | 3s |

## Documentation

- `AGENT-REDIRECTION.md` — Technical guide to the PreToolUse hook contract for agent redirection
- `REVIEW-RUBRIC.md` — Quality rubric for agent and skill design, based on Anthropic's prompt engineering documentation

## Plugin Structure

```
code-directive/
├── .claude-plugin/
│   ├── plugin.json              # Plugin metadata
│   └── commands/
│       └── debug.md             # /debug slash command
├── agents/                      # 17 custom agent definitions
│   ├── architect.md
│   ├── bash-exec.md
│   ├── claude-guide.md
│   ├── debug-logs.md
│   ├── dependency-analyst.md
│   ├── doc-writer.md
│   ├── explorer.md
│   ├── generalist.md
│   ├── git-archaeologist.md
│   ├── migrator.md
│   ├── perf-profiler.md
│   ├── refactorer.md
│   ├── researcher.md
│   ├── security-auditor.md
│   ├── spec-writer.md
│   ├── statusline-config.md
│   └── test-writer.md
├── skills/                      # 28 coding reference skills
│   ├── api-design/
│   ├── ast-grep-patterns/
│   ├── claude-agent-sdk/
│   ├── claude-code-headless/
│   ├── debugging/
│   ├── dependency-management/
│   ├── docker/
│   ├── docker-py/
│   ├── documentation-patterns/
│   ├── fastapi/
│   ├── git-forensics/
│   ├── migration-patterns/
│   ├── performance-profiling/
│   ├── pydantic-ai/
│   ├── refactoring-patterns/
│   ├── security-checklist/
│   ├── skill-building/
│   ├── spec-build/
│   ├── spec-check/
│   ├── spec-init/
│   ├── spec-new/
│   ├── spec-refine/
│   ├── spec-review/
│   ├── spec-update/
│   ├── specification-writing/
│   ├── sqlite/
│   ├── svelte5/
│   └── testing/
├── hooks/
│   └── hooks.json               # All hook registrations (6 events, 12 scripts)
├── scripts/
│   ├── advisory-test-runner.py  # Stop: runs affected tests
│   ├── collect-edited-files.py  # PostToolUse: records edited file paths
│   ├── commit-reminder.py       # Stop: uncommitted changes advisory
│   ├── git-state-injector.py    # SessionStart: injects git state
│   ├── guard-readonly-bash.py   # Read-only bash guard (used by agents)
│   ├── inject-cwd.py            # SubagentStart: injects working directory
│   ├── redirect-builtin-agents.py # PreToolUse: agent redirection
│   ├── skill-suggester.py       # UserPromptSubmit/SubagentStart: skill suggestions
│   ├── spec-reminder.py         # Stop: spec update advisory
│   ├── syntax-validator.py      # PostToolUse: JSON/YAML/TOML validation
│   ├── ticket-linker.py         # UserPromptSubmit: auto-fetch GitHub issues
│   ├── todo-harvester.py        # SessionStart: TODO/FIXME surfacing
│   ├── verify-no-regression.py  # Test verification utility
│   └── verify-tests-pass.py     # Test verification utility
├── AGENT-REDIRECTION.md         # Agent redirection technical guide
└── REVIEW-RUBRIC.md             # Agent & skill quality rubric
```

## Requirements

- Python 3.11+
- Claude Code with plugin hook support
- [GitHub CLI](https://cli.github.com/) (`gh`) for ticket-linker functionality
