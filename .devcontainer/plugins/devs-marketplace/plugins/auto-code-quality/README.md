# auto-code-quality

Self-contained Claude Code plugin that automatically formats and lints edited files. Drop it into any Claude Code plugin marketplace and enable it — no other plugins required.

## What It Does

Three-phase pipeline that runs transparently during your Claude Code session:

1. **Collect** (PostToolUse on Edit/Write) — Records which files Claude edits
2. **Format** (Stop hook) — Batch-formats all edited files when Claude finishes responding
3. **Lint** (Stop hook) — Batch-lints all edited files and surfaces warnings as context

Additionally validates JSON, JSONC, YAML, and TOML syntax immediately after each edit.

All phases are non-blocking. Missing tools are silently skipped. The plugin always exits cleanly — it will never interrupt Claude.

## Required Tools

Install the tools for the languages you work with. Everything is optional — the plugin gracefully skips any tool that isn't found.

| Language | Formatter | Linter(s) | Install |
|----------|-----------|-----------|---------|
| Python | [ruff](https://docs.astral.sh/ruff/) | [pyright](https://github.com/microsoft/pyright), ruff check | `pip install ruff` / `npm i -g pyright` |
| Python (fallback) | [black](https://github.com/psf/black) | — | `pip install black` |
| Go | gofmt (bundled with Go) | go vet (bundled with Go) | [Install Go](https://go.dev/dl/) |
| JS/TS/CSS/GraphQL/HTML | [biome](https://biomejs.dev/) | biome lint | `npm i -D @biomejs/biome` or `npm i -g @biomejs/biome` |
| Shell | [shfmt](https://github.com/mvdan/sh) | [shellcheck](https://github.com/koalaman/shellcheck) | `brew install shfmt shellcheck` |
| Markdown/YAML/TOML | [dprint](https://dprint.dev/) | — | `brew install dprint` |
| Dockerfile | dprint | [hadolint](https://github.com/hadolint/hadolint) | `brew install hadolint` |
| Rust | rustfmt (bundled with Rust) | clippy (bundled with Rust) | [Install Rust](https://rustup.rs/) |
| JSON/JSONC/YAML/TOML | — | syntax-validator (Python stdlib) | No extra install needed |

### dprint Configuration

The dprint formatter looks for a config file at `/usr/local/share/dprint/dprint.json`. If this file doesn't exist, dprint formatting is skipped. Create one with your preferred settings, or use a minimal config:

```json
{
  "markdown": {},
  "toml": {},
  "yaml": {}
}
```

### Biome Discovery

Biome is resolved in this order:
1. Project-local: walks up from the edited file looking for `node_modules/.bin/biome`
2. Global: checks PATH via `which biome`

## Installation

### 1. Place the plugin

Copy the `auto-code-quality/` directory into your Claude Code plugin marketplace:

```
your-marketplace/
├── .claude-plugin/
│   └── marketplace.json
└── plugins/
    └── auto-code-quality/    ← this directory
```

### 2. Register in marketplace.json

Add this entry to your `marketplace.json` `plugins` array:

```json
{
  "name": "auto-code-quality",
  "description": "Self-contained code quality: auto-format + auto-lint edited files",
  "version": "1.0.0",
  "source": "./plugins/auto-code-quality",
  "category": "development"
}
```

### 3. Enable in settings.json

Add to your Claude Code `settings.json` under `enabledPlugins`:

```json
{
  "enabledPlugins": {
    "auto-code-quality@your-marketplace": true
  }
}
```

Replace `your-marketplace` with the name of your marketplace.

## How It Works

### Hook Lifecycle

```
You edit a file (Edit/Write tool)
  │
  ├─→ collect-edited-files.py    Appends path to temp files
  └─→ syntax-validator.py        Validates JSON/YAML/TOML syntax immediately
       │
       │  ... Claude keeps working ...
       │
Claude stops responding (Stop event)
  │
  ├─→ format-on-stop.py          Reads temp file, formats each file by extension
  └─→ lint-file.py               Reads temp file, lints each file, injects warnings
```

### Temp File Convention

Edited file paths are stored in session-scoped temp files:
- `/tmp/claude-cq-edited-{session_id}` — consumed by the formatter
- `/tmp/claude-cq-lint-{session_id}` — consumed by the linter

Both are always cleaned up after processing (even on error).

### Timeouts

| Hook | Timeout |
|------|---------|
| File collection | 3s |
| Syntax validation | 5s |
| Batch formatting | 15s total |
| Batch linting | 60s total |
| Individual tool | 10-12s each |

## Conflict Warning

This plugin bundles functionality that may overlap with other plugins. If you're using any of the following, **disable them** before enabling this plugin to avoid duplicate processing:

- `auto-formatter` — formatting is included here
- `auto-linter` — linting is included here
- `code-directive` `collect-edited-files.py` hook — file collection is included here

The temp file prefixes are different (`claude-cq-*` vs `claude-edited-files-*` / `claude-lint-files-*`), so enabling both won't corrupt data — but files would be formatted and linted twice.

## Plugin Structure

```
auto-code-quality/
├── .claude-plugin/
│   └── plugin.json              # Plugin metadata
├── hooks/
│   └── hooks.json               # Hook registrations (PostToolUse + Stop)
├── scripts/
│   ├── collect-edited-files.py  # File path collector (PostToolUse)
│   ├── syntax-validator.py      # JSON/YAML/TOML validator (PostToolUse)
│   ├── format-on-stop.py        # Batch formatter (Stop)
│   └── lint-file.py             # Batch linter (Stop)
└── README.md                    # This file
```

## Requirements

- Python 3.11+ (for `tomllib` support in syntax validation; older Python skips TOML)
- Claude Code with plugin hook support
