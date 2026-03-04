# LSP Servers for Claude Code

**Installs language server binaries for Python and TypeScript to enable Claude Code's code intelligence features.**

This feature installs the LSP server binaries that Claude Code's code-intelligence plugins require. The binaries must be in `$PATH` for the plugins to function.

## What Gets Installed

| Language | Binary | Package |
|----------|--------|---------|
| Python | `pyright-langserver` | `pyright` |
| TypeScript | `typescript-language-server` | `typescript-language-server` + `typescript` |

## Usage

Add to your `devcontainer.json`:

```json
{
  "features": {
    "ghcr.io/devcontainers/features/node:1": {},
    "./features/lsp-servers": {}
  }
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pyrightVersion` | string | `"latest"` | Pyright package version |
| `typescriptLspVersion` | string | `"latest"` | typescript-language-server version |
| `typescriptVersion` | string | `"latest"` | TypeScript package version |
| `username` | string | `"automatic"` | Container user for fallback install |

## Example with Pinned Versions

```json
{
  "features": {
    "./features/lsp-servers": {
      "pyrightVersion": "1.1.350",
      "typescriptLspVersion": "4.3.0",
      "typescriptVersion": "5.3.0"
    }
  }
}
```

## Prerequisites

- Node.js feature must be installed first (provides npm)

## Claude Code Plugin Installation

After the container builds, install the Claude Code LSP plugins:

```bash
claude plugin install pyright-lsp@claude-plugins-official
claude plugin install typescript-lsp@claude-plugins-official
```

Or use the `setup-lsp.sh` script which handles this automatically.

## Verification

Check that binaries are available:

```bash
pyright-langserver --version
typescript-language-server --version
```

Check Claude Code plugin status:

```bash
/plugin
# Navigate to Errors tab - should show no "Executable not found" errors
```

## See Also

- [Claude Code: Discover Plugins](https://code.claude.com/docs/en/discover-plugins#code-intelligence)
- [Pyright](https://github.com/microsoft/pyright)
- [TypeScript Language Server](https://github.com/typescript-language-server/typescript-language-server)
