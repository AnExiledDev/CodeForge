# oh-my-claude

Multi-provider proxy for Claude Code with Chinese LLM routing.

## Description

Installs [oh-my-claude](https://github.com/lgcyaxi/oh-my-claude), a proxy that routes Claude Code API calls to Chinese LLM providers (Kimi, DeepSeek, Qwen, Zhipu, MiniMax).

**Important**: This feature installs agents only (`--skip-hooks --skip-mcp`). CodeForge manages settings.json separately to avoid conflicts.

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `version` | string | `latest` | oh-my-claude version to install (`latest`, `2.2.3`, `none` to skip) |
| `autostart` | boolean | `true` | Auto-start proxy on container start |
| `providerAgentsOnly` | boolean | `true` | Keep only provider agents, delete role agents |

## Provider Agents (Kept)

When `providerAgentsOnly: true`, these 6 agents are preserved:

- `@kimi` — Moonshot Kimi
- `@deepseek` — DeepSeek
- `@deepseek-r` — DeepSeek Reasoner
- `@qwen` — Alibaba Qwen (via Aliyun DashScope)
- `@zhipu` — Zhipu GLM
- `@mm-cn` — MiniMax

## Role Agents (Deleted)

These 11 agents are removed when `providerAgentsOnly: true`:

sisyphus, prometheus, claude-reviewer, claude-scout, oracle, ui-designer, analyst, librarian, document-writer, navigator, hephaestus

## Disabled Tools

The `cc`/`claude` aliases disable these oh-my-claude MCP tools via `--disallowedTools`:

**Memory (9)**: remember, recall, get_memory, forget, list_memories, memory_status, compact_memories, clear_memories, summarize_memories

**Preferences (7)**: add_preference, list_preferences, get_preference, update_preference, delete_preference, match_preferences, preference_stats

**Coworker (1)**: coworker_task

**Kept (3)**: switch_model, switch_status, switch_revert (proxy routing)

## Usage

```bash
omc proxy start        # Start the proxy
omc proxy stop         # Stop the proxy  
omc proxy status       # Check proxy status
omc proxy switch MODEL # Switch to a different model
```

## Authentication

Set provider API keys in `.devcontainer/.secrets`:

```bash
KIMI_API_KEY=
ZHIPU_API_KEY=
ALIYUN_API_KEY=
MINIMAX_API_KEY=
DEEPSEEK_API_KEY=
```

oh-my-claude has built-in provider configs — no separate config file needed. Just set the API keys and they'll be picked up automatically.

## Notes

- oh-my-claude does not install skills/commands in current version (2.2.x)
- The feature skips hooks and MCP server installation to avoid settings.json conflicts
- Statusline integration is disabled to preserve ccstatusline
