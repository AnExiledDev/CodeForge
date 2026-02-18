# auto-formatter

Claude Code plugin that batch-formats edited files when Claude finishes responding. Reads file paths collected by the `code-directive` plugin's `collect-edited-files.py` hook and formats each file based on its extension.

## What It Does

When Claude stops responding, the plugin reads the session's list of edited files and formats each one using the appropriate tool:

| Language / File Type | Formatter | Fallback |
|----------------------|-----------|----------|
| Python (`.py`, `.pyi`) | [ruff format](https://docs.astral.sh/ruff/) | [black](https://github.com/psf/black) |
| Go (`.go`) | gofmt (bundled with Go) | — |
| JS/TS/CSS/JSON/GraphQL/HTML (`.js`, `.jsx`, `.ts`, `.tsx`, `.css`, `.json`, `.jsonc`, `.graphql`, `.gql`, `.html`, `.vue`, `.svelte`, `.astro`) | [biome](https://biomejs.dev/) check --write | — |
| Shell (`.sh`, `.bash`, `.zsh`, `.mksh`, `.bats`) | [shfmt](https://github.com/mvdan/sh) | — |
| Markdown/YAML/TOML (`.md`, `.markdown`, `.yaml`, `.yml`, `.toml`) | [dprint](https://dprint.dev/) | — |
| Dockerfile | dprint | — |
| Rust (`.rs`) | rustfmt (bundled with Rust) | — |

All formatting is non-blocking. Missing tools are silently skipped. The plugin always exits 0 — it will never interrupt Claude.

## How It Works

### Hook Lifecycle

```
code-directive's collect-edited-files.py (PostToolUse on Edit/Write)
  │
  └─→ Appends edited file path to /tmp/claude-edited-files-{session_id}
       │
       │  ... Claude keeps working ...
       │
Claude stops responding (Stop event)
  │
  └─→ format-on-stop.py reads the temp file, deduplicates paths,
      formats each file by extension, then cleans up the temp file
```

### Dependency on code-directive

This plugin does **not** collect file paths itself. It relies on the `code-directive` plugin's `collect-edited-files.py` PostToolUse hook to write edited file paths to `/tmp/claude-edited-files-{session_id}`. Both plugins must be enabled for formatting to work.

### Biome Discovery

Biome is resolved in this order:
1. **Project-local**: walks up from the edited file looking for `node_modules/.bin/biome`
2. **Global**: checks PATH via `which biome`

### dprint Configuration

The dprint formatter looks for a config file at `/usr/local/share/dprint/dprint.json`. If this file doesn't exist, dprint formatting is skipped.

### Timeouts

| Scope | Timeout |
|-------|---------|
| Entire Stop hook | 15s |
| Individual tool invocation | 10-12s |

## Conflict Warning

Do **not** enable this plugin alongside `auto-code-quality`. That plugin bundles its own formatter with the same functionality. Enabling both won't corrupt data (different temp file prefixes: `claude-edited-files-*` vs `claude-cq-*`), but files would be formatted twice.

## Plugin Structure

```
auto-formatter/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata
├── hooks/
│   └── hooks.json           # Stop hook registration
├── scripts/
│   └── format-on-stop.py    # Batch formatter (Stop)
└── README.md                # This file
```

## Requirements

- Python 3.11+
- Claude Code with plugin hook support
- `code-directive` plugin enabled (provides the file path collector)
- Install the formatting tools for the languages you work with — everything is optional
