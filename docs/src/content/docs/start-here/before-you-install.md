---
title: Before You Install
description: Prerequisites, supported clients, hardware guidance, and preflight checks for CodeForge.
sidebar:
  order: 1
---

Before you install CodeForge, make sure the container runtime and client you plan to use are ready.

## Recommended Setup

The smoothest first experience is:

- Docker Desktop or Docker Engine running
- VS Code with the Dev Containers extension
- A Claude subscription or API access for Claude Code authentication

## Required Software

### Docker

CodeForge runs inside a DevContainer, so you need a working container runtime.

| Platform | Runtime | Recommended Version |
|----------|---------|-------------------|
| macOS | Docker Desktop | 4.x or later |
| Windows | Docker Desktop with WSL 2 backend | 4.x or later |
| Linux | Docker Engine | 24.x or later |

Check Docker first:

```bash
docker info
```

If that fails, start Docker before going further.

### DevContainer Client

CodeForge follows the Dev Containers specification. These clients are supported:

| Client | Best For | Notes |
|--------|----------|-------|
| **VS Code** | First-time users | Recommended path. Requires the Dev Containers extension and VS Code 1.85+. |
| **DevContainer CLI** | Terminal-only users | Works well, but port forwarding is manual unless you use `dbr`. |
| **GitHub Codespaces** | Cloud setup | No local Docker required. |
| **JetBrains Gateway** | JetBrains users | Requires the Dev Containers plugin. |
| **DevPod** | Alternative client | Works with the same `devcontainer.json`. |

### Claude Code

CodeForge installs Claude Code inside the container, but you still need valid Claude access:

- **Claude Pro**, **Claude Max**, or **Claude API** access
- Authentication on first launch, or a preconfigured auth token in your secrets setup

## Windows Requirement

Windows users need **WSL 2**. Docker Desktop's legacy Hyper-V path is not supported for this workflow.

## Hardware Guidance

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 8 GB | 16 GB or more |
| Disk | 20 GB free | 40 GB free |
| CPU | 2 cores | 4+ cores |

CodeForge configures the container with `--memory=6g --memory-swap=12g`, so Docker needs headroom above that.

## Network Expectations

The first build downloads the base image plus tooling and can pull several gigabytes depending on cache state. After setup, most workflows work locally, but GitHub and web-backed features still require network access.

## Preflight Checklist

Before installing, confirm all of these:

1. `docker info` works.
2. Your client is installed and updated.
3. You know which setup path you want: VS Code, CLI, Codespaces, or JetBrains.
4. You have Claude credentials ready for first launch.

## Next Steps

- New users: [Install in VS Code](./install-in-vscode/)
- Terminal users: [Use the DevContainer CLI](./devcontainer-cli/)
- Other environments: [Other Clients](./other-clients/)
- Problems before install: [Troubleshooting](/reference/troubleshooting/)
