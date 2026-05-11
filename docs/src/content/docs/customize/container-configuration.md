---
title: Container Configuration
description: Configure devcontainer.json, features, runtime resources, forwarded ports, and rebuild behavior.
sidebar:
  order: 2
---

`.devcontainer/devcontainer.json` controls the container itself.

Use it when you want to change:

- the base image
- resource limits
- installed DevContainer features
- forwarded ports
- optional runtimes and tools

CodeForge's default service ports include Claude Code Karma on `7847` and its API on `7848`.

## Base Image and Resources

The base image, memory limits, and named volumes are defined in `docker-compose.yml`. The `initializeCommand` generates a compose override from `.codeforge/mounts.json` for project-specific volume mounts.

```json
{
  "dockerComposeFile": [
    "docker-compose.yml",
    "docker-compose.codeforge.yml"
  ],
  "service": "codeforge",
  "initializeCommand": "node .devcontainer/scripts/generate-mounts.mjs",
  "remoteUser": "vscode",
  "containerUser": "vscode"
}
```

## Features

Features install runtimes and tools into the container.

```json
{
  "features": {
    "ghcr.io/devcontainers/features/node:1.7.1": { "version": "lts" },
    "./features/claude-code-native": {},
    "./features/ruff": { "version": "latest" }
  }
}
```

For local features, setting `"version": "none"` disables the feature without removing it.

## Ports

Port behavior is configured in `devcontainer.json`, but how it works depends on the client.

Use [Accessing Services](/use/accessing-services/) for the practical client-by-client guide.

## Rebuild Expectations

Changing `devcontainer.json` usually requires a rebuild.

- use a normal rebuild for routine changes
- use a no-cache rebuild when the first build was interrupted or a feature install is corrupted

## Volume Mounts

CodeForge uses Docker Compose for volume management. Base volumes (config, caches) are defined in `docker-compose.yml`. Project-specific volumes (e.g., `node_modules`, `.next`) are configured via `.codeforge/mounts.json`.

### Detecting volume candidates

Run `codeforge doctor` inside the container to scan for high-churn directories on slow filesystems:

```bash
codeforge doctor --fix
```

The fix mode writes `.codeforge/mounts.json` and volumes auto-apply on the next container rebuild.

### Manual volume configuration

Add entries to `.codeforge/mounts.json` directly:

```json
{
  "version": 1,
  "volumes": [
    {
      "path": "node_modules",
      "source": "user",
      "signal": "package.json",
      "added": "2026-05-05"
    }
  ]
}
```

Rebuild the container to apply. The `initializeCommand` reads this file and generates `docker-compose.codeforge.yml` with the corresponding Docker volumes.

## What This Page Does Not Cover

This page focuses on the container itself. For runtime Claude behavior, use [Settings and Permissions](./settings-and-permissions/).

## Related

- [Optional Components](./optional-components/)
- [Accessing Services](/use/accessing-services/)
- [Troubleshooting](/reference/troubleshooting/)
