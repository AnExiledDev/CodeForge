# chromaterm

Terminal output colorizer using regex-based YAML rules.

## What It Does

Installs [ChromaTerm2](https://github.com/rgcr/ChromaTerm2) via `uv tool`. ChromaTerm2 applies regex-based color highlighting to terminal output using configurable YAML rules.

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `version` | `latest` | ChromaTerm2 version to install. Set `"none"` to skip. |
| `username` | `automatic` | Container user to install for |

## Usage

```bash
# Pipe any command through ct for colorized output
some-command | ct

# Use with a custom config
ct --config ~/.chromaterm.yml
```

## Configuration

Create a `~/.chromaterm.yml` file with regex rules:

```yaml
rules:
  - regex: "ERROR|FATAL"
    color: red bold
  - regex: "WARNING|WARN"
    color: yellow
  - regex: "INFO"
    color: green
```

## Prerequisites

Requires `uv` (pre-installed in CodeForge container).
