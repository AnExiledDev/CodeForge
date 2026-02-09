# Optional Features

CodeForge includes several features that are available but not enabled by default. This guide covers how to enable and configure them.

## mcp-qdrant (Vector Memory for Claude)

Adds persistent vector memory to Claude Code via a Qdrant MCP server. Claude can store and retrieve information across sessions.

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

- `all-MiniLM-L6-v2` (default, smallest, fastest)
- `BAAI/bge-small-en-v1.5`
- `BAAI/bge-base-en-v1.5`
- `sentence-transformers/all-mpnet-base-v2`

### Prerequisites

Already met by default container: Python 3.14 and uv are pre-installed.

### How It Works

1. During container build, the embedding model is pre-downloaded from GCS (not HuggingFace, to avoid network issues in containers).
2. On container start, a post-start hook registers the Qdrant MCP server in Claude Code's `settings.json`.
3. Claude Code can then use `qdrant-store` and `qdrant-find` tools to persist and search memories.

### Verification

```bash
uvx mcp-server-qdrant --help
```

---

## mcp-reasoner (Enhanced Reasoning)

Adds a reasoning MCP server that gives Claude Code access to structured thinking tools (beam search, Monte Carlo tree search, etc.).

### Enabling

Add to `devcontainer.json` under `"features"`:

```json
"./features/mcp-reasoner": {}
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `version` | `latest` | Version to install. `"none"` to skip. |
| `username` | `automatic` | Container user to install for |

### Prerequisites

Already met by default container: Node.js LTS is pre-installed.

### How It Works

1. During build, clones and builds the mcp-reasoner Node.js project.
2. On container start, a post-start hook registers it as an MCP server in `settings.json`.
3. Claude Code gains access to reasoning tools: `beam_search`, `mcts`, `hypothesis_test`, etc.

### Verification

```bash
node ~/mcp-reasoner/dist/index.js --help
```

---

## splitrail (Terminal Splitting)

A terminal multiplexer utility for splitting panes. Useful for Agent Teams workflows.

### Enabling

Add to `devcontainer.json` under `"features"`:

```json
"./features/splitrail": {}
```

### Prerequisites

Requires Rust toolchain. Add the Rust devcontainer feature first:

```json
"ghcr.io/devcontainers/features/rust:1": {}
```

Then add splitrail to `overrideFeatureInstallOrder` after the Rust feature.

### How It Works

splitrail is a Rust-based tool that provides tmux pane management for Claude Code Agent Teams. It works alongside the tmux feature to provide split-pane terminal sessions.

---

## Disabling Default Features

Any feature can be disabled without removing it from `devcontainer.json` by setting `"version": "none"`:

```json
"./features/hadolint": { "version": "none" },
"./features/shellcheck": { "version": "none" }
```

The feature entry stays in the config for easy re-enabling — just remove `"version": "none"` or set it to `"latest"`.
