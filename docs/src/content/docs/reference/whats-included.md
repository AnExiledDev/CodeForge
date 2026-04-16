---
title: What’s Included
description: Canonical inventory of CodeForge components, counts, and status labels.
sidebar:
  order: 1
---

This page is the source of truth for what ships with CodeForge.

Other pages should link here instead of repeating counts.

## Status Legend

| Status | Meaning |
|--------|---------|
| **Default** | Included and active in the normal install |
| **Optional** | Available, but requires explicit enablement |
| **Disabled by default** | Present in config, but off until you change the version or toggle |
| **Experimental** | Available, but interface or behavior may still change |
| **Deprecated** | Superseded by another workflow or command |

## Canonical Counts

| Category | Count |
|----------|-------|
| Plugins | 17 |
| Custom agents | 19 |
| Skills | 34 |
| CLI tools and utilities | 25 |
| DevContainer features | 23 |

These counts are the canonical inventory numbers. Some deeper reference pages intentionally include adjacent items such as runtimes or language servers for convenience, but they should link back here for the official counts.

## Core Runtime and Workflow Components

| Component | Status | Notes |
|-----------|--------|-------|
| Claude Code session aliases (`cc`, `claude`, `ccw`, `ccraw`) | Default | Main entry points |
| Agent system | Default | Replaces built-in agent routing with CodeForge specialists |
| Skill engine | Default | Suggests and loads domain-specific skills |
| Session context | Default | Injects git and TODO context |
| Auto code quality | Default | Formats, lints, and runs advisory checks |
| Dangerous command blocker | Default | Blocks destructive shell commands |
| Workspace scope guard | Default | Enforces project boundaries |
| Protected files guard | Default | Prevents edits to sensitive files |

## Tools and Commands by Status

| Item | Status | Notes |
|------|--------|-------|
| `cc`, `claude`, `ccw`, `ccraw`, `cc-orc` | Default | Session launch commands |
| `check-setup`, `cc-tools`, `ccusage`, `claude-monitor` | Default | Everyday operational tools |
| LSP servers | Disabled by default | Require feature enablement and plugin toggle |
| `ccms` | Deprecated | Replaced by `codeforge session search` |
| `ccburn` | Disabled by default | Older burn-rate view, largely superseded by `ccstatusline` |
| `codeforge` CLI | Experimental | Under active development |

## Optional and Disabled-by-Default Components

| Component | Status | Where to configure |
|-----------|--------|--------------------|
| LSP servers | Disabled by default | `devcontainer.json` + plugin enablement |
| Rust toolchain | Optional | `devcontainer.json` |
| Go toolchain | Optional | `devcontainer.json` |
| `shfmt`, `dprint`, `shellcheck`, `hadolint` | Disabled by default | `devcontainer.json` feature versions |
| `mcp-qdrant` | Optional | `devcontainer.json` |

## Where to Go Next

- [Commands Reference](./commands/)
- [CLI Tools Reference](./cli-tools/)
- [Agents Reference](./agents/)
- [Skills Reference](./skills/)
- [Optional Components](/customize/optional-components/)
