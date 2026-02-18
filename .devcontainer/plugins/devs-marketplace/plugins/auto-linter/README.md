# auto-linter

Claude Code plugin that batch-lints edited files when Claude finishes responding. Reads file paths collected by the `code-directive` plugin's `collect-edited-files.py` hook and lints each file using the appropriate tool. Lint results are returned as advisory context — never blocking.

## What It Does

When Claude stops responding, the plugin reads the session's list of edited files, lints each one, and injects any warnings as `additionalContext` so Claude sees them on its next response.

| Language / File Type | Linter(s) |
|----------------------|-----------|
| Python (`.py`, `.pyi`) | [pyright](https://github.com/microsoft/pyright) (type checking) + [ruff check](https://docs.astral.sh/ruff/) (style/correctness) |
| JS/TS/CSS/GraphQL (`.js`, `.jsx`, `.ts`, `.tsx`, `.css`, `.graphql`, `.gql`) | [biome lint](https://biomejs.dev/) |
| Shell (`.sh`, `.bash`, `.zsh`, `.mksh`, `.bats`) | [shellcheck](https://github.com/koalaman/shellcheck) |
| Go (`.go`) | go vet (bundled with Go) |
| Dockerfile | [hadolint](https://github.com/hadolint/hadolint) |
| Rust (`.rs`) | [clippy](https://doc.rust-lang.org/clippy/) (via cargo) |

All linting is non-blocking. Missing tools are silently skipped. The plugin always exits 0 and returns warnings as `additionalContext` — it will never interrupt Claude.

## How It Works

### Hook Lifecycle

```
code-directive's collect-edited-files.py (PostToolUse on Edit/Write)
  │
  └─→ Appends edited file path to /tmp/claude-lint-files-{session_id}
       │
       │  ... Claude keeps working ...
       │
Claude stops responding (Stop event)
  │
  └─→ lint-file.py reads the temp file, deduplicates paths,
      lints each file by extension, groups results by linter,
      injects warnings as additionalContext, then cleans up
```

### Dependency on code-directive

This plugin relies on the `code-directive` plugin's `collect-edited-files.py` PostToolUse hook to write edited file paths to `/tmp/claude-lint-files-{session_id}`. Both plugins must be enabled for linting to work.

### Output Format

Lint results are grouped by linter and returned as `additionalContext`. Each file shows up to 5 issues with severity, line number, and message:

```
[Auto-linter] Pyright results:
  example.py: 2 issue(s)
  ✗ Line 15: Cannot assign type "str" to declared type "int"
  ! Line 42: Variable "x" is not defined

[Auto-linter] Ruff results:
  example.py: 1 issue(s)
  ! Line 8: [F401] `os` imported but unused
```

### Biome Discovery

Biome is resolved in this order:
1. **Project-local**: walks up from the edited file looking for `node_modules/.bin/biome`
2. **Global**: checks PATH via `which biome`

### Timeouts

| Scope | Timeout |
|-------|---------|
| Entire Stop hook | 60s |
| Individual tool invocation | 10s |

## Conflict Warning

Do **not** enable this plugin alongside `auto-code-quality`. That plugin bundles its own linter with the same functionality. Enabling both won't corrupt data (different temp file prefixes: `claude-lint-files-*` vs `claude-cq-*`), but files would be linted twice.

## Plugin Structure

```
auto-linter/
├── .claude-plugin/
│   └── plugin.json        # Plugin metadata
├── hooks/
│   └── hooks.json         # Stop hook registration
├── scripts/
│   └── lint-file.py       # Batch linter (Stop)
└── README.md              # This file
```

## Requirements

- Python 3.11+
- Claude Code with plugin hook support
- `code-directive` plugin enabled (provides the file path collector)
- Install the linting tools for the languages you work with — everything is optional
