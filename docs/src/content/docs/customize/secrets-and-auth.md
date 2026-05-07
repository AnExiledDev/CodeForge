---
title: Secrets and Auth
description: Configure secrets, tokens, and authentication for GitHub, NPM, Claude Code, and other tools inside CodeForge.
sidebar:
  order: 3
---

CodeForge uses file-based secrets in `.codeforge/secrets/` and automatic identity derivation from GitHub CLI.

## Secrets Directory

Create individual files under `.codeforge/secrets/`, one secret per file with no trailing newline:

```text
.codeforge/
  secrets/
    gh_token
    npm_token
    claude_code_oauth_token
    openai_api_key
    anthropic_api_key
    deepseek_api_key
    gemini_api_key
    openrouter_api_key
```

Each file contains only the raw token value. For example:

```bash
# Create the secrets directory
mkdir -p .codeforge/secrets

# Add a GitHub token
echo -n "ghp_your_token_here" > .codeforge/secrets/gh_token

# Add a Claude Code OAuth token
echo -n "sk-ant-oat01-your-token-here" > .codeforge/secrets/claude_code_oauth_token
```

## Supported Secrets

| File | Purpose |
|------|---------|
| `gh_token` | GitHub CLI and HTTPS git auth |
| `npm_token` | npm registry auth |
| `claude_code_oauth_token` | Claude Code OAuth token (native `CLAUDE_CODE_OAUTH_TOKEN` env var) |
| `openai_api_key` | Codex CLI API-key auth |
| `anthropic_api_key` | Direct Anthropic API key |
| `deepseek_api_key` | DeepSeek API key |
| `gemini_api_key` | Google Gemini API key |
| `openrouter_api_key` | OpenRouter API key |

## Fallback Chain

CodeForge resolves each secret using a three-step fallback chain:

1. **Environment variable** (e.g., Codespaces secrets) — if the env var is already set, it wins
2. **Docker Compose secret** at `/run/secrets/` — file-based secrets mounted by Docker Compose from `.codeforge/secrets/`
3. **Skip** — if neither source provides the secret, it is silently skipped

This means you can use the same `.codeforge/secrets/` layout locally and in Codespaces. In Codespaces, set the secret as a repository or organization secret and the env var takes precedence automatically.

## Claude Code Authentication

Claude Code reads the `CLAUDE_CODE_OAUTH_TOKEN` environment variable natively. Place your OAuth token in `.codeforge/secrets/claude_code_oauth_token` and CodeForge sets the env var on container start.

:::caution[ANTHROPIC_API_KEY conflict]
`CLAUDE_CODE_OAUTH_TOKEN` does **not** work when `ANTHROPIC_API_KEY` is also set. If you have both, Claude Code uses the API key and ignores the OAuth token. Remove `ANTHROPIC_API_KEY` (or the `.codeforge/secrets/anthropic_api_key` file) if you want OAuth authentication.
:::

## GitHub Identity

GitHub identity (name and email for git commits) is automatically derived from `gh api user` after `gh auth login` succeeds. You do not need to configure `GH_USERNAME` or `GH_EMAIL` manually.

### Overriding Identity

If you need to override the auto-derived identity, add an `identity` block to `.codeforge/container.json`:

```json
{
  "identity": {
    "name": "Your Name",
    "email": "your-email@example.com"
  }
}
```

## Security Note

Never commit `.codeforge/secrets/`. The installer adds it to `.gitignore` automatically.

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
