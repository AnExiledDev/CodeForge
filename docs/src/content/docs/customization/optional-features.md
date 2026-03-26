---
title: Optional Features
description: Non-default features available in CodeForge — how to enable and configure them.
sidebar:
  order: 7
---

CodeForge includes several features that are available but not enabled by default. This page covers how to enable and configure them.

## Per-Hook Disable

Individual hooks can be disabled without turning off their entire plugin. The file `.codeforge/config/disabled-hooks.json` contains a `"disabled"` array of script names:

```json
{
  "disabled": [
    "git-state-injector",
    "ticket-linker",
    "spec-reminder",
    "commit-reminder"
  ]
}
```

Add a hook's script name (without path or extension) to disable it. Remove it to re-enable. Changes take effect immediately — no container rebuild required.

This is useful when a hook is noisy or conflicts with your workflow but you want the rest of the plugin to keep running. See [Hooks — Per-Hook Disable](./hooks/#per-hook-disable) for the full reference.

## LSP Servers

Language Server Protocol servers provide inline diagnostics, go-to-definition, and completions for supported languages. LSP servers are disabled by default.

### Enabling

1. In `devcontainer.json`, set the `lsp-servers` feature version to `"latest"`:

```json
"./features/lsp-servers": { "version": "latest" }
```

2. In `settings.json`, ensure the `codeforge-lsp` plugin is enabled:

```json
{
  "enabledPlugins": {
    "codeforge-lsp@devs-marketplace": true
  }
}
```

3. Rebuild the container.

## Dashboard

The CodeForge Dashboard is a Svelte 5 SPA for visual session analytics, conversation replay, task/plan/agent views, and cost tracking. It is opt-in.

### Enabling

Uncomment or add the `claude-session-dashboard` feature in `devcontainer.json`, or use the `codeforge-dashboard` feature:

```json
"./features/codeforge-dashboard": {}
```

Rebuild the container after enabling. The dashboard runs on a forwarded port — check the container's port list after startup.

## ccms (Claude Code Memory Search)

A Rust-based session search tool. Replaced in the default build by `codeforge session search`, but still available as an opt-in feature.

### Enabling

Uncomment the `ccms` entry in `devcontainer.json`:

```json
"./features/ccms": {}
```

:::caution[Requires Rust]
ccms is a Rust binary. Enabling it also requires the Rust toolchain — uncomment the Rust feature as well if it is not already enabled.
:::

## ccburn

A terminal burn-down visualization tool. Currently commented out in the default build — it has been replaced by `ccstatusline`.

If you want the older burn-down view, uncomment it in `devcontainer.json`:

```json
"./features/ccburn": {}
```

:::note
`ccstatusline` is the active replacement and is enabled by default. Only enable ccburn if you specifically need its burn-down visualization.
:::

## Rust Toolchain

The Rust compiler and Cargo are available as an opt-in feature for projects that need Rust compilation (including ccms).

### Enabling

Uncomment the Rust feature in `devcontainer.json`:

```json
"ghcr.io/devcontainers/features/rust:1.5.0": { "version": "latest" }
```

Rebuild the container after enabling.

## Go Runtime

The Go compiler and toolchain are available as an opt-in feature for projects that include Go code.

### Enabling

Uncomment the Go feature in `devcontainer.json`:

```json
"ghcr.io/devcontainers/features/go:1": { "version": "latest" }
```

Rebuild the container after enabling.

## Formatters and Linters

Several formatters and linters are present in `devcontainer.json` but disabled by default (set to `"version": "none"`). To enable any of them, change the version to `"latest"` and rebuild:

| Tool | Feature Path | Purpose |
|------|-------------|---------|
| shfmt | `./features/shfmt` | Shell script formatter |
| dprint | `./features/dprint` | Pluggable code formatter (Markdown, TOML, JSON, etc.) |
| shellcheck | `./features/shellcheck` | Shell script static analysis |
| hadolint | `./features/hadolint` | Dockerfile linter |

### Example

```json
{
  "features": {
    "./features/shfmt": { "version": "latest" },
    "./features/dprint": { "version": "latest" },
    "./features/shellcheck": { "version": "latest" },
    "./features/hadolint": { "version": "latest" }
  }
}
```

These tools integrate with the auto-code-quality plugin — once installed, they are automatically invoked at Stop for any files they support.

## mcp-qdrant (Vector Memory for Claude)

Adds persistent vector memory to Claude Code via a Qdrant MCP server. Claude can store and retrieve information across sessions using `qdrant-store` and `qdrant-find` tools.

### Enabling

Add to `devcontainer.json` under `"features"`:

```json
"./features/mcp-qdrant": {
    "collectionName": "my-project-memory",
    "embeddingModel": "all-MiniLM-L6-v2"
}
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `collectionName` | `agent-memory` | Qdrant collection name |
| `embeddingModel` | `all-MiniLM-L6-v2` | Embedding model for vector search |
| `qdrantUrl` | (empty) | Remote Qdrant server URL. If empty, uses local storage. |
| `qdrantApiKey` | (empty) | API key for remote Qdrant server |
| `qdrantLocalPath` | `/workspaces/.qdrant/storage` | Local storage path (when no URL set) |

### Supported Embedding Models

- `all-MiniLM-L6-v2` — default, smallest, fastest
- `BAAI/bge-small-en-v1.5`
- `BAAI/bge-base-en-v1.5`
- `sentence-transformers/all-mpnet-base-v2`

### How It Works

1. During container build, the embedding model is pre-downloaded from GCS (not HuggingFace, to avoid network issues in containers).
2. On container start, a post-start hook registers the Qdrant MCP server in Claude Code's `settings.json`.
3. Claude Code can then use `qdrant-store` and `qdrant-find` tools to persist and search memories.

### Verification

```bash
uvx mcp-server-qdrant --help
```

:::note[Prerequisites]
Python 3.14 and uv are pre-installed in the default container — no additional setup required.
:::

## Disabling Default Features

Any feature can be disabled without removing it from `devcontainer.json` by setting `"version": "none"`:

```json
"./features/hadolint": { "version": "none" },
"./features/shellcheck": { "version": "none" }
```

The feature entry stays in the config for easy re-enabling — just remove `"version": "none"` or set it to `"latest"`.

:::tip[When to Disable Features]
Disabling unused features speeds up container builds and reduces memory usage. If you don't use Go, for example, disabling the Go language server saves resources.
:::

## Related

- [Configuration](./configuration/) — settings.json and devcontainer.json reference
- [Plugins](../plugins/) — plugin system overview and per-plugin configuration
- [Troubleshooting](../reference/troubleshooting/) — solutions for build and feature issues
