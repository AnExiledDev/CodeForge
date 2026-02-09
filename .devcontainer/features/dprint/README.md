# dprint

Pluggable code formatter for Markdown, YAML, TOML, and Dockerfile.

## What It Does

Installs [dprint](https://dprint.dev/) with a global config covering Markdown, YAML, TOML, and Dockerfile formatting. Used by the `auto-formatter` plugin for these file types.

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `version` | `0.51.1` | dprint version to install. Set `"latest"` for newest, `"none"` to skip. |
| `username` | `automatic` | Container user to install for. |

## Usage

```bash
dprint fmt                        # format files in current directory
dprint fmt --config /usr/local/share/dprint/dprint.json  # use global config
dprint check                      # check without modifying
```

## Configuration

A global config is installed at `/usr/local/share/dprint/dprint.json` with plugins for Markdown, YAML, TOML, and Dockerfile. For project-specific config, create a `dprint.json` in your project root.

## Checksum Verification

Downloads are verified against SHA256 checksums published with each GitHub release. If checksums can't be fetched, installation proceeds with a warning.
