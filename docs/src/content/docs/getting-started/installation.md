---
title: Installation
description: Step-by-step guide to installing and configuring CodeForge in your project.
sidebar:
  order: 3
---

This guide walks you through setting up CodeForge from scratch. The process has three steps: run the installer, open the container, and verify. Most of the heavy lifting happens automatically.

## Step 1: Install CodeForge

Navigate to your project root and run:

```bash
npx codeforge-dev
```

This creates a `.devcontainer/` directory containing the full CodeForge configuration — all plugins, features, agents, skills, system prompts, and settings. Your existing project files are not modified.

:::tip[Already have a .devcontainer?]
If your project already has a `.devcontainer/` directory, the installer will warn you and exit. Use the `--force` flag to perform a smart sync that preserves your user configuration:
```bash
npx codeforge-dev --force
```
The `--force` flag uses an intelligent sync — it preserves files you've customized (writing `.default` copies of new defaults in `.codeforge/` for review) rather than blindly overwriting everything.
:::

### Alternative Installation Methods

```bash
# Install globally for repeated use
npm install -g codeforge-dev
codeforge-dev

# Pin a specific version
npx codeforge-dev@1.14.0
```

### What the Installer Creates

After running the installer, your project will have:

```
your-project/
├── .devcontainer/
│   ├── devcontainer.json       # Container definition and feature list
│   ├── .env                    # Setup flags
│   ├── features/               # 22 custom DevContainer features
│   ├── plugins/                # 14 plugins with hooks and scripts
│   └── scripts/                # Setup and verification scripts
├── .codeforge/
│   ├── file-manifest.json      # Controls config file deployment
│   ├── config/                 # System prompts, settings, rules
│   └── scripts/                # Terminal connection scripts
└── ... (your existing files)
```

## Step 2: Open in a DevContainer Client

import { Tabs, TabItem } from '@astrojs/starlight/components';

