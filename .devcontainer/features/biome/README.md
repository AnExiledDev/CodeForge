# Biome

Fast JavaScript/TypeScript/JSON/CSS formatter and linter.

## What It Does

Installs [Biome](https://biomejs.dev/) globally via npm. Biome is an all-in-one toolchain for web projects, replacing ESLint and Prettier for JS/TS/CSS/JSON formatting and linting.

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `version` | `latest` | Biome version to install. Set `"none"` to skip. |

## Usage

```bash
biome format --write src/
biome lint src/
biome check --write src/    # format + lint
```

## Configuration

Biome is used by the `auto-formatter` and `auto-linter` plugins for JS/TS/CSS/JSON/GraphQL/HTML files. No additional configuration required for basic usage.

For project-specific config, create a `biome.json` in your project root. See [Biome docs](https://biomejs.dev/reference/configuration/).
