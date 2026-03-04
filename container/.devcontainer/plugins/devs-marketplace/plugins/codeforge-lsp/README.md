# codeforge-lsp

Purely declarative Claude Code plugin that registers Language Server Protocol (LSP) servers for Python, TypeScript/JavaScript, and Go. No hooks, no scripts — just server definitions in the plugin manifest.

## What It Does

Provides Claude Code with language intelligence (type checking, diagnostics, go-to-definition) by registering three LSP servers:

| Server | Command | Languages | File Extensions |
|--------|---------|-----------|-----------------|
| [Pyright](https://github.com/microsoft/pyright) | `pyright-langserver --stdio` | Python | `.py`, `.pyi` |
| [TypeScript Language Server](https://github.com/typescript-language-server/typescript-language-server) | `typescript-language-server --stdio` | TypeScript, JavaScript | `.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs` |
| [gopls](https://pkg.go.dev/golang.org/x/tools/gopls) | `gopls serve` | Go | `.go`, `.mod`, `.sum` |

Servers activate only if their binary is available on PATH. Missing servers are silently skipped — the plugin never fails on a missing tool.

## How It Works

The plugin uses the `lspServers` field in `plugin.json` to declare server configurations. Claude Code reads this at startup and launches each server whose command binary exists. There is no hook logic or runtime behavior — everything is static configuration.

Each server maps file extensions to language identifiers. When Claude Code opens a file matching a registered extension, it routes it to the corresponding LSP server for diagnostics, completions, and other language features.

## Installation

### CodeForge DevContainer

Pre-installed and activated automatically — no setup needed.

### From GitHub

Use this plugin in any Claude Code setup:

1. Clone the [CodeForge](https://github.com/AnExiledDev/CodeForge) repository:

   ```bash
   git clone https://github.com/AnExiledDev/CodeForge.git
   ```

2. Enable the plugin in your `.claude/settings.json`:

   ```json
   {
     "enabledPlugins": {
       "codeforge-lsp@<clone-path>/.devcontainer/plugins/devs-marketplace": true
     }
   }
   ```

   Replace `<clone-path>` with the absolute path to your CodeForge clone.

## Plugin Structure

```
codeforge-lsp/
├── .claude-plugin/
│   └── plugin.json    # Plugin metadata + LSP server definitions
└── README.md          # This file
```

## Requirements

- Claude Code with LSP plugin support
- Install the language servers you need:

| Server | Install |
|--------|---------|
| Pyright | `npm i -g pyright` |
| TypeScript Language Server | `npm i -g typescript-language-server typescript` |
| gopls | `go install golang.org/x/tools/gopls@latest` |
