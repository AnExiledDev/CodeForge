---
title: Troubleshooting
description: Common issues and solutions for the CodeForge devcontainer.
sidebar:
  order: 7
---

Solutions for common issues with the CodeForge devcontainer. If your problem isn't listed here, check [GitHub Issues](https://github.com/AnExiledDev/CodeForge/issues) or open a new one.

## Container Build Failures

**Problem: Container fails to build during feature installation.**

- Check Docker has sufficient memory (6 GB+ recommended). CodeForge sets `--memory=6g` by default.
- If a specific feature fails, disable it temporarily by setting `"version": "none"` in `devcontainer.json`.
- Check internet connectivity — most features download binaries from GitHub releases.
- If hitting GitHub API rate limits during build, set `GH_TOKEN` or `GITHUB_TOKEN` as an environment variable.

**Problem: Build is slow or hangs.**

- The mcp-qdrant feature downloads an embedding model (~90 MB). This is normal on first build.
- Use `"version": "none"` to skip optional features you don't need.

:::tip[Disabling Features]
Any local feature can be disabled without removing it from `devcontainer.json` by setting `"version": "none"`. The feature entry stays in the config for easy re-enabling — just remove the version override or set it to `"latest"`.
:::

## Authentication Issues

**Problem: `claude` command fails with authentication error.**

- Run `claude` once interactively to complete authentication.
- If using API key auth, verify `ANTHROPIC_API_KEY` is set correctly.
- Background update may be in progress — wait 10 seconds and retry.

**Problem: `gh` CLI not authenticated.**

- Run `gh auth status` to check current state.
- Run `gh auth login` for interactive setup.
- Or configure `.devcontainer/.secrets` with `GH_TOKEN` for automatic auth on container start. See [Configuration — Secrets](../customization/configuration/#secrets-file).
- Credentials persist in `/workspaces/.gh/` across rebuilds.

**Problem: Claude auth token not taking effect in Codespaces.**

- When `CLAUDE_AUTH_TOKEN` is set via Codespaces secrets, it persists as an environment variable for the entire container lifetime. The `unset` in `setup-auth.sh` only clears it in the child process. This is a Codespaces platform limitation.
- If `.credentials.json` already exists, the token injection is skipped (idempotent). Delete `~/.claude/.credentials.json` to force re-creation from the token.

**Problem: Git push fails with permission error.**

- Run `gh auth status` to verify authentication.
- Check git remote URL: `git remote -v`. HTTPS remotes require `gh` auth; SSH remotes require SSH keys.
- Verify `git config --global user.name` and `user.email` are set.

**Problem: NPM publish/install fails with 401.**

- Set `NPM_TOKEN` in `.devcontainer/.secrets` or as environment variable.
- Verify token: `npm whoami`.

## Feature Installation Failures

**Problem: Feature checksum verification fails.**

- This usually means a corrupted download. Rebuild the container to retry.
- If persistent, the release may have been re-tagged. Try pinning a specific version in `devcontainer.json`.

**Problem: Feature download fails after retries.**

- Check internet connectivity.
- GitHub may be experiencing issues — check [githubstatus.com](https://www.githubstatus.com/).
- Set `GH_TOKEN` environment variable to avoid rate limiting.

**Problem: Permission denied during feature install.**

- Features run as root during build. This shouldn't happen in normal use.
- If modifying features, ensure `install.sh` has execute permissions and starts with `#!/bin/bash`.

## Plugin Issues

**Problem: Plugin not loading or not appearing in Claude Code.**

- Check `enabledPlugins` in `.codeforge/config/settings.json` — the plugin must be listed there.
- Verify the plugin directory exists under `plugins/devs-marketplace/plugins/`.
- Run `check-setup` to verify core configuration is correct.
- Check plugin blacklist: ensure it's not in `PLUGIN_BLACKLIST` in `.env`.

**Problem: Auto-formatter or auto-linter not running.**

- These run on the Stop hook — they only trigger when Claude Code stops (end of conversation turn).
- Verify the underlying tools are installed: `cc-tools` lists all available tools.
- Check the 30-second timeout hasn't been exceeded (large file sets may hit this).

## Agent Teams and tmux Issues

**Problem: Split panes not working.**

- Agent Teams requires tmux. Use the **"Claude Teams (tmux)"** terminal profile in VS Code.
- Verify tmux is installed: `tmux -V`.
- If using an external terminal, connect via `.codeforge/scripts/connect-external-terminal.sh`.

**Problem: tmux Unicode/emoji rendering broken.**

- Ensure locale is set: `echo $LANG` should show `en_US.UTF-8`.
- If not, run `source ~/.bashrc` or open a new terminal.

## "Command Not Found" Errors

**Problem: `cc: command not found` or similar.**

- Run `source ~/.bashrc` (or `~/.zshrc`) to reload aliases.
- Or open a new terminal.
- Verify setup ran: check for `# Claude Code environment and aliases` in your rc file.

**Problem: Tool not found (e.g., `ruff`, `dprint`).**

- Run `cc-tools` to see which tools are installed.
- Check if the feature was disabled with `"version": "none"` in `devcontainer.json`.
- Some tools (like `ruff`) install to `~/.local/bin` — ensure it's in your `PATH`.

## Performance Issues

**Problem: Container is slow or running out of memory.**

- CodeForge defaults to 6 GB RAM / 12 GB swap. Increase in `devcontainer.json` `runArgs`.
- Disable features you don't need with `"version": "none"`.
- The background Claude Code update runs once on startup — it's not persistent.

**Problem: Slow startup.**

- First start is slower due to `postStartCommand` running all setup scripts.
- Subsequent starts skip unchanged config files (SHA-256 comparison).
- Disable steps you don't need via `.env` (e.g., `SETUP_PROJECTS=false`). See [Environment Variables — Setup Variables](./environment/#setup-variables-env).

## How to Reset

1. **Reset runtime config** — delete `~/.claude/` and restart the container. `setup-config.sh` will redeploy all files from `.codeforge/config/`. This resets the deployed copies but preserves your `.codeforge/` source files (user modifications remain intact).

2. **Restore default config sources** — run `git checkout .codeforge/config/` to discard any local edits to the source files, then restart the container to redeploy.

3. **Reset aliases** — delete the `# Claude Code environment and aliases` block from `~/.bashrc` and `~/.zshrc`, then run `bash /workspaces/.devcontainer/scripts/setup-aliases.sh`.

4. **Full reset** — rebuild the container from scratch (VS Code: **Dev Containers: Rebuild Container**). This recreates everything but still preserves `.codeforge/` user modifications since they live in the repository.

5. **Reset a single feature** — set it to `"version": "none"`, rebuild, then set it back to the desired version and rebuild again.

## Related

- [Configuration](../customization/configuration/) — settings and file manifest reference
- [Environment Variables](./environment/) — all environment variables
- [Commands](./commands/) — CLI commands and slash commands
- [Architecture](./architecture/) — system design and component relationships
