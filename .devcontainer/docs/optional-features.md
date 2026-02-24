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

## Disabling Default Features

Any feature can be disabled without removing it from `devcontainer.json` by setting `"version": "none"`:

```json
"./features/hadolint": { "version": "none" },
"./features/shellcheck": { "version": "none" }
```

The feature entry stays in the config for easy re-enabling — just remove `"version": "none"` or set it to `"latest"`.
