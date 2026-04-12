---
title: Verify Your Install
description: Confirm that CodeForge, Claude Code, tools, aliases, and plugins are installed and working correctly.
sidebar:
  order: 3
---

Once your container is running, verify the setup before you start real work.

## Run the Health Check

```bash
check-setup
```

This validates the core CodeForge installation: tools, runtime config, and alias deployment.

## List Installed Tools

```bash
cc-tools
```

Use this to confirm what is actually available in your container and which components are enabled or disabled.

## Healthy Installation Checklist

You should be able to confirm these categories quickly:

| Category | Examples |
|----------|----------|
| Session commands | `cc`, `claude`, `ccw`, `ccraw` |
| Core languages | `python`, `node`, `bun` |
| Code intelligence | `sg`, `tree-sitter` |
| Utilities | `git`, `gh`, `docker`, `jq`, `tmux` |

Some items are optional or disabled by default. Use [What’s Included](/reference/whats-included/) for the canonical inventory and status definitions.

## If Something Looks Wrong

Check these common cases first:

1. Open a new terminal so aliases reload.
2. Re-run `check-setup`.
3. Confirm the missing tool is not disabled by default.
4. Rebuild the container if feature installation failed.

If the problem persists, go to [Troubleshooting](/reference/troubleshooting/).

## Next Step

When verification passes, continue to [Start Your First Session](./first-session/).
