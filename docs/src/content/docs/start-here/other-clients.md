---
title: Other Clients
description: Setup guidance for Codespaces, JetBrains, and other DevContainer clients that are not the default beginner path.
sidebar:
  order: 7
---

VS Code is the recommended first-run path, but CodeForge works with other DevContainer clients too.

## GitHub Codespaces

1. Push your project with `.devcontainer/` committed.
2. Open the repository on GitHub.
3. Create a Codespace.
4. Let Codespaces build the container from `devcontainer.json`.

This avoids local Docker setup entirely.

## JetBrains Gateway

1. Open JetBrains Gateway, or IntelliJ IDEA / PyCharm with the Dev Containers plugin.
2. Choose **Dev Containers** as the connection type.
3. Point it at the project directory containing `.devcontainer/`.
4. Let the IDE build and connect.

## DevPod and Similar Clients

Any client that respects the Dev Containers specification can use the same setup. The main differences are usually around port forwarding and IDE-specific UX, not CodeForge itself.

## Key Difference from VS Code

VS Code auto-forwards ports. Other clients often do not, so you may need [`dbr`](/use/accessing-services/) or SSH tunneling to access services.

## Next Steps

- [Verify Your Install](./verify-install/)
- [Start Your First Session](./first-session/)
- [Accessing Services](/use/accessing-services/)
