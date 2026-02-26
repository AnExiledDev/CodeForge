# CodeForge DevContainer

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![npm version](https://img.shields.io/npm/v/codeforge-dev.svg)](https://www.npmjs.com/package/codeforge-dev)
[![Changelog](https://img.shields.io/badge/changelog-view-blue)](.devcontainer/CHANGELOG.md)
[![GitHub last commit](https://img.shields.io/github/last-commit/AnExiledDev/CodeForge)](https://github.com/AnExiledDev/CodeForge/commits)
[![npm downloads](https://img.shields.io/npm/dm/codeforge-dev)](https://www.npmjs.com/package/codeforge-dev)
[![Node.js](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)](https://nodejs.org/)
[![GitHub issues](https://img.shields.io/github/issues/AnExiledDev/CodeForge)](https://github.com/AnExiledDev/CodeForge/issues)
[![CI](https://github.com/AnExiledDev/CodeForge/actions/workflows/ci.yml/badge.svg)](https://github.com/AnExiledDev/CodeForge/actions/workflows/ci.yml)

A curated development environment optimized for AI-powered coding with Claude Code. CodeForge comes pre-configured with language servers, code intelligence tools, and official Anthropic plugins to streamline your development workflow.

## Why CodeForge?

Claude Code is powerful out of the box, but getting the most from it takes significant configuration — custom agents, safety plugins, code quality hooks, system prompts, and development tools that aren't obvious from the docs. CodeForge is a Claude Code power user's personal development environment, packaged so anyone can use it.

Instead of spending hours discovering and configuring advanced features like built-in agent replacement, automated code quality pipelines, or spec-driven workflows, you get a production-tested setup in one command. It's opinionated by design — every default reflects real daily use, not theoretical best practices.

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
- **A DevContainer client** — any of:
  - **VS Code** with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
  - **DevContainer CLI** — `npm install -g @devcontainers/cli` ([docs](https://containers.dev/supporting#devcontainer-cli))
  - **GitHub Codespaces** — zero local setup
  - **JetBrains Gateway** with [Dev Containers plugin](https://plugins.jetbrains.com/plugin/21962-dev-containers)
  - **DevPod** — open-source, editor-agnostic ([devpod.sh](https://devpod.sh/))
- **Claude Code authentication** — run `claude` on first start to authenticate

## What's Included

### Languages & Runtimes

Python 3.14, Node.js LTS, TypeScript, Rust, Bun, Go (optional)

### Package Managers

`uv`, `npm`, `bun`, `pip` / `pipx`

### Development Tools

`gh` (GitHub CLI), `docker`, `git`, `jq`, `curl`, `tmux`, `biome`, `ruff`, `ccms`, `agent-browser`

### Code Intelligence

tree-sitter (JS/TS/Python), ast-grep, Pyright, TypeScript LSP

### Claude Code Tools

`claude`, `cc` (wrapper), `ccw` (writing mode wrapper), `ccusage`, `ccburn`, `ccstatusline`, `claude-monitor`

### Custom Features (21)

tmux, agent-browser, claude-monitor, ccusage, ccburn, ccstatusline, ast-grep, tree-sitter, lsp-servers, biome, ruff, shfmt, shellcheck, hadolint, dprint, ccms, notify-hook, mcp-qdrant, chromaterm, kitty-terminfo, claude-session-dashboard

### Agents (17) & Skills (35)

The `agent-system` plugin includes 17 specialized agents (architect, explorer, test-writer, security-auditor, etc.). The `skill-engine` plugin provides 22 general coding skills, `spec-workflow` adds 8 spec lifecycle skills, and `ticket-workflow` provides 4 ticket management skills.

## Architecture

CodeForge operates in three layers, each building on the one below:

```
┌──────────────────────────────────────────────┐
│                 Claude Code                   │
│   AI assistant, tool execution, Agent Teams   │
├──────────────────────────────────────────────┤
│               CodeForge Layer                 │
│   Plugins · Agents · Skills · Hooks · Rules   │
├──────────────────────────────────────────────┤
│                DevContainer                   │
│   Runtimes · CLI Tools · LSP Servers          │
└──────────────────────────────────────────────┘
```

**DevContainer** — The foundation. A Python 3.14 container with Node.js, Rust, and Bun runtimes, plus 22 custom features that install development tools (ast-grep, tree-sitter, biome, ruff, and others).

**CodeForge Layer** — The intelligence. 13 plugins register hooks that validate commands, inject context, and enforce safety. 17 agents provide specialized personas. 35 skills offer on-demand reference material. System prompts and rules shape behavior.

**Claude Code** — The AI assistant, executing tools and coordinating work. CodeForge enhances it through configuration — replacing built-in subagents, adding safety guardrails, and wiring up quality checks that run automatically.

For the full architecture breakdown — hook pipeline, agent routing, skill loading, and design principles — see the [Architecture Reference](https://anexileddev.github.io/CodeForge/reference/architecture/).

## Configuration

All configuration lives in `.devcontainer/` and deploys automatically on container start. Key files:

| File | What It Configures | User-Modifiable? |
|------|--------------------|------------------|
| `config/defaults/settings.json` | Model, plugins, permissions, environment variables | Yes |
| `config/defaults/main-system-prompt.md` | Claude's behavioral guidelines and directives | Yes |
| `config/defaults/keybindings.json` | Keyboard shortcuts | Yes |
| `config/defaults/ccstatusline-settings.json` | Terminal status bar widgets and layout | Yes |
| `config/file-manifest.json` | Which config files deploy and how they update | Yes |
| `devcontainer.json` | Container image, features, runtimes, ports | Yes |
| `.env` | Setup phase toggles (auth, plugins, aliases, etc.) | Yes |

Config files use SHA-256 change detection — your edits persist across container rebuilds unless the source changes. Set a file's overwrite mode to `"never"` in `file-manifest.json` to permanently preserve your customizations.

For the complete configuration guide, see the [documentation site](https://anexileddev.github.io/CodeForge/customization/configuration/).

## Quick Start

1. **Install**: `npx codeforge-dev`
2. **Open in Container**:
   - **VS Code**: "Reopen in Container" from the Command Palette
   - **CLI**: `devcontainer up --workspace-folder .` then `docker exec -it <container> zsh`
   - **Codespaces**: Create a Codespace from the repo
3. **Authenticate**: Run `claude` and follow prompts
4. **Start coding**: Run `cc`

CodeForge uses the open [Dev Containers specification](https://containers.dev/) — any compatible client works. For full usage documentation — authentication, configuration, tools, agents, and keybindings — see [`.devcontainer/README.md`](.devcontainer/README.md).

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md)
before submitting a pull request. All contributions require signing our
[Contributor License Agreement](CLA.md).

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE.txt).

**Commercial licensing** is available for organizations that need to use CodeForge
without GPL-3.0 obligations. Contact
[696222+AnExiledDev@users.noreply.github.com](mailto:696222+AnExiledDev@users.noreply.github.com)
or [open a GitHub issue](https://github.com/AnExiledDev/CodeForge/issues/new)
for terms.

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

## Changelog

See [CHANGELOG.md](.devcontainer/CHANGELOG.md) for release history. Current version: **1.14.0** (2026-02-23).

## Further Reading

- [Full Usage Guide](.devcontainer/README.md)
- [Changelog](.devcontainer/CHANGELOG.md)
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Dev Containers Specification](https://containers.dev/)
- [GitHub CLI Manual](https://cli.github.com/manual/)
