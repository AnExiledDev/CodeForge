# CodeForge DevContainer Features

This directory contains DevContainer Features for AI coding agent environments. These features follow the [DevContainer Features specification](https://containers.dev/implementors/features/) and can be published to OCI registries for distribution.

## Available Features

| Feature | Description | Status |
|---------|-------------|--------|
| `tmux` | Terminal multiplexer with Catppuccin theme for Agent Teams | ✅ |
| `agent-browser` | Headless browser automation for AI agents | ✅ |
| `claude-monitor` | Real-time token usage monitoring | ✅ |
| `ccusage` | Token usage analytics CLI | ✅ |
| `ccburn` | Visual token burn rate tracker with pace indicators | ✅ |
| `ccstatusline` | 6-line powerline status display (v1.1.0) | ✅ |
| `ast-grep` | Structural code search using AST patterns | ✅ |
| `tree-sitter` | Parser with JS/TS/Python grammars | ✅ |
| `lsp-servers` | Pyright and TypeScript language servers | ✅ |
| `biome` | Fast JS/TS/JSON/CSS formatter | ✅ |
| `ruff` | Fast Python linter and formatter | ✅ |
| `shfmt` | Shell script formatter | ✅ (disabled by default) |
| `shellcheck` | Static analysis for shell scripts | ✅ (disabled by default) |
| `hadolint` | Dockerfile linter | ✅ (disabled by default) |
| `dprint` | Pluggable formatter for Markdown/YAML/TOML | ✅ (disabled by default) |
| `ccms` | Claude Code session history search | ✅ |
| `notify-hook` | Desktop notifications on Claude completion | ✅ |
| `mcp-qdrant` | Qdrant vector database MCP server | ✅ (optional) |
| `claude-code` | Fallback config for Anthropic's official Claude Code feature | ✅ (config only) |

> **Note**: Claude Code itself is installed via `ghcr.io/anthropics/devcontainer-features/claude-code:1` (Anthropic's official feature). The local `claude-code/` directory provides only fallback configuration.

## Feature Structure

Each feature follows this structure:

```
feature-name/
├── devcontainer-feature.json   # Feature metadata and options
├── install.sh                  # Installation script (executable)
└── README.md                   # Feature documentation
```

## Development Workflow

### Creating a New Feature

1. **Create directory**: `mkdir features/feature-name`
2. **Add metadata**: Create `devcontainer-feature.json`
3. **Write installer**: Create `install.sh` (make executable)
4. **Document**: Create `README.md`
5. **Test locally**: Reference in devcontainer.json

### Local Testing

To test a feature locally before publishing:

```json
{
  "features": {
    "./features/feature-name": {
      "option1": "value1"
    }
  }
}
```

### Publishing Features

Features will be published to GitHub Container Registry (GHCR):

```
ghcr.io/yourorg/codeforge-features/feature-name:1
```

**Publishing workflow** (future):
- Push to main branch
- GitHub Actions builds and publishes
- Tags create versioned releases

## Feature Guidelines

### Granularity
- **One feature = One tool/service**
- Bundle only if tools are always used together
- See project README for guidance

### Options
- Use clear, descriptive option names
- Provide sensible defaults
- Support environment variable substitution: `"${env:VAR}"`
- Document all options in README

### Installation
- Must be idempotent (safe to run multiple times)
- Check if already installed before installing
- Use appropriate user (not always root)
- Clean up on failure

### Configuration
- Generate necessary config files
- Provide helper scripts for manual setup
- Print clear installation summary
- Show next steps to user

## Migration from Modules

CodeForge modules have been converted to DevContainer Features:

| Old Module | New Feature | Status |
|-----------|-------------|---------|
| mcp_qdrant | mcp-qdrant | ✅ Complete |

## Resources

- [DevContainer Features Specification](https://containers.dev/implementors/features/)
- [Feature Authoring Guide](https://containers.dev/guide/author-a-feature)
- [Feature Best Practices](https://containers.dev/guide/feature-authoring-best-practices)
- [CodeForge Documentation](../../README.md)

## Contributing

Features are part of the CodeForge project. See main repository for contribution guidelines.

---

**Status**: Active Development
**Last Updated**: 2026-02-08
