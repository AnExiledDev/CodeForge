# ast-grep (Feature)

Installs [ast-grep](https://ast-grep.github.io/) CLI via npm for structural code search, lint, and rewriting using AST matching.

## Usage

```json
{
  "features": {
    "./features/ast-grep": {}
  }
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `version` | string | `latest` | @ast-grep/cli npm package version |
| `username` | string | `automatic` | Container user to install for |

## Dependencies

Requires Node.js: `ghcr.io/devcontainers/features/node:1`
