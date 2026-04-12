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

## Base Image and Resources

Example:

```json
{
  "image": "mcr.microsoft.com/devcontainers/python:3.14",
  "runArgs": ["--memory=6g", "--memory-swap=12g"],
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

## What This Page Does Not Cover

This page focuses on the container itself. For runtime Claude behavior, use [Settings and Permissions](./settings-and-permissions/).

## Related

- [Optional Components](./optional-components/)
- [Accessing Services](/use/accessing-services/)
- [Troubleshooting](/reference/troubleshooting/)
