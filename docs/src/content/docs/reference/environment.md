---
title: Environment Variables
description: Complete reference of all environment variables used by CodeForge and its plugins.
sidebar:
  order: 3
---

Environment variables control CodeForge runtime behavior. They can be set in `devcontainer.json`, the `settings.json` env block, your shell profile, or per-session on the command line.

## Claude Code Variables

Variables that control Claude Code's core behavior inside the CodeForge container.

| Variable | Description | Default | Set In |
|----------|-------------|---------|--------|
| `ANTHROPIC_MODEL` | Primary Claude model ID | `claude-opus-4-6` | settings.json |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | Opus model ID | `claude-opus-4-6` | settings.json |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | Sonnet model ID | `claude-sonnet-4-5-20250929` | settings.json |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | Haiku model ID | `claude-haiku-4-5-20251001` | settings.json |
| `CLAUDE_CONFIG_DIR` | Claude Code configuration directory | `/workspaces/.claude` | devcontainer.json |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | Maximum tokens per response | `64000` | settings.json |
| `MAX_THINKING_TOKENS` | Maximum tokens for extended thinking | `63999` | settings.json |
| `CLAUDE_CODE_SHELL` | Shell used for Bash tool execution | `zsh` | settings.json |
| `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` | Context usage percentage that triggers auto-compaction | `95` | settings.json |
| `CLAUDE_CODE_DISABLE_AUTO_MEMORY` | Disable automatic memory features (`0` = enabled) | `0` | settings.json |

## Agent Teams Variables

Variables that configure Claude Code's multi-agent team capabilities.

| Variable | Description | Default | Set In |
|----------|-------------|---------|--------|
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | Enable Agent Teams feature | `1` | settings.json |
| `CLAUDE_CODE_ENABLE_TASKS` | Enable structured task tracking | `true` | settings.json |
| `CLAUDE_CODE_EFFORT_LEVEL` | Response effort level (`low`, `medium`, `high`) | `high` | settings.json |
| `CLAUDE_CODE_PLAN_MODE_INTERVIEW_PHASE` | Enable interview phase in plan mode | `true` | settings.json |
| `CLAUDE_CODE_PLAN_V2_AGENT_COUNT` | Number of agents in plan mode v2 | `3` | settings.json |
| `CLAUDE_CODE_PLAN_MODE_REQUIRED` | Require teammates to run in plan mode until approved | `true` | settings.json |

## Runtime Limits

Variables that control timeouts, output sizes, and concurrency.

| Variable | Description | Default | Set In |
|----------|-------------|---------|--------|
| `BASH_DEFAULT_TIMEOUT_MS` | Default timeout for Bash tool commands (ms) | `240000` | settings.json |
| `BASH_MAX_TIMEOUT_MS` | Maximum allowed Bash timeout (ms) | `600000` | settings.json |
| `BASH_MAX_OUTPUT_LENGTH` | Maximum Bash output length (chars) | `15000` | settings.json |
| `TASK_MAX_OUTPUT_LENGTH` | Maximum Task tool output length (chars) | `64000` | settings.json |
| `MAX_MCP_OUTPUT_TOKENS` | Maximum MCP server output tokens | `10000` | settings.json |
| `MCP_TIMEOUT` | MCP server connection timeout (ms) | `120000` | settings.json |
| `MCP_TOOL_TIMEOUT` | Individual MCP tool call timeout (ms) | `30000` | settings.json |
| `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` | Maximum concurrent tool calls | `5` | settings.json |
| `CLAUDE_CODE_MAX_RETRIES` | Maximum retries for failed API calls | `1` | settings.json |

## Plugin and Feature Variables

Variables that control CodeForge's plugin system and features.

