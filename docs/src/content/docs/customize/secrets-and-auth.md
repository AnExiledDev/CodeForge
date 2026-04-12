---
title: Secrets and Auth
description: Configure secrets, tokens, and authentication for GitHub, NPM, Claude Code, and Codex inside CodeForge.
sidebar:
  order: 3
---

CodeForge supports automatic authentication through `.devcontainer/.secrets` and DevContainer-hosted secrets such as Codespaces secrets.

## `.secrets` File

Create `.devcontainer/.secrets` with `KEY=VALUE` entries:

```bash
GH_TOKEN=ghp_your_token_here
GH_USERNAME=your-github-username
GH_EMAIL=your-email@example.com
NPM_TOKEN=npm_your_token_here
CLAUDE_AUTH_TOKEN=sk-ant-oat01-your-token-here
OPENAI_API_KEY=sk-your-openai-key
```

## Common Variables

| Variable | Purpose |
|----------|---------|
| `GH_TOKEN` | GitHub CLI and HTTPS git auth |
| `GH_USERNAME` | Git user name |
| `GH_EMAIL` | Git user email |
| `NPM_TOKEN` | npm auth |
| `CLAUDE_AUTH_TOKEN` | Claude Code long-lived auth token |
| `OPENAI_API_KEY` | Codex CLI API-key auth |

## Behavior

- CodeForge can inject Claude and Codex credentials on container start.
- Codespaces or other host secrets take precedence over `.secrets`.
- Existing credentials are usually left in place when the setup is idempotent.

## Security Note

Never commit `.devcontainer/.secrets`.

## Troubleshooting Auth

If something is not authenticated, these commands are the fastest first checks:

```bash
gh auth status
claude
codex
npm whoami
```

## Related

- [Settings and Permissions](./settings-and-permissions/)
- [Troubleshooting](/reference/troubleshooting/)
- [Environment Variables](/reference/environment-variables/)