CodeForge uses the open [Dev Containers specification](https://containers.dev/). Pick whichever client fits your workflow:

<Tabs>
<TabItem label="VS Code">

Open your project in VS Code. You should see a notification in the bottom-right corner:

> **Folder contains a Dev Container configuration file.** Reopen folder to develop in a container.

Click **Reopen in Container**. If you miss the notification, use the Command Palette:

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
2. Type "Dev Containers" and select **Dev Containers: Reopen in Container**

You can watch the build progress in the "Dev Containers" output channel in the terminal panel.

</TabItem>
<TabItem label="DevContainer CLI">

Install the CLI if you haven't already:

```bash
npm install -g @devcontainers/cli
```

Build and start the container:

```bash
devcontainer up --workspace-folder .
```

Then connect to the running container:

```bash
docker exec -it <container-name> zsh
```

Use `docker ps` to find the container name. For port forwarding outside VS Code, see the [Port Forwarding reference](../reference/port-forwarding/).

</TabItem>
<TabItem label="JetBrains">

1. Open **JetBrains Gateway** (or IntelliJ IDEA / PyCharm with the [Dev Containers plugin](https://plugins.jetbrains.com/plugin/21962-dev-containers))
2. Select **Dev Containers** as the connection type
3. Point to your project directory containing `.devcontainer/`
4. Gateway builds the container and connects the IDE backend automatically

</TabItem>
<TabItem label="Codespaces">

1. Push your project (with the `.devcontainer/` directory) to GitHub
2. Go to your repository on GitHub and click **Code → Codespaces → Create codespace**
3. Codespaces reads your `devcontainer.json` and builds the environment in the cloud

No local Docker installation required. Port forwarding is handled automatically by Codespaces.

</TabItem>
</Tabs>

### What Happens During the First Build

The first container build takes several minutes (typically 3-8 minutes depending on your internet speed and hardware). Here's what's happening behind the scenes:

1. **Base image pull** — downloads the Python 3.14 DevContainer image from Microsoft's registry
2. **Feature installation** — installs DevContainer features in dependency order: Node.js and uv first (other tools depend on them), then Bun, Claude Code, and all custom features
3. **Post-start setup** — deploys configuration files, sets up shell aliases, and configures plugins

:::caution[Don't interrupt the first build]
If the build is interrupted, Docker may cache a partial state. Rebuild without cache to start fresh:
- **VS Code**: Dev Containers: Rebuild Container Without Cache
- **CLI**: `devcontainer up --workspace-folder . --remove-existing-container`
:::

## Step 3: Verify Installation

Once the container is running and you have a terminal prompt, verify everything installed correctly:

```bash
check-setup
```

This command checks that all tools, runtimes, and plugins are in place. You should see green checkmarks for each component.

For a more detailed view of every installed tool and its version:

```bash
cc-tools
```

This lists every command CodeForge provides, along with its version number or installation status.

### Expected Output

A healthy installation shows all of these as available:

| Category | Tools |
|----------|-------|
| Claude Code | `claude`, `cc`, `ccw`, `ccraw` |
| Session tools | `ccusage`, `ccburn`, `claude-monitor` (`ccms` currently disabled) |
| Languages | `node`, `python`, `bun` (`rustc` opt-in) |
| Code intelligence | `ast-grep`, `tree-sitter`, `pyright`, `typescript-language-server` |
| Linters/Formatters | `ruff`, `biome` |
| Utilities | `gh`, `docker`, `git`, `jq`, `tmux` |

:::note[Some tools are optional]
A few features ship with `"version": "none"` by default (shfmt, dprint, shellcheck, hadolint). These are available but disabled. Enable them by changing the version in `devcontainer.json` and rebuilding the container.
:::

## What Gets Installed

### Language Runtimes

- **Python 3.14** — the container's base image, with `uv` as the package manager
- **Node.js LTS** — installed via nvm, with npm included
- **Rust** — latest stable via rustup _(opt-in — uncomment in `devcontainer.json`)_
- **Bun** — fast JavaScript/TypeScript runtime and package manager
- **Go** — available as an opt-in (uncomment in `devcontainer.json`)

### CLI Tools

- **GitHub CLI** (`gh`) — repository management, PR creation, issue tracking
- **Docker** (Docker-outside-of-Docker) — container operations from inside the DevContainer
- **tmux** — terminal multiplexing for parallel Claude Code sessions
- **ccms** — search your Claude Code session history _(currently disabled — replacement pending)_
- **ccusage** / **ccburn** — token usage analysis and burn rate tracking
- **ccstatusline** — session status in your terminal prompt
- **claude-monitor** — real-time session monitoring
- **claude-dashboard** — web-based session analytics on port 7847
- **agent-browser** — headless Chromium via Playwright for web interaction
- **ast-grep** / **tree-sitter** — structural code search and parsing

### Plugins

All 14 plugins are installed and active by default. They're configured through `settings.json` and managed by the plugin system. See the [Plugins Overview](../plugins/) for details on each plugin and how to enable or disable them.

## Configuration

CodeForge works out of the box, but everything is customizable:

- **`devcontainer.json`** — container image, features, resource limits, port forwarding
- **`.codeforge/config/settings.json`** — model selection, permissions, enabled plugins, environment variables
- **`.codeforge/config/main-system-prompt.md`** — Claude Code's behavioral guidelines
- **`.codeforge/config/rules/`** — rules loaded into every session automatically

See the [Customization section](../customization/) for full details on each configuration surface.

## Updating CodeForge

To update to the latest version:

```bash
npx codeforge-dev@latest
```

This updates the `.devcontainer/` configuration. After updating, rebuild the container:

- **VS Code**: Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) and select **Dev Containers: Rebuild Container**
- **CLI**: `devcontainer up --workspace-folder . --remove-existing-container`

:::tip[Check what changed]
Use `git diff .devcontainer/` after updating to review what changed before committing. This lets you verify the update didn't overwrite any customizations you want to keep.
:::

## Troubleshooting

### Container fails to build

**Symptoms:** VS Code shows a build error, or the container exits immediately.

**Common causes and fixes:**

- **Docker not running** — start Docker Desktop or the Docker daemon
- **Insufficient resources** — open Docker Desktop settings and allocate at least 4 GB RAM and 20 GB disk to the VM
- **Network issues** — the first build downloads several GB of images and tools; check your internet connection
- **Cached partial build** — use **Dev Containers: Rebuild Container Without Cache** to start clean

### Tools not found after build

**Symptoms:** Commands like `cc` return "command not found." (Note: `ccms` is currently disabled by default.)

- Run `check-setup` to identify which tools are missing
- Check that the post-start script completed successfully (look for errors in the terminal output)
- Rebuild the container to trigger a fresh install

### Claude Code authentication issues

**Symptoms:** Running `cc` or `claude` prompts for authentication or returns an error.

- Claude Code authenticates on first launch — follow the prompts to sign in
- If authentication was previously completed but stopped working, try `claude auth` to re-authenticate
- Ensure your Claude subscription is active

### Slow container startup

**Symptoms:** The container takes a long time to start after the initial build.

- Subsequent starts should be fast (under 30 seconds) because Docker caches built layers
- If starts are consistently slow, check Docker resource allocation
- The `postStartCommand` runs on every start to deploy configuration files — this is normal and should complete in a few seconds

### `npx codeforge-dev` fails

**Symptoms:** The installer command errors out before creating `.devcontainer/`.

- **Node.js not installed** — the installer requires Node.js 18+ and npm. Run `node --version` to check; install from [nodejs.org](https://nodejs.org/) if missing
- **Network issues** — npm needs to reach the registry to download the package. Check your connection or try `npm config set registry https://registry.npmjs.org/`
- **Permission errors** — on some systems, global npm installs need `sudo`. Try `npx --yes codeforge-dev` or install globally with `sudo npm install -g codeforge-dev`

### VS Code doesn't show "Reopen in Container"

**Symptoms:** You opened the project in VS Code but never see the DevContainer prompt.

- **Extension not installed** — install `ms-vscode-remote.remote-containers` from the Extensions marketplace, then reload VS Code
- **`.devcontainer/` not at repo root** — VS Code looks for `.devcontainer/` in the workspace root folder. If your project is inside a subfolder, open that subfolder directly

:::note[Using a different client?]
Not using VS Code? The DevContainer CLI, JetBrains Gateway, DevPod, and Codespaces all read the same `devcontainer.json`. See [Step 2](#step-2-open-in-a-devcontainer-client) for client-specific instructions.
:::
- **VS Code version** — DevContainers requires VS Code 1.85 or later. Check **Help → About** and update if needed

### Docker permission errors (Linux)

**Symptoms:** `docker: permission denied` or `Cannot connect to the Docker daemon` errors.

- Add your user to the `docker` group: `sudo usermod -aG docker $USER`, then log out and back in
- Verify with `docker ps` — it should run without `sudo`
- If using Docker rootless mode, ensure the socket path is set correctly in VS Code settings

### WSL 2 integration issues (Windows)

**Symptoms:** Container fails to start, or Docker commands hang inside WSL.

- Open Docker Desktop → **Settings → Resources → WSL Integration** and enable integration for your WSL distro
- Ensure WSL 2 (not WSL 1) is active: run `wsl -l -v` in PowerShell and check the VERSION column
- Restart Docker Desktop after changing WSL settings

### Port conflicts

**Symptoms:** The claude-dashboard or other tools fail to bind their port.

- CodeForge's session dashboard uses **port 7847** by default. If another service uses that port, change it in `devcontainer.json` under `forwardPorts`
- To find what's using a port: `lsof -i :7847` (macOS/Linux) or `netstat -ano | findstr 7847` (Windows)

### Container rebuilds are slow

**Symptoms:** Rebuilding the container takes as long as the first build.

- **Use "Rebuild Container"** (not "Rebuild Without Cache") for routine rebuilds — Docker reuses cached layers for unchanged steps
- **Prune unused images** to free disk space: `docker system prune -a` removes all unused images (confirm you don't need them first)
- **Check disk space** — Docker needs headroom for layer storage. If your disk is nearly full, builds may fail or slow down significantly

## Next Steps

- [First Session](./first-session/) — start using CodeForge with Claude Code
- [Configuration](../customization/configuration/) — customize settings
- [Plugins Overview](../plugins/) — understand what each plugin does
