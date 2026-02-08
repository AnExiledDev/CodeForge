# CodeForge DevContainer

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![npm version](https://img.shields.io/npm/v/codeforge-dev.svg)](https://www.npmjs.com/package/codeforge-dev)

A curated development environment optimized for AI-powered coding with Claude Code. CodeForge comes pre-configured with language servers, code intelligence tools, and official Anthropic plugins to streamline your development workflow.

## Installation

Add CodeForge to any project:

```bash
npx codeforge-dev
```

This copies the `.devcontainer/` directory to your project. Then open in VS Code and select "Reopen in Container".

### Options

```bash
npx codeforge-dev --force    # Overwrite existing .devcontainer directory
npx codeforge-dev -f         # Short form
```

### Alternative Install Methods

```bash
# Install globally
npm install -g codeforge-dev
codeforge-dev

# Run specific version
npx codeforge-dev@1.2.3
```

## Prerequisites

- **Docker Desktop** (or compatible container runtime like Podman)
- **VS Code** with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers), or **GitHub Codespaces**
- **Claude Code authentication** — run `claude` on first start to authenticate

## What's Included

### Languages & Runtimes

Python 3.14, Node.js LTS, TypeScript, Go

### Package Managers

`uv`, `npm`, `pip` / `pipx`

### Development Tools

`gh` (GitHub CLI), `docker`, `git`, `jq`, `curl`, `tmux`, `biome`, `agent-browser`

### Code Intelligence

tree-sitter (JS/TS/Python), ast-grep, Pyright, TypeScript LSP

### Claude Code Tools

`claude`, `cc` (wrapper), `ccusage`, `ccburn`, `ccstatusline`, `claude-monitor`

### Custom Features (14)

tmux, agent-browser, claude-monitor, ccusage, ccburn, ccstatusline, ast-grep, tree-sitter, lsp-servers, biome, notify-hook, mcp-qdrant, mcp-reasoner, splitrail

### Agents (17) & Skills (16)

The `code-directive` plugin includes specialized agents (architect, explorer, test-writer, security-auditor, etc.) and domain-specific coding reference skills (fastapi, svelte5, docker, testing, etc.).

## Quick Start

1. **Install**: `npx codeforge-dev`
2. **Open in Container**: "Reopen in Container" in VS Code, or create a Codespace
3. **Authenticate**: Run `claude` and follow prompts
4. **Start coding**: Run `cc`

For full usage documentation — authentication, configuration, tools, agents, and keybindings — see [`.devcontainer/README.md`](.devcontainer/README.md).

## Development

### Testing Locally

```bash
git clone https://github.com/AnExiledDev/CodeForge.git
cd CodeForge
npm test
```

### Publishing

```bash
# Bump version in package.json, then:
npm publish
```

## Further Reading

- [Full Usage Guide](.devcontainer/README.md)
- [Changelog](.devcontainer/CHANGELOG.md)
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Dev Containers Specification](https://containers.dev/)
- [GitHub CLI Manual](https://cli.github.com/manual/)
