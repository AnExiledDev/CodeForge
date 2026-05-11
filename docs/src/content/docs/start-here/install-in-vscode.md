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

This creates `.devcontainer/` and a minimal `.codeforge/` overrides/state directory. Packaged defaults stay under `.devcontainer/defaults/codeforge/`; `.codeforge/` is where you put project overrides and where CodeForge stores marker files.

### If `.devcontainer/` already exists

Use one of these instead:

```bash
npx @coredirective/cf-container --force
npx @coredirective/cf-container --reset
```

- `--force` updates `.devcontainer/` and preserves `.codeforge/` overrides/state
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
3. Generating Claude settings and deploying effective config
4. Activating plugins and setup scripts

Do not interrupt the first build unless it is clearly stuck. If it fails halfway through, rebuild without cache.

## What Gets Created

```text
your-project/
|-- .devcontainer/
|   |-- devcontainer.json
|   |-- defaults/codeforge/
|   |-- .generated/
|   |-- features/
|   |-- plugins/
|   `-- scripts/
|-- .codeforge/
|   |-- README.md
|   |-- container.json
|   |-- secrets/
|   |-- .markers/
|   |-- .checksums/
|   `-- data/
`-- ...your existing files
```

`.codeforge/` is not a copied defaults tree. Add files there only when you want to override a packaged default, such as `.codeforge/claude/system-prompts/main.md` or `.codeforge/claude/settings/base.json`. Place secrets (tokens, API keys) in `.codeforge/secrets/` as individual files -- see [Secrets and Auth](/customize/secrets-and-auth/) for details.

## What to Do Next

Once the container is open and the terminal is available, continue to [Verify Your Install](./verify-install/).

## Alternate Paths

- [Use the DevContainer CLI](./devcontainer-cli/)
- [Other Clients](./other-clients/)
- [Migrate to v2/v3](./migrate-to-v2/)
