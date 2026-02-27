---
title: System Requirements
description: Prerequisites and system requirements for running CodeForge DevContainers.
sidebar:
  order: 2
---

Before installing CodeForge, make sure your system meets the requirements below. The good news: if you already have Docker and VS Code, you're most of the way there. CodeForge handles the rest automatically inside the container.

## Required Software

### Docker

CodeForge runs inside a DevContainer, which requires a container runtime. You need one of the following:

| Platform | Runtime | Recommended Version |
|----------|---------|-------------------|
| macOS | Docker Desktop | 4.x or later |
| Windows | Docker Desktop with WSL 2 backend | 4.x or later |
| Linux | Docker Engine | 24.x or later |

Docker Desktop is the simplest option on macOS and Windows — it bundles everything you need. On Linux, Docker Engine works well and avoids the Docker Desktop license requirements for larger organizations.

:::tip[Check your Docker installation]
Run `docker info` in your terminal. If you see container and image counts, Docker is ready. If you get a connection error, the Docker daemon isn't running — start Docker Desktop or run `sudo systemctl start docker` on Linux.
:::

:::caution[Windows users]
WSL 2 is required. Docker Desktop's legacy Hyper-V backend is not supported because DevContainers rely on WSL 2 for Linux container support. If you haven't enabled WSL 2, follow [Microsoft's WSL installation guide](https://learn.microsoft.com/en-us/windows/wsl/install) before proceeding.
:::

### DevContainer Client

CodeForge uses the open [Dev Containers specification](https://containers.dev/). Any compatible client works — pick whichever fits your workflow:

| Client | Notes |
|--------|-------|
| **VS Code** with [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) | Most popular option. Version 1.85+ required. |
| **DevContainer CLI** | Standalone CLI: `npm install -g @devcontainers/cli`. No editor required — connect via any terminal. |
| **GitHub Codespaces** | Zero local setup. Push your repo with `.devcontainer/` and create a Codespace. |
| **JetBrains Gateway** | Native devcontainer.json support via [Dev Containers plugin](https://plugins.jetbrains.com/plugin/21962-dev-containers). |
| **DevPod** | Open-source, editor-agnostic client. Supports local Docker, Kubernetes, and cloud backends. See [devpod.sh](https://devpod.sh/). |

:::tip[Port forwarding outside VS Code]
VS Code auto-detects ports opened inside the container. Other clients don't. CodeForge includes `devcontainer-bridge` (`dbr`) for dynamic port forwarding from any terminal. See the [Port Forwarding reference](../reference/port-forwarding/) for setup details.
:::

### Claude Code

CodeForge is built around Claude Code, so you need:

- An active **Claude Pro**, **Claude Max**, or **Claude API** subscription
- The `claude` CLI installed and authenticated — CodeForge installs it automatically inside the container, but you'll need to authenticate on first launch

You'll authenticate Claude Code during your first session. The container handles installation; you just need valid credentials.

## Hardware Recommendations

CodeForge runs a full development environment inside a container, including language runtimes, language servers, and CLI tools. The container is configured with a 6 GB memory limit and 12 GB swap by default.

### Minimum

| Resource | Requirement |
|----------|-------------|
| RAM | 8 GB |
| Disk space | 20 GB free (container images, tool caches, runtimes) |
| CPU | 2 cores |

These minimums will get you running, but expect slower container builds and some lag when multiple language servers are active.

### Recommended

| Resource | Requirement |
|----------|-------------|
| RAM | 16 GB or more |
| Disk space | 40 GB free |
| CPU | 4+ cores |

With 16 GB of RAM and a modern processor, the container runs smoothly and builds complete in a few minutes. More disk space helps if you work on multiple projects with separate container images.

:::tip[Docker resource allocation]
On macOS and Windows, Docker Desktop runs inside a VM with its own resource limits. Open Docker Desktop settings and check that the VM has at least 4 GB RAM and 20 GB disk allocated. The container itself is configured with `--memory=6g --memory-swap=12g`, so your Docker VM needs headroom above that.
:::

## Operating System Support

| OS | Version | Notes |
|----|---------|-------|
| macOS | 12 (Monterey) or later | Intel and Apple Silicon both supported |
| Linux | Ubuntu 22.04+, Debian 12+, Fedora 38+ | Or any distribution with Docker Engine 24+ |
| Windows | Windows 10/11 with WSL 2 | Docker Desktop required |

## Network Requirements

**During initial setup**, internet access is required to:

- Pull the base container image (`mcr.microsoft.com/devcontainers/python:3.14`)
- Install DevContainer features (Node.js, Bun, uv, and 20+ custom features; Rust is opt-in)
- Download CLI tools and language servers

The first build downloads roughly 2-4 GB depending on what's cached. Subsequent container starts are much faster because Docker caches the built layers.

**After setup**, most features work offline. A few tools require connectivity:

- GitHub CLI (`gh`) — for repository operations
- Web search and API calls — if used during Claude Code sessions
- `ccusage` / `ccburn` — for usage data retrieval

## Verifying Your Setup

Once you've confirmed the prerequisites, you're ready to install. After installation, CodeForge provides a built-in health check:

```bash
check-setup
```

This command validates that all tools, runtimes, and plugins installed correctly. Run it any time you suspect something is misconfigured.

## Next Steps

- [Installation Guide](./installation/) — proceed with setup
- [First Session](./first-session/) — what to expect in your first session
