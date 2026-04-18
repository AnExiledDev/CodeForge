# oh-my-claude

Opt-in integration for [oh-my-claude](https://github.com/lgcyaxi/oh-my-claude), a multi-provider Claude Code launcher with per-session proxy routing for providers such as DeepSeek, Kimi, Aliyun/Qwen, ZhiPu/Z.AI, MiniMax, OpenRouter, and Ollama.

CodeForge keeps ownership of Claude Code settings, hooks, MCP servers, statusline, and the default `cc` aliases. This feature installs the OMC CLI and generated agents, while skipping OMC hooks and MCP setup to avoid conflicts.

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `version` | string | `latest` | oh-my-claude npm version to install (`latest`, a semver, or `none`) |
| `shells` | string | `both` | Shells to clean up legacy OMC blocks from: `bash`, `zsh`, or `both` |
| `username` | string | `automatic` | Container user to install for |
| `providerAgentsOnly` | boolean | `true` | Remove generated role agents that overlap CodeForge agents, keeping provider agents only |

> **Note:** Shell aliases (`omc-cc`, `omc-deepseek`, etc.) are provided by CodeForge's `setup-aliases.sh`, not this feature.

## Usage

oh-my-claude proxy sessions are started per Claude Code session:

```bash
omc cc -skip              # Launch Claude Code through OMC
omc cc -p ds -- --help    # Direct DeepSeek provider launch with Claude args
omc cc -p km -- --help    # Direct Kimi provider launch with Claude args
omc proxy status          # Show active OMC proxy sessions
omc proxy sessions        # List active proxy sessions
omc proxy switch          # Show sessions and model choices
omc proxy revert          # Revert a session to native Claude
omc doctor --detail       # Diagnose OMC setup
```

There is no CodeForge post-start OMC daemon. The upstream OMC CLI owns the lifecycle for each `omc cc` session.

## Provider Keys

Set provider keys in `.devcontainer/.secrets`:

```bash
DEEPSEEK_API_KEY=
KIMI_API_KEY=
ALIYUN_API_KEY=
ZHIPU_API_KEY=
ZAI_API_KEY=
MINIMAX_API_KEY=
MINIMAX_CN_API_KEY=
OPENROUTER_API_KEY=
```

OMC also supports OAuth for selected providers. Use `omc auth list` and `omc auth login <provider>` after the container starts.

## Configuration

Upstream OMC configuration lives at:

```text
~/.claude/oh-my-claude.json
```

CodeForge does not deploy a default OMC config file. The installer preserves `~/.claude/settings.json` byte-for-byte when it already exists and removes any OMC-generated `settings.json` when CodeForge has not deployed one yet.

## Boundaries

- OMC hooks are skipped.
- OMC MCP server setup is skipped.
- OMC statusline setup is skipped; CodeForge keeps `ccstatusline`.
- The normal `cc`, `claude`, `cc5`, `cc6`, `cc61`, `cc7`, `cc71`, `ccw*`, and `cc-orc*` launchers remain CodeForge-owned.
- Use one routing layer at a time unless intentionally testing interactions between `claude-code-router` and OMC.

## Known Limitations

### `omc doctor` Shows Expected Failures

Because CodeForge intentionally skips OMC hooks, MCP, and statusline, `omc doctor` will report:

```
✗ Hooks configured        ← expected (--skip-hooks)
✗ MCP server configured   ← expected (--skip-mcp)
⚠ StatusLine not configured ← expected (CodeForge uses ccstatusline)
```

These are **not errors** — they reflect CodeForge's intentional configuration choices.

### OMC Slash Commands Not Available

The upstream npm package (`@lgcyaxi/oh-my-claude`) does not ship the `src/assets/commands` directory, so OMC slash commands (`/omc-sisyphus`, `/omc-plan`, etc.) are not installed. Core functionality (agents, provider routing via `omc cc`) works normally.

### Role Agents Filtered

When `providerAgentsOnly: true` (default), the following role agents are removed to avoid conflicts with CodeForge's agent-system plugin:

- `sisyphus`, `prometheus`, `claude-reviewer`, `claude-scout`, `oracle`
- `ui-designer`, `analyst`, `librarian`, `document-writer`, `navigator`, `hephaestus`

Only provider agents remain: `kimi`, `mm-cn`, `deepseek`, `deepseek-r`, `qwen`, `zhipu`.

## Troubleshooting

### Agents Not Generated

If `~/.claude/agents/` is empty after container build:

```bash
omc install --skip-hooks --skip-mcp --force
```

The post-start hook will automatically filter role agents on next container start.

### Empty OMC Block in Shell RC

If you see empty markers in `.bashrc`/`.zshrc`:

```bash
# === oh-my-claude launch helpers START ===
# === oh-my-claude launch helpers END ===
```

These are harmless remnants from older installs. CodeForge's `setup-aliases.sh` provides all OMC aliases in the "CodeForge Claude aliases" block instead.
