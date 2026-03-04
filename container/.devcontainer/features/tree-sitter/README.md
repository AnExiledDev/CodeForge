# Tree-sitter Parser Feature

Installs [tree-sitter](https://tree-sitter.github.io/tree-sitter/) parsing library with Node.js and Python bindings.

## Usage

```json
{
  "features": {
    "./features/tree-sitter": {}
  }
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `version` | string | `latest` | tree-sitter version (e.g., `0.24.4`) |
| `bindings` | enum | `both` | Language bindings: `node`, `python`, `both`, `none` |
| `installCli` | boolean | `true` | Install tree-sitter CLI tool (requires Node.js) |
| `grammars` | string | `javascript,typescript,python` | Comma-separated grammars to preload |
| `username` | string | `automatic` | Container user to install for |

## Examples

### Default (CLI + Node + Python + JS/TS/Python grammars)

```json
{
  "features": {
    "./features/tree-sitter": {}
  }
}
```

### With Additional Grammars

```json
{
  "features": {
    "./features/tree-sitter": {
      "grammars": "javascript,typescript,python,rust,json"
    }
  }
}
```

### Node.js Only

```json
{
  "features": {
    "./features/tree-sitter": {
      "bindings": "node",
      "grammars": "javascript,typescript"
    }
  }
}
```

### Python Only (No CLI)

```json
{
  "features": {
    "./features/tree-sitter": {
      "bindings": "python",
      "installCli": false,
      "grammars": "python"
    }
  }
}
```

## Installed Components

### CLI (`installCli: true`)

- `tree-sitter` CLI installed via npm ([tree-sitter-cli](https://www.npmjs.com/package/tree-sitter-cli))
- Requires Node.js to be installed

### Node.js Bindings (`bindings: "node"` or `"both"`)

- `web-tree-sitter` - WebAssembly-based tree-sitter for Node.js
- Grammar packages as `tree-sitter-{language}`

### Python Bindings (`bindings: "python"` or `"both"`)

- `tree-sitter` - Python bindings package
- Grammar packages as `tree-sitter-{language}`

## Available Grammars

Common grammars available via npm/pip:

- `javascript`, `typescript`, `tsx`
- `python`, `rust`, `c`, `cpp`
- `java`, `ruby`, `php`, `swift`
- `json`, `yaml`, `toml`, `html`, `css`
- `bash`, `markdown`, `regex`

## Dependencies

This feature requires:

- **Node.js** (via `ghcr.io/devcontainers/features/node:1`) - required for CLI and Node bindings
- **Python** (via `ghcr.io/devcontainers/features/python:1`) - for Python bindings only

## Quick Start

### Node.js

```javascript
const Parser = require('web-tree-sitter');

await Parser.init();
const parser = new Parser();

const JavaScript = await Parser.Language.load('path/to/tree-sitter-javascript.wasm');
parser.setLanguage(JavaScript);

const tree = parser.parse('const x = 1;');
console.log(tree.rootNode.toString());
```

### Python

```python
import tree_sitter_python as tspython
from tree_sitter import Language, Parser

PY_LANGUAGE = Language(tspython.language())
parser = Parser(PY_LANGUAGE)

tree = parser.parse(b"def hello(): pass")
print(tree.root_node.sexp())
```
