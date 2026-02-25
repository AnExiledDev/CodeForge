# Qdrant MCP Server Feature

A DevContainer Feature that installs and configures the Qdrant MCP (Model Context Protocol) server for AI coding agents. Enables vector database integration for semantic search, embeddings management, and RAG workflows.

## Migration to Native mcpServers Support

This feature now uses **VS Code's native devcontainer mcpServers support** instead of post-start hooks. This means:

- **Declarative Configuration**: MCP server configuration lives in `devcontainer-feature.json`
- **Dynamic Environment Variables**: Configuration loaded from `/workspaces/.qdrant-mcp.env` at runtime
- **Standard Pattern**: Follows the same pattern as other MCP servers (see [ADX MCP Server](https://github.com/pab1it0/adx-mcp-server))
- **No Claude CLI Registration**: Automatic integration with VS Code without manual CLI commands

## Quick Start

```json
{
  "features": {
    "ghcr.io/devcontainers/features/python:1": {},
    "ghcr.io/devcontainers/features/common-utils:2": {},
    "ghcr.io/yourorg/features/mcp-qdrant:1": {
      "qdrantUrl": "https://your-cluster.cloud.qdrant.io:6333",
      "qdrantApiKey": "${env:QDRANT_API_KEY}",
      "collectionName": "my-vectors",
      "embeddingModel": "all-MiniLM-L6-v2"
    }
  }
}
```

**Note:** This feature requires Python and common-utils features to be installed first (they provide `uvx` and `jq`).

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `qdrantUrl` | string | `""` | Qdrant instance URL. If set, uses cloud mode. If empty, uses local mode. |
| `qdrantApiKey` | string | `""` | API key for Qdrant Cloud authentication (required for cloud mode) |
| `qdrantLocalPath` | string | `/workspaces/.qdrant/storage` | Local storage path (only used when qdrantUrl is empty) |
| `collectionName` | string | `agent-memory` | Default collection name for vectors |
| `embeddingModel` | string | `all-MiniLM-L6-v2` | FastEmbed model (must be one of the supported models) |
| `username` | string | `automatic` | User to install for (auto-detects: vscode, node, codespace, or root) |

### Configuration Modes

**Cloud Mode** (when `qdrantUrl` is set):
- Connects to Qdrant Cloud or self-hosted instance
- Requires valid URL starting with `http://` or `https://`
- Requires `qdrantApiKey` for authentication
- Data persists across container rebuilds

**Local Mode** (when `qdrantUrl` is empty):
- Uses local file storage via `qdrantLocalPath`
- No API key needed
- Data stored in container filesystem
- **Warning:** Data lost on container rebuild unless path is volume-mounted

### Important: Environment Variable Naming

DevContainer Features convert camelCase option names to UPPERCASE without underscores:

```
devcontainer.json        →  Environment Variable
"qdrantUrl"              →  $QDRANTURL (not $QDRANT_URL)
"qdrantApiKey"           →  $QDRANTAPIKEY (not $QDRANT_API_KEY)
"collectionName"         →  $COLLECTIONNAME
```

This is standard DevContainer Features behavior. Use `${env:VAR}` syntax for secrets:

```json
{
  "features": {
    "ghcr.io/yourorg/features/mcp-qdrant:1": {
      "qdrantApiKey": "${env:QDRANT_API_KEY}"
    }
  }
}
```

## Examples

### Qdrant Cloud Configuration

```json
{
  "features": {
    "ghcr.io/yourorg/features/mcp-qdrant:1": {
      "qdrantUrl": "https://xyz-cluster.us-east4-0.gcp.cloud.qdrant.io:6333",
      "qdrantApiKey": "${env:QDRANT_API_KEY}",
      "collectionName": "project-knowledge"
    }
  }
}
```

### Local Qdrant Instance

```json
{
  "features": {
    "ghcr.io/yourorg/features/mcp-qdrant:1": {
      "qdrantLocalPath": "/workspaces/.qdrant/storage",
      "collectionName": "local-vectors"
    }
  }
}
```

### Custom Embedding Model

```json
{
  "features": {
    "ghcr.io/yourorg/features/mcp-qdrant:1": {
      "qdrantUrl": "https://my-instance.cloud.qdrant.io:6333",
      "qdrantApiKey": "${env:QDRANT_API_KEY}",
      "embeddingModel": "BAAI/bge-base-en-v1.5"
    }
  }
}
```

## What This Feature Installs

- **mcp-server-qdrant**: Python package installed via `uvx` (cached, no repeated downloads)
- **Native mcpServers Support**: Automatically configures the MCP server in `.devcontainer/devcontainer-feature.json` using VS Code's native mcpServers support
- **Environment File**: Creates `/workspaces/.qdrant-mcp.env` with dynamic configuration variables
- **Disk Usage**: ~500MB-2GB depending on embedding model (stored in `~/.cache/fastembed/`)

## Requirements

This feature has explicit dependencies that **must** be installed first:

```json
{
  "features": {
    "ghcr.io/devcontainers/features/python:1": {},
    "ghcr.io/devcontainers/features/common-utils:2": {},
    "ghcr.io/yourorg/features/mcp-qdrant:1": {}
  }
}
```

**Required by this feature:**
- **Python + uvx**: For running mcp-server-qdrant
- **jq**: For safe JSON generation (from common-utils)

The feature will validate these are present and exit with an error if missing.

## Features

- ✅ **Automatic Installation**: Installs Qdrant MCP server via uvx
- ✅ **Cloud or Local**: Supports both Qdrant Cloud and local instances
- ✅ **Idempotent**: Safe to run multiple times
- ✅ **Multi-user**: Automatically detects container user
- ✅ **Config-aware**: Respects `CLAUDE_CONFIG_DIR` environment variable (defaults to `~/.claude`)
- ✅ **Native mcpServers**: Uses VS Code's native devcontainer mcpServers support (declarative configuration)
- ✅ **Dynamic Configuration**: Environment variables loaded from `/workspaces/.qdrant-mcp.env` file
- ✅ **Secure**: API keys protected with 600 permissions on env file

## Embedding Models

Available embedding models:

| Model | Dimensions | Speed | Quality | Use Case |
|-------|-----------|-------|---------|----------|
| `all-MiniLM-L6-v2` | 384 | ⚡⚡⚡ | ⭐⭐ | Default, fast |
| `BAAI/bge-small-en-v1.5` | 384 | ⚡⚡ | ⭐⭐⭐ | Better retrieval |
| `sentence-transformers/all-mpnet-base-v2` | 768 | ⚡ | ⭐⭐⭐⭐ | Higher quality |
| `BAAI/bge-base-en-v1.5` | 768 | ⚡ | ⭐⭐⭐⭐⭐ | State-of-the-art |

## Configuration

### ✅ Automatic Setup

This feature automatically configures the Qdrant MCP server using VS Code's native **devcontainer mcpServers support**. Configuration is declarative and lives in the feature definition with dynamic environment variables loaded from `/workspaces/.qdrant-mcp.env`.

**No manual configuration steps required!**

### Architecture

The configuration chain works as follows:

1. **Feature Definition** (`devcontainer-feature.json`): Declares the MCP server configuration
2. **Environment File** (`/workspaces/.qdrant-mcp.env`): Contains runtime environment variables
3. **VS Code Integration**: Automatically loads the server on devcontainer startup
4. **MCP Server**: Runs via `uvx mcp-server-qdrant` with environment variables from the envFile

### Verify It Worked

**1. Check that the environment file was created:**
```bash
cat /workspaces/.qdrant-mcp.env
```

You should see all configuration variables (some may be empty for local mode):
```
COLLECTION_NAME=agent-memory
EMBEDDING_MODEL=all-MiniLM-L6-v2
QDRANT_URL=
QDRANT_API_KEY=
QDRANT_LOCAL_PATH=/workspaces/.qdrant/storage
```

**2. Verify the MCP server configuration:**
```bash
# Check the feature defines it
grep -A 5 '"qdrant"' .devcontainer/features/mcp-qdrant/devcontainer-feature.json
```

**3. Restart VS Code or your dev container**

**4. Test it:**

Ask your AI agent:
```
"Show me what MCP servers you have available"
```

You should see `qdrant` listed with tools like `add_point`, `search`, etc.

Then test storing data:
```
"Store this in my Qdrant collection: Test message"
```

### Manual Reconfiguration (Optional)

If you need to change environment variables after installation:

```bash
# Edit the environment file
vim /workspaces/.qdrant-mcp.env

# Restart your container/agent to load new values
```

## Usage with AI Agents

### Claude Code

```
"Store this document in my Qdrant collection"
"Search my knowledge base for information about vectors"
"What did I store yesterday about embeddings?"
```

### Available MCP Tools

The Qdrant MCP server provides:
- `add_point` - Add text with embeddings
- `search` - Semantic similarity search
- `get_point` - Retrieve by ID
- `delete_point` - Remove from collection
- `list_collections` - View all collections
- `create_collection` - Create new collection

## Architecture

```
AI Agent (Claude Code, Cline, etc.)
    ↓
Model Context Protocol
    ↓
mcp-server-qdrant (uvx)
    ↓
FastEmbed (embedding generation)
    ↓
Qdrant Client
    ↓
Qdrant Cloud / Local Instance
```

## Getting Qdrant Credentials

### Qdrant Cloud (Recommended for Getting Started)

1. Visit [cloud.qdrant.io](https://cloud.qdrant.io)
2. Create a free cluster
3. Copy cluster URL from dashboard
4. Generate API key
5. Add to `.env` or devcontainer.json:
   ```bash
   QDRANT_API_KEY=your-key-here
   ```

### Local Qdrant

No credentials needed. Just specify `qdrantLocalPath`.

## Troubleshooting

### Server Not Appearing in AI Agent

**Symptom:** Installation succeeds but agent doesn't see Qdrant MCP server

**Cause:** Environment file not created or devcontainer not restarted

**Solution:**
```bash
# Verify the environment file exists and has correct permissions
ls -la /workspaces/.qdrant-mcp.env
# Should show: -rw------- (600)

# Check the file contents
cat /workspaces/.qdrant-mcp.env

# Restart your devcontainer in VS Code:
# Command Palette → "Dev Containers: Rebuild and Reopen in Container"
```

### Installation Fails: "uvx is not available"

**Cause:** Python feature not installed first

**Solution:** Add Python feature before mcp-qdrant:
```json
{
  "features": {
    "ghcr.io/devcontainers/features/python:1": {},
    "ghcr.io/yourorg/features/mcp-qdrant:1": {}
  }
}
```

### Installation Fails: "jq is not available"

**Cause:** common-utils feature not installed

**Solution:** Add common-utils feature:
```json
{
  "features": {
    "ghcr.io/devcontainers/features/common-utils:2": {},
    "ghcr.io/yourorg/features/mcp-qdrant:1": {}
  }
}
```

### Connection Issues (Cloud Mode)

**Symptom:** "Connection refused" or timeout errors

**Checks:**
- Verify URL format: `https://cluster.cloud.qdrant.io:6333` (must include `:6333`)
- Test connectivity: `curl -H "api-key: YOUR_KEY" https://your-url:6333/health`
- Check API key is valid in Qdrant Cloud dashboard
- Ensure cluster is running (not paused)

### Connection Issues (Local Mode)

**Symptom:** "Permission denied" or "Directory not found"

**Checks:**
```bash
# Verify directory exists
ls -la /workspaces/.qdrant/storage

# Check ownership
ls -ld /workspaces/.qdrant/storage
# Should show: drwxr-xr-x ... vscode vscode ...

# Fix permissions if needed
sudo chown -R vscode:vscode /workspaces/.qdrant/storage
```

### Embedding Model Issues

**Symptom:** "Model not found" or slow first run

**Explanation:**
- First use downloads model (~200MB-2GB) to `~/.cache/fastembed/`
- Subsequent uses are fast (model cached)
- Ensure sufficient disk space

**Check cache:**
```bash
du -sh ~/.cache/fastembed/
ls ~/.cache/fastembed/
```

### Permission Errors

**Symptom:** "Permission denied" when accessing config files

**Solution:**
```bash
# Check who owns the config
ls -la ~/.config/mcp/qdrant-config.json

# Fix if needed (replace 'vscode' with your username)
sudo chown -R vscode:vscode ~/.config/mcp/
```

## Security Best Practices

### Protecting API Keys

**✅ DO:**
```json
{
  "features": {
    "ghcr.io/yourorg/features/mcp-qdrant:1": {
      "qdrantApiKey": "${env:QDRANT_API_KEY}"
    }
  }
}
```

Store in `.env` file:
```bash
# .env (add to .gitignore!)
QDRANT_API_KEY=your-key-here
```

**❌ DON'T:**
```json
{
  "features": {
    "ghcr.io/yourorg/features/mcp-qdrant:1": {
      "qdrantApiKey": "actual-key-in-plain-text"  // DON'T DO THIS
    }
  }
}
```

### Environment File Security

The generated environment file `/workspaces/.qdrant-mcp.env` contains your API key in plain text. It is automatically protected with secure permissions:

```bash
# Verify permissions (should be 600 - readable only by owner)
ls -l /workspaces/.qdrant-mcp.env
# Should show: -rw------- (600)

# Never commit this file to version control
echo ".qdrant-mcp.env" >> .gitignore
```

### Qdrant Cloud Best Practices

1. **Use read-only keys** for agents that only need to query
2. **Create separate keys** for different agents/projects
3. **Rotate keys regularly** via Qdrant Cloud dashboard
4. **Monitor usage** to detect unauthorized access
5. **Use IP restrictions** if available in your Qdrant plan

### Local Mode Security

Local mode doesn't use API keys, but be aware:
- Data stored in plain text in `qdrantLocalPath`
- No encryption at rest
- Anyone with container access can read data
- Use cloud mode with encryption for sensitive data

## Resources

- [Qdrant MCP Server GitHub](https://github.com/qdrant/mcp-server-qdrant)
- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [Qdrant Cloud](https://cloud.qdrant.io)
- [FastEmbed Models](https://qdrant.github.io/fastembed/)
- [Model Context Protocol](https://modelcontextprotocol.io)

## Contributing

Issues and pull requests welcome at the feature repository.

## License

MIT License - See repository for details.

---

**Part of CodeForge** - Curated DevContainer Features for AI Coding Agents
