---
title: Troubleshooting
description: Symptom-first troubleshooting for install, container, authentication, commands, plugins, ports, and performance issues.
sidebar:
  order: 7
---

Use this page by symptom. Start with the section that matches what the user sees, not the subsystem you think might be involved.

If your problem is not listed here, check [GitHub Issues](https://github.com/AnExiledDev/CodeForge/issues).

## The Installer Fails

Symptom: `npx @coredirective/cf-container` fails.

Check these first:

1. Verify Node.js and npm are installed.
2. Check network access to the npm registry.
3. Retry with:

```bash
npx --yes @coredirective/cf-container
```

If the problem is permissions-related, avoid global installs and use `npx`.

## The Container Does Not Open or Build Correctly

Symptom: VS Code does not offer to reopen in container, or the build fails.

Check these first:

1. Confirm the Dev Containers extension is installed.
2. Make sure `.devcontainer/` is at the project root you opened.
3. Confirm Docker is running.
4. Rebuild without cache if the first build was interrupted.

If feature installation is the failure point:

- confirm you have enough memory
- check internet access and GitHub rate limiting
- temporarily disable the failing feature with `"version": "none"`

## Authentication Fails

### Claude Code

Symptom: `claude` or `cc` fails with auth errors.

Try:

1. Launch `claude` once interactively.
2. Verify your token or API-key configuration.
3. Wait briefly and retry if background setup just completed.

### GitHub CLI

Symptom: `gh` is not authenticated.

Try:

```bash
gh auth status
gh auth login
```

Or place your token in `.codeforge/secrets/gh_token`.

### Codex CLI

Symptom: `codex` fails with auth errors.

Try:

1. Launch `codex` interactively once.
2. Verify `OPENAI_API_KEY` if using API-key auth.
3. Recreate `~/.codex/auth.json` if needed.

## Commands or Tools Are Missing

Symptom: `cc` or another tool is not found.

Check these first:

1. Open a new terminal.
2. Run `check-setup`.
3. Run `cc-tools`.
4. Confirm the tool is not optional or disabled by default.

If `cc` is missing specifically, reload your shell config with `source ~/.bashrc` or `source ~/.zshrc`.

## A Plugin or Automation Is Not Running

Symptom: a plugin appears inactive, or formatting/linting does not happen.

Check these first:

1. Confirm the plugin is enabled in `settings.json`.
2. Confirm the required underlying tools are installed.
3. Remember that many checks run on the **Stop** hook, not immediately on edit.
4. Check whether a hook was disabled in `disabled-hooks.json`.

## The Container or Startup Is Slow

Symptom: slow startup, high memory usage, or long rebuilds.

Try:

1. Increase Docker memory if your machine can support it.
2. Disable unused optional features.
3. Use normal rebuilds instead of no-cache rebuilds for routine changes.
4. Check available disk space.

First start is slower than later starts because setup scripts and tool installs run only once per fresh environment.

## Ports or Services Are Not Reachable

Symptom: a service is running in the container but not reachable from the host.

Check these first:

1. If you are using VS Code, confirm port forwarding is active.
2. If you are using the DevContainer CLI or another non-VS Code client, use `dbr` or SSH tunneling.
3. Check for port conflicts.

Use [Accessing Services](/use/accessing-services/) for the practical guide.

## Docker or WSL Is Misbehaving

### Linux Docker permission errors

Symptom: `docker` permission errors.

Make sure your user can access the Docker daemon without `sudo`.

### Windows WSL issues

Symptom: Docker hangs or the container does not start in WSL-based setups.

Check:

1. Docker Desktop WSL integration is enabled.
2. Your distro is using WSL 2, not WSL 1.
3. Docker Desktop was restarted after settings changes.

## Agent-Browser Cannot Connect to Host Chrome

Symptom: `agent-browser connect` fails with connection refused, timeout, or empty response.

Check these in order:

1. **Are you using the resolved IPv4 address?** Inside a container, `localhost` refers to the container itself. Chrome CDP also rejects `Host: host.docker.internal`, so resolve `host.docker.internal` to IPv4 and use that IP with port 9223 after running `.devcontainer\scripts\start-hermes-chrome.ps1` on the host.

2. **Is Chrome remote debugging actually enabled?**
   - Windows: run `.\.devcontainer\scripts\start-hermes-chrome.ps1` from an Administrator PowerShell. It launches Chrome on `127.0.0.1:9222` and creates `0.0.0.0:9223 -> 127.0.0.1:9222`.
   - Chrome 136+: Chrome must be launched with both `--remote-debugging-port=9222` **and** `--user-data-dir`. Chrome 136+ silently ignores the port flag without a user data directory.
   - Verify from the Windows host: `Invoke-WebRequest http://127.0.0.1:9222/json/version` and `Invoke-WebRequest http://127.0.0.1:9223/json/version` should return JSON.

3. **Is the port reachable from the container?**
   ```bash
   CDP_HOST=$(getent ahostsv4 host.docker.internal | awk 'NR==1 {print $1}')
   curl http://$CDP_HOST:9223/json/version
   ```
   If this fails, the portproxy/firewall path is not reachable. Windows users should enable [mirrored networking](/start-here/windows-networking/) and check `netsh interface portproxy show v4tov4`.

4. **Is another Chrome instance blocking the port?** Only one Chrome process can listen on a given debug port. Close other Chrome instances or use a different port.

5. **Firewall blocking?** Windows Firewall may block incoming connections on port 9223. The host helper creates an inbound rule named `Hermes Chrome CDP 9223`; confirm it is enabled.

6. **Seeing HTTP 500 from Chrome?** If the response says `Host header is specified and is not an IP address or localhost`, you used `host.docker.internal` directly. Use the resolved IPv4 address instead.

## Mirrored Networking Not Working

Symptom: After enabling mirrored networking in `.wslconfig`, ports are still not accessible between host and container.

Check these in order:

1. **Did you restart WSL?** Changes to `.wslconfig` require `wsl --shutdown` from PowerShell, then restarting your WSL distribution or Docker Desktop.

2. **Is mirrored mode actually active?** Run `wsl --status` from PowerShell and look for "Networking mode: Mirrored".

3. **VPN conflict?** Cisco AnyConnect and some VPN clients break mirrored networking. Disconnect the VPN and test again. See the [Windows Networking guide](/start-here/windows-networking/#vpn-conflicts) for workarounds.

4. **Windows update regression?** Microsoft occasionally ships updates that break mirrored mode. Check [WSL GitHub Issues](https://github.com/microsoft/WSL/issues) for known regressions. Revert to NAT mode as a temporary workaround.

5. **Docker Desktop version?** Mirrored networking requires Docker Desktop 4.26.0 or later. Update Docker Desktop if you're on an older version.

## Reset Options

Use the smallest reset that solves the problem:

1. delete and redeploy runtime config in `~/.claude/`
2. remove or fix the matching override under `.codeforge/`, then regenerate/deploy settings
3. reset aliases in your shell config
4. rebuild the container
5. disable and re-enable a single feature

## Related

- [Before You Install](/start-here/before-you-install/)
- [Install in VS Code](/start-here/install-in-vscode/)
- [Secrets and Auth](/customize/secrets-and-auth/)
- [Environment Variables](./environment-variables/)
- [Commands Reference](./commands/)