| Variable | Description | Default | Set In |
|----------|-------------|---------|--------|
| `FORCE_AUTOUPDATE_PLUGINS` | Auto-update plugins on session start | `1` | settings.json |
| `ENABLE_TOOL_SEARCH` | Tool search mode and limit | `auto:5` | settings.json |
| `ENABLE_CLAUDE_CODE_SM_COMPACT` | Enable smart compaction | `1` | settings.json |
| `CLAUDE_CODE_FORCE_GLOBAL_CACHE` | Force global prompt cache | `1` | settings.json |

## Workspace Variables

Variables set by the DevContainer environment that define workspace paths.

| Variable | Description | Default | Set In |
|----------|-------------|---------|--------|
| `WORKSPACE_ROOT` | Workspace root directory | `/workspaces` | devcontainer.json |
| `CLAUDE_CONFIG_DIR` | Claude configuration directory | `/workspaces/.claude` | devcontainer.json |
| `GH_CONFIG_DIR` | GitHub CLI configuration directory | `/workspaces/.gh` | devcontainer.json |
| `TMPDIR` | Temporary files directory | `/workspaces/.tmp` | devcontainer.json |
| `CLAUDECODE` | Set to `null` to unset the detection flag, enabling nested Claude Code sessions | `null` | devcontainer.json |

## Tool-Specific Variables

Variables that configure individual tools within the container.

| Variable | Tool | Description |
|----------|------|-------------|
| `CCMS_PROJECT` | ccms | Default project scope for session search |
| `CCMS_FORMAT` | ccms | Default output format (`text`, `json`) |
| `RUFF_CONFIG` | ruff | Path to ruff configuration file |
| `BIOME_CONFIG_PATH` | biome | Path to biome configuration file |

## Language Runtime Variables

Variables for language runtimes installed in the container.

| Variable | Description |
|----------|-------------|
| `UV_PYTHON` | Python version used by uv |
| `VIRTUAL_ENV` | Active virtual environment path |
| `PYTHONPATH` | Python module search path |
| `NVM_DIR` | nvm installation directory |
| `NODE_VERSION` | Active Node.js version |
| `BUN_INSTALL` | Bun installation directory |

## Setting Environment Variables

There are four ways to set environment variables, listed from lowest to highest precedence.

### In devcontainer.json (Container Level)

Applied when the container is created. Persists across all sessions.

```json
{
  "remoteEnv": {
    "WORKSPACE_ROOT": "/workspaces",
    "CLAUDE_CONFIG_DIR": "/workspaces/.claude"
  }
}
```

### In settings.json (Claude Code Level)

Applied when Claude Code starts. These are set inside the `env` block.

```json
{
  "env": {
    "ANTHROPIC_MODEL": "claude-sonnet-4-5-20250929",
    "CLAUDE_CODE_EFFORT_LEVEL": "medium"
  }
}
```

### In Shell Profile (User Level)

Add to `~/.zshrc` or `~/.bashrc`. Applied for every new shell session.

```bash
export CLAUDE_MODEL="claude-sonnet-4-5-20250929"
```

### Per-Session (Highest Precedence)

Set on the command line when launching Claude Code. Overrides everything else.

```bash
ANTHROPIC_MODEL="claude-sonnet-4-5-20250929" cc
```

## Common Customizations

Here are the environment variable changes you are most likely to make:

| Goal | Variable | Value |
|------|----------|-------|
| Use Sonnet instead of Opus | `ANTHROPIC_MODEL` | `claude-sonnet-4-5-20250929` |
| Increase Bash timeout for long builds | `BASH_DEFAULT_TIMEOUT_MS` | `600000` |
| Reduce auto-compact aggressiveness | `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` | `85` |
| Disable extended thinking | (remove `alwaysThinkingEnabled` from settings.json) | -- |
| Limit concurrent tool calls | `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` | `3` |

## Related

- [Configuration](../customization/configuration/) -- settings.json structure and file manifest
- [Commands](./commands/) -- commands that use these variables
- [Architecture](./architecture/) -- how configuration layers interact at runtime
