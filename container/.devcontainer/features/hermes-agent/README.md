# Hermes Agent (Nous Research) - DevContainer Feature

Installs [Hermes Agent](https://hermes-agent.nousresearch.com/), Nous Research's open-source autonomous AI agent CLI. Hermes uses the `anthropic` and `openai` Python SDKs directly and supports any OpenAI- or Anthropic-compatible provider (including local models and MiniMax).

## Installation

Add this feature to your `.devcontainer/devcontainer.json`:

```json
{
  "features": {
    "ghcr.io/devcontainers/features/node:1": {},
    "ghcr.io/devcontainers-extra/features/uv:1": {},
    "./features/hermes-agent": {}
  }
}
```

### With Custom Options

```json
{
  "features": {
    "./features/hermes-agent": {
      "version": "latest",
      "username": "vscode"
    }
  }
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `version` | string | `latest` | Version to install. `latest` tracks upstream `main`. Use `none` to skip. Semver pinning supported once Hermes publishes release tags. |
| `username` | string | `automatic` | Container user to install for. Auto-detects vscode/node/codespace/root. |

## Authentication

**Hermes has its own credential store — Claude OAuth tokens (`sk-ant-oat-*`) and Codex ChatGPT OAuth cannot be reused.** The upstream installer's interactive `hermes setup` wizard is **intentionally skipped** during image build so no provider is hard-coded.

### First-Run Setup (Required)

After the container starts, run the setup wizard once:

```bash
hermes setup
```

This walks through provider selection (Anthropic, OpenAI, MiniMax, local, etc.), API key entry, and default model choice. It writes:

- `~/.hermes/config.yaml` — provider + model selection
- `~/.hermes/.env` — API keys

Both files land inside the `~/.hermes/` Docker named volume (`codeforge-hermes-config-${devcontainerId}`), so setup is a one-time cost per devcontainer instance.

### Using MiniMax

If you already have `MINIMAX_API_KEY` in `.devcontainer/.secrets`, it is exported into the container environment. When `hermes setup` prompts for the API key, paste the value from `echo $MINIMAX_API_KEY`.

### Why No Auto-Seeding?

Hermes' credential format is a plain `.env` plus `config.yaml` emitted by its interactive wizard. CodeForge does not pre-write these because:

1. Hermes provider choice is a decision per user, not per image.
2. The wizard validates the key against the chosen provider — seeded values can silently disagree.
3. Keeping setup interactive means credential paths stay in sync with upstream format changes.

## Usage

```bash
# Interactive session
hermes

# Direct prompt
hermes "summarize this repo"

# Inspect current configuration
hermes config show

# Change provider/model
hermes model
```

## Persistence

`~/.hermes/` is mounted from a named Docker volume, so `hermes setup` only runs once per devcontainer instance. Destroying the container keeps the volume; destroying the volume (`docker volume rm codeforge-hermes-config-<id>`) forces a fresh setup on next boot.

## Troubleshooting

### `hermes: command not found`

The binary symlinks to `~/.local/bin/hermes`. Verify:

```bash
ls -la ~/.local/bin/hermes
echo $PATH | tr ':' '\n' | grep .local/bin
```

If `~/.local/bin` is missing from PATH, source your shell rc or add:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

### `No model configured` / setup loop

Run `hermes setup` or `hermes model` — a fresh container has no provider selected.

### Installer failed during build

The upstream installer runs `curl | bash` against HEAD of `NousResearch/hermes-agent`. If the upstream script breaks, set the feature to `"version": "none"` temporarily and wait for an upstream fix, or pin once Hermes tags a release.

## Dependencies

- **Node.js** — installed via the `node` feature (installer detects existing NVM install)
- **uv** — installed via the `ghcr.io/devcontainers-extra/features/uv` feature (Hermes uses uv to manage its Python 3.11 venv)
- **ripgrep**, **ffmpeg** — pre-installed by this feature's `install.sh` before the upstream installer runs

Both declared via `installsAfter` in the feature metadata.

## Links

- **Website**: https://hermes-agent.nousresearch.com/
- **GitHub**: https://github.com/NousResearch/hermes-agent
- **Install script**: https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh
