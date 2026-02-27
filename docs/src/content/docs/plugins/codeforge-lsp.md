---
title: CodeForge LSP
description: The CodeForge LSP plugin integrates Language Server Protocol servers for enhanced code intelligence during AI-assisted development.
sidebar:
  order: 12
---

The CodeForge LSP plugin gives Claude access to the same code intelligence that powers your IDE -- type checking, go-to-definition, find-references, and more. By connecting Claude to Language Server Protocol servers, it can navigate and understand your codebase with precision rather than relying on text search alone.

## How It Works

This is a purely declarative plugin -- it has no hook scripts and no shell scripts. All configuration lives in `plugin.json`, where it registers LSP server definitions. Claude Code launches each server at startup if its binary is available on PATH. Missing servers are silently skipped, so the plugin never fails on a missing tool.

When Claude opens a file matching a registered extension, the corresponding LSP server provides rich language features for that file.

## Registered Servers

| Server | Command | Languages | File Extensions |
|--------|---------|-----------|-----------------|
| [Pyright](https://github.com/microsoft/pyright) | `pyright-langserver --stdio` | Python | `.py`, `.pyi` |
| [TypeScript Language Server](https://github.com/typescript-language-server/typescript-language-server) | `typescript-language-server --stdio` | TypeScript, JavaScript | `.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs` |
| [gopls](https://pkg.go.dev/golang.org/x/tools/gopls) | `gopls serve` | Go | `.go`, `.mod`, `.sum` |

Each server maps file extensions to language identifiers. For example, `.tsx` files are identified as `typescriptreact`, while `.js` and `.mjs` files are both identified as `javascript`.

## Available LSP Operations

Once a server is running, Claude can use these operations for code navigation and understanding:

| Operation | Description | Use Case |
|-----------|-------------|----------|
| **goToDefinition** | Jump to where a symbol is defined | Following imports, understanding API contracts |
| **findReferences** | Find every usage of a symbol | Impact analysis before refactoring |
| **hover** | Get type info and documentation | Understanding function signatures and types |
| **documentSymbol** | List all symbols in a file | Getting a structural overview of a module |
| **workspaceSymbol** | Search symbols across the project | Finding classes, functions, or types by name |
| **goToImplementation** | Find implementations of interfaces | Understanding polymorphism and abstractions |
| **prepareCallHierarchy** | Get the call hierarchy at a position | Understanding call chains |
| **incomingCalls** | Find all callers of a function | Understanding who depends on a function |
| **outgoingCalls** | Find all functions called from a position | Understanding a function's dependencies |

:::tip[LSP vs Text Search]
Text search (Grep) finds string matches. LSP understands your code semantically -- it knows that `User` in an import statement and `User` in a class definition are the same symbol, and it won't confuse them with `UserProfile` or a variable named `user`. This makes refactoring and impact analysis far more reliable.
:::

## How Agents Use LSP

Different [agent types](./agent-system/) leverage LSP in different ways:

- **Read-only agents** (explorer, researcher, architect) use LSP extensively for `goToDefinition`, `findReferences`, and `workspaceSymbol` to understand codebases without modifying files
- **Implementation agents** (generalist, refactorer, migrator) use LSP for navigation during refactoring and to verify that changes don't break references
- **Analysis agents** (security-auditor, dependency-analyst) use `incomingCalls` and `findReferences` to trace data flow and dependency chains

## Server Activation

Servers activate only when their binary is found on PATH:

| Server | Binary | Pre-installed in CodeForge |
|--------|--------|--------------------------|
| Pyright | `pyright-langserver` | Yes (via `npm i -g pyright`) |
| TypeScript LS | `typescript-language-server` | Yes (via `npm i -g typescript-language-server typescript`) |
| gopls | `gopls` | Yes (via `go install golang.org/x/tools/gopls@latest`) |

If you need LSP for additional languages, you can add server definitions to the plugin's `plugin.json` following the same pattern.

## Adding More Language Servers

You can extend the LSP plugin with additional servers by adding entries to the `lspServers` field in `plugin.json`. Each server definition needs three fields:

```json
{
  "my-server": {
    "command": "my-language-server",
    "args": ["--stdio"],
    "extensionToLanguage": {
      ".ext": "language-id"
    }
  }
}
```

The `command` must be the binary name (resolved via PATH). The `args` array is passed to the command. The `extensionToLanguage` map tells Claude Code which files to route to this server.

:::note[Graceful Degradation]
If a server binary isn't installed, the plugin silently skips it. You can register servers for languages you might use later -- they'll activate automatically when the tool becomes available.
:::

## Plugin Structure

Unlike most CodeForge plugins, the LSP plugin contains no hook scripts or shell scripts -- just declarative configuration:

```
codeforge-lsp/
  .claude-plugin/
    plugin.json    -- Plugin metadata + LSP server definitions
  README.md
```

The `lspServers` field in `plugin.json` is all that's needed. Claude Code reads this at startup and manages server lifecycles automatically.

## Related

- [Code Intelligence](../features/code-intelligence/) -- ast-grep and tree-sitter complement LSP
- [Agent System](./agent-system/) -- agents use LSP for code navigation
- [Tools Reference](../features/tools/) -- CLI tools related to code analysis
