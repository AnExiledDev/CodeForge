# Codex CLI (OpenAI) - DevContainer Feature

Installs the [OpenAI Codex CLI](https://github.com/openai/codex), a terminal-based coding agent that runs commands, edits files, and answers questions using OpenAI models.

## Installation

Add this feature to your `.devcontainer/devcontainer.json`:

```json
{
  "features": {
    "ghcr.io/devcontainers/features/node:1": {},
    "./features/codex-cli": {}
  }
}
```

### With Custom Options

```json
{
  "features": {
    "./features/codex-cli": {
      "version": "1.0.9",
      "username": "vscode"
    }
  }
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `version` | string | `latest` | Version to install: `latest` or a specific semver (e.g., `1.0.9`). Use `none` to skip. |
| `username` | string | `automatic` | Container user to install for. Auto-detects vscode/node/codespace/root. |

## Authentication

Codex CLI requires an OpenAI API key. Configure authentication using one of these methods:

### Browser OAuth (Interactive)

```bash
codex --login
```

Opens a browser-based OAuth flow. Credentials are stored in `~/.codex/`.

### API Key (Non-Interactive)

Set the `OPENAI_API_KEY` environment variable:

```json
{
  "containerEnv": {
    "OPENAI_API_KEY": "${localEnv:OPENAI_API_KEY}"
  }
}
```

Or add it to `.devcontainer/.secrets`:

```
OPENAI_API_KEY=sk-...
```

### Credential Storage

The `codex-config.toml` file (deployed to `~/.codex/config.toml`) controls credential storage. The default `"file"` backend stores credentials in `~/.codex/auth.json`, which is recommended for containers.

## Usage

```bash
# Interactive mode
codex

# Direct prompt
codex "explain this codebase"

# With sandbox mode
codex --sandbox read-only "review this file"
```

## Troubleshooting

### Command Not Found

1. Verify Node.js is installed: `node --version`
2. Check npm global bin is on PATH: `npm bin -g`
3. Try running directly: `npx @openai/codex`

### Permission Errors

If npm global install fails:
```bash
sudo npm install -g @openai/codex
```

### Authentication Errors

1. Verify your API key: `echo $OPENAI_API_KEY`
2. Check credential file: `ls -la ~/.codex/`
3. Re-authenticate: `codex --login`

## Dependencies

- **Node.js** (with npm): Install the `node` feature first. Declared via `installsAfter` in the feature metadata.

## Links

- **GitHub**: https://github.com/openai/codex
- **NPM**: https://www.npmjs.com/package/@openai/codex
