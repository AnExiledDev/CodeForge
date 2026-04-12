---
title: Install in VS Code
description: The recommended beginner path for installing CodeForge in a project and opening it in a DevContainer.
sidebar:
  order: 2
---

This is the recommended setup path for new users.

## Step 1: Run the Installer

From your project root:

```bash
npx @coredirective/cf-container
```

This creates a `.devcontainer/` directory and a `.codeforge/` directory in your project.

### If `.devcontainer/` already exists

Use one of these instead:

```bash
npx @coredirective/cf-container --force
npx @coredirective/cf-container --reset
```

- `--force` performs a smart update and preserves your customizations
- `--reset` recreates `.devcontainer/` from clean defaults while preserving `.codeforge/`

## Step 2: Open the Project in VS Code

Open the project folder in VS Code. If the Dev Containers extension is installed, VS Code should prompt you to reopen the folder in a container.

If you miss the prompt:

1. Press `Ctrl+Shift+P` or `Cmd+Shift+P`
2. Run **Dev Containers: Reopen in Container**

## Step 3: Wait for the First Build

The first build usually takes several minutes. During that time CodeForge is:

1. Pulling the base image
2. Installing features and runtimes
3. Deploying configuration and shell aliases
4. Activating plugins and setup scripts

Do not interrupt the first build unless it is clearly stuck. If it fails halfway through, rebuild without cache.

## What Gets Created

```text
your-project/
├── .devcontainer/
│   ├── devcontainer.json
│   ├── .env
│   ├── features/
│   ├── plugins/
│   └── scripts/
├── .codeforge/
│   ├── file-manifest.json
│   ├── config/
│   └── scripts/
└── ...your existing files
```

## What to Do Next

Once the container is open and the terminal is available, continue to [Verify Your Install](./verify-install/).

## Alternate Paths

- [Use the DevContainer CLI](./devcontainer-cli/)
- [Other Clients](./other-clients/)
- [Migrate to v2](./migrate-to-v2/)
