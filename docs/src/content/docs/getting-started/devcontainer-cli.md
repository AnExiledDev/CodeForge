---
title: DevContainer CLI
description: Run CodeForge from the command line without VS Code — build, connect, and manage containers using the devcontainer CLI.
sidebar:
  order: 4
---

The DevContainer CLI lets you build and run CodeForge containers without VS Code. Use it when you prefer terminal-only workflows, work on headless servers, or need DevContainer support in CI/CD pipelines.

## Install the CLI

```bash
npm install -g @devcontainers/cli
```

Requires Node.js 18+. Verify the installation with `devcontainer --version`.

## Build and Start

From your project root (where `.devcontainer/` lives):

```bash
devcontainer up --workspace-folder .
```

The first build takes several minutes — it pulls the base image, installs all features, and runs post-start setup. Subsequent starts reuse cached layers and complete in seconds.

:::caution[Don't interrupt the first build]
If the build is interrupted, Docker may cache a partial state. Rebuild from scratch:
```bash
devcontainer up --workspace-folder . --remove-existing-container
```
:::

## Connect to the Container

The recommended way to get a shell inside the container:

```bash
devcontainer exec --workspace-folder . zsh
```

This uses the devcontainer CLI's exec command, which respects the container's configured user and environment. You can also use `docker exec` directly — run `docker ps` to find the container name:

```bash
docker exec -it <container-name> zsh
```

## Run Commands

Execute commands without entering an interactive shell:

```bash
# Run check-setup to verify the installation
devcontainer exec --workspace-folder . check-setup

# Launch a Claude Code session
devcontainer exec --workspace-folder . cc

# List installed tools
devcontainer exec --workspace-folder . cc-tools
```

## Port Forwarding

VS Code auto-forwards container ports to your host automatically. **The CLI does not.** You need an explicit forwarding mechanism.

:::caution[No automatic port forwarding]
Unlike VS Code, the devcontainer CLI does not auto-forward ports. Services running inside the container (like the Claude Dashboard on port 7847) won't be accessible on your host unless you set up forwarding manually.
:::

**Recommended:** Install [devcontainer-bridge](https://github.com/bradleybeddoes/devcontainer-bridge) (`dbr`) for dynamic, automatic port forwarding that works with any terminal client. CodeForge pre-installs the container side — you only need the host daemon:

```bash
# On your host machine
dbr host-daemon
```

**Alternative:** Use SSH tunneling for specific ports:

```bash
ssh -L 7847:localhost:7847 <container-user>@<container-host>
```

See [Port Forwarding](/reference/port-forwarding/) for the full setup guide and comparison of all forwarding mechanisms.

## Key Differences from VS Code

| Capability | VS Code | DevContainer CLI |
|------------|---------|------------------|
| Port forwarding | Automatic | Manual — use `dbr` or SSH tunneling |
| Extensions panel | GUI in sidebar | Not available |
| Ports panel | Visual port management | Not available — use `docker port` or `dbr` |
| Terminal management | Integrated tabs | Manual — use tmux for parallel sessions |
| File editing | Built-in editor | Use your preferred editor (vim, nano, etc.) |

## Rebuilding

When you change `devcontainer.json` or feature configurations, rebuild:

```bash
# Rebuild using cached layers (fast)
devcontainer up --workspace-folder .

# Full rebuild from scratch (slow, but fixes cache issues)
devcontainer up --workspace-folder . --remove-existing-container
```

## Stopping the Container

The devcontainer CLI doesn't have a dedicated stop command. Use Docker directly:

```bash
# Find the container name
docker ps

# Stop the container
docker stop <container-name>

# Or stop and remove it
docker rm -f <container-name>
```

## Tips

- **Use tmux** for parallel sessions inside the container. CodeForge installs tmux by default — run `tmux` after connecting to get split panes and persistent sessions.
- **Connect external terminals** using the scripts in `.codeforge/scripts/` — `connect-external-terminal.sh` (macOS/Linux) or `connect-external-terminal.ps1` (Windows PowerShell).
- **Combine with `dbr`** for the closest experience to VS Code — automatic port forwarding without needing VS Code running.

## Next Steps

- [Your First Session](/getting-started/first-session/) — start using CodeForge with Claude Code
- [Port Forwarding](/reference/port-forwarding/) — detailed forwarding setup guide
- [Installation](/getting-started/installation/) — full installation walkthrough
