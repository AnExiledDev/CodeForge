# CodeForge CLI (codeforge-cli)

Installs the [CodeForge CLI](https://github.com/AnExiledDev/CodeForge/tree/main/cli) globally via npm. Provides the `codeforge` command for code review, session search, plugin management, and configuration.

Requires Node.js (for npm install) and Bun (runtime for the CLI binary).

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `version` | string | `latest` | Version to install. Use a specific semver or `'none'` to skip. |

## Usage

```jsonc
// devcontainer.json
"features": {
    "./features/codeforge-cli": {}
}
```
