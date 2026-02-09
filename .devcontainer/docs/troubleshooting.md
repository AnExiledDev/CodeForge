# Troubleshooting

Common issues and solutions for the CodeForge devcontainer.

## Container Build Failures

**Problem**: Container fails to build during feature installation.

- Check Docker has sufficient memory (4GB+ recommended). CodeForge sets `--memory=4g` by default.
- If a specific feature fails, disable it temporarily by setting `"version": "none"` in `devcontainer.json`.
- Check internet connectivity — most features download binaries from GitHub releases.
- If hitting GitHub API rate limits during build, set `GH_TOKEN` or `GITHUB_TOKEN` as an environment variable.

**Problem**: Build is slow or hangs.

- The mcp-qdrant feature downloads an embedding model (~90MB). This is normal on first build.
- The mcp-reasoner feature clones and builds a Node.js project. This takes 1-2 minutes.
- Use `"version": "none"` to skip optional features you don't need.

## Authentication Issues

**Problem**: `claude` command fails with authentication error.

- Run `claude` once interactively to complete authentication.
- If using API key auth, verify `ANTHROPIC_API_KEY` is set correctly.
- Background update may be in progress — wait 10 seconds and retry.

**Problem**: `gh` CLI not authenticated.

- Run `gh auth status` to check current state.
- Run `gh auth login` for interactive setup.
- Or configure `.devcontainer/.secrets` with `GH_TOKEN` for automatic auth on container start.
- Credentials persist in `/workspaces/.gh/` across rebuilds.

**Problem**: Git push fails with permission error.

- Run `gh auth status` to verify authentication.
- Check git remote URL: `git remote -v`. HTTPS remotes require `gh` auth; SSH remotes require SSH keys.
- Verify `git config --global user.name` and `user.email` are set.

**Problem**: NPM publish/install fails with 401.

- Set `NPM_TOKEN` in `.devcontainer/.secrets` or as environment variable.
- Verify token: `npm whoami`.

## Feature Installation Failures

**Problem**: Feature checksum verification fails.

- This usually means a corrupted download. Rebuild the container to retry.
- If persistent, the release may have been re-tagged. Try pinning a specific version in `devcontainer.json`.

**Problem**: Feature download fails after retries.

- Check internet connectivity.
- GitHub may be experiencing issues — check [githubstatus.com](https://www.githubstatus.com/).
- Set `GH_TOKEN` environment variable to avoid rate limiting.

**Problem**: Permission denied during feature install.

- Features run as root during build. This shouldn't happen in normal use.
- If modifying features, ensure `install.sh` has `chmod +x` and starts with `#!/bin/bash`.

## Plugin Issues

**Problem**: Plugin not loading or not appearing in Claude Code.

- Check `enabledPlugins` in `config/defaults/settings.json` — the plugin must be listed there.
- Verify the plugin directory exists under `plugins/devs-marketplace/plugins/`.
- Run `check-setup` to verify core configuration is correct.
- Check plugin blacklist: ensure it's not in `PLUGIN_BLACKLIST` in `.env`.

**Problem**: Auto-formatter or auto-linter not running.

- These run on the Stop hook — they only trigger when Claude Code stops (end of conversation turn).
- Verify the underlying tools are installed: `cc-tools` lists all available tools.
- Check the 30-second timeout hasn't been exceeded (large file sets may hit this).

## Agent Teams / tmux Issues

**Problem**: Split panes not working.

- Agent Teams requires tmux. Use the **"Claude Teams (tmux)"** terminal profile in VS Code.
- Verify tmux is installed: `tmux -V`.
- If using an external terminal, connect via `connect-external-terminal.sh`.

**Problem**: tmux Unicode/emoji rendering broken.

- Ensure locale is set: `echo $LANG` should show `en_US.UTF-8`.
- If not, run `source ~/.bashrc` or open a new terminal.

## "Command Not Found" Errors

**Problem**: `cc: command not found` or similar.

- Run `source ~/.bashrc` (or `~/.zshrc`) to reload aliases.
- Or open a new terminal.
- Verify setup ran: check for `# Claude Code environment and aliases` in your rc file.

**Problem**: Tool not found (e.g., `ruff`, `dprint`).

- Run `cc-tools` to see which tools are installed.
- Check if the feature was disabled with `"version": "none"` in `devcontainer.json`.
- Some tools (like `ruff`) install to `~/.local/bin` — ensure it's in your PATH.

## Performance Issues

**Problem**: Container is slow or running out of memory.

- CodeForge defaults to 4GB RAM / 8GB swap. Increase in `devcontainer.json` `runArgs`.
- Disable features you don't need with `"version": "none"`.
- The background Claude Code update runs once on startup — it's not persistent.

**Problem**: Slow startup.

- First start is slower due to `postStartCommand` running all setup scripts.
- Subsequent starts skip unchanged config files (sha256 comparison).
- Disable steps you don't need via `.env` (e.g., `SETUP_PROJECTS=false`).

## How to Reset to Defaults

1. **Reset config files**: Delete `/workspaces/.claude/` and restart the container. `setup-config.sh` will recopy all files from `config/defaults/`.

2. **Reset aliases**: Delete the `# Claude Code environment and aliases` block from `~/.bashrc` and `~/.zshrc`, then run `bash /workspaces/.devcontainer/scripts/setup-aliases.sh`.

3. **Full reset**: Rebuild the container from scratch (VS Code: "Dev Containers: Rebuild Container").

4. **Reset a single feature**: Set it to `"version": "none"`, rebuild, then set it back to the desired version and rebuild again.
