# auto-code-quality

Claude Code plugin that tracks edited files and runs code quality checks on demand via the `/cq` skill. Drop it into any Claude Code plugin marketplace and enable it — no other plugins required.

## What It Does

Three-phase pipeline with an explicit quality gate:

1. **Track** (PostToolUse on Edit/Write) — Records which files Claude edits, validates data file syntax instantly
2. **Activity** (SubagentStart/Stop, PreToolUse/PostToolUse/PostToolUseFailure on Bash) — Tracks active subagents and background bash commands so the gate stays silent during orchestration
3. **Gate** (Stop hook) — Lightweight check: if files were edited and no background work is active, blocks the stop and prompts Claude to run `/cq`
4. **Quality** (`/cq` skill) — Claude formats, lints (with auto-fix), and runs affected tests on all edited files

The `/cq` skill can also be invoked manually at any time during a session.

### Why a skill instead of automatic hooks?

Previous versions ran formatters, linters, and test runners as Stop hooks. This caused issues with background agents (race conditions on file writes), fired too frequently during orchestration pauses, and produced lint results as passive context that was often ignored. The `/cq` skill runs explicitly — Claude can act on results, fix issues, and re-run checks.

## Required Tools

Install the tools for the languages you work with. Everything is optional — the plugin gracefully skips any tool that isn't found.

| Language | Formatter | Linter(s) | Install |
|----------|-----------|-----------|---------|
| Python | [ruff](https://docs.astral.sh/ruff/) | [pyright](https://github.com/microsoft/pyright), ruff check | `pip install ruff` / `npm i -g pyright` |
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

## Usage

### Automatic (quality gate)

Just work normally. When Claude stops after editing files:

1. The quality gate checks for edited files and active background tasks
2. If files were edited and no tasks are running, it blocks the stop
3. Claude runs `/cq` automatically — formats, lints, tests, fixes issues
4. Claude stops cleanly on the second attempt (temp files cleaned up)

### Manual

Type `/cq` at any point to run quality checks on all files edited so far in the session.

### With background work

The quality gate is background-activity-aware. It tracks two types of background work:

- **Subagents** — tracked via SubagentStart/SubagentStop hooks
- **Background bash** — tracked via PreToolUse (when `run_in_background: true`) and PostToolUse/PostToolUseFailure

While any background work is active, the gate stays silent. Once all work completes and Claude stops, the gate activates. Entries older than 30 minutes are automatically pruned as stale (handles crashes/timeouts that prevent cleanup).

## Installation

### CodeForge DevContainer

Pre-installed and activated automatically — no setup needed.

### From GitHub

Use this plugin in any Claude Code setup:

1. Clone the [CodeForge](https://github.com/AnExiledDev/CodeForge) repository:

   ```bash
   git clone https://github.com/AnExiledDev/CodeForge.git
   ```

2. Enable the plugin in your `.claude/settings.json`:

   ```json
   {
     "enabledPlugins": {
       "auto-code-quality@<clone-path>/.devcontainer/plugins/devs-marketplace": true
     }
   }
   ```

   Replace `<clone-path>` with the absolute path to your CodeForge clone.

## How It Works

### Hook Lifecycle

```
You edit a file (Edit/Write tool)
  │
  ├─→ collect-edited-files.py    Appends path to temp files
  └─→ syntax-validator.py        Validates JSON/YAML/TOML syntax immediately

Subagent starts (SubagentStart)
  └─→ activity-tracker.py        Records agent as active

Subagent stops (SubagentStop)
  └─→ activity-tracker.py        Removes agent from active list

Background bash starts (PreToolUse[Bash] with run_in_background: true)
  └─→ activity-tracker.py        Records bash command as active

Background bash ends (PostToolUse[Bash] or PostToolUseFailure[Bash])
  └─→ activity-tracker.py        Removes bash command from active list

Claude stops responding (Stop event)
  └─→ quality-gate.py            Checks active work + edited files
       │
       ├─ Work active?   → skip (exit 0)
       ├─ No edits?      → skip (exit 0)
       └─ Edits found    → block stop → Claude runs /cq
                                → /cq formats, lints, tests
                                → cleans up temp files
                                → Claude stops again → gate exits clean
```

### Temp File Convention

Session-scoped temp files in `/tmp/`:

| File | Purpose | Written by | Read by |
|------|---------|------------|---------|
| `claude-cq-edited-{session_id}` | Edited file paths (format + test) | collect-edited-files.py | quality-gate.py, /cq skill |
| `claude-cq-lint-{session_id}` | Edited file paths (lint) | collect-edited-files.py | /cq skill |
| `claude-active-work-{session_id}` | Active background work (`type:id:timestamp`) | activity-tracker.py | quality-gate.py |

All temp files are cleaned up after processing (by the gate and/or the skill).

### Loop Prevention

The quality gate deletes the edited-files temp file when it blocks. On the second stop (after `/cq` runs), the temp file is gone — the gate exits clean. The `/cq` skill also cleans up temp files as a safety net.

### Timeouts

| Hook | Timeout |
|------|---------|
| File collection | 3s |
| Syntax validation | 5s |
| Task tracking | 3s |
| Quality gate | 3s |

The `/cq` skill has no timeout — it runs as a normal Claude conversation turn.

## Disabling

### Disable the entire plugin

Remove from `enabledPlugins` in your settings.

### Disable individual hooks

Add the script name (without `.py`) to the `disabled` array in `~/.claude/disabled-hooks.json`:

```json
{
  "disabled": ["quality-gate"]
}
```

Available hook names: `collect-edited-files`, `syntax-validator`, `activity-tracker`, `quality-gate`

## Conflict Warning

This plugin bundles functionality that may overlap with other plugins. If you're using any of the following, **disable them** before enabling this plugin to avoid duplicate processing:

- `auto-formatter` — formatting is included in `/cq`
- `auto-linter` — linting is included in `/cq`
- `code-directive` `collect-edited-files.py` hook — file collection is included here

## Plugin Structure

```
auto-code-quality/
├── .claude-plugin/
│   └── plugin.json              # Plugin metadata
├── hooks/
│   └── hooks.json               # Hook registrations
├── scripts/
│   ├── collect-edited-files.py  # File path collector (PostToolUse)
│   ├── syntax-validator.py      # JSON/YAML/TOML validator (PostToolUse)
│   ├── activity-tracker.py      # Background work tracker (SubagentStart/Stop, Bash Pre/Post/Failure)
│   └── quality-gate.py          # Stop gate — prompts /cq if needed (Stop)
├── skills/
│   └── cq/
│       └── SKILL.md             # /cq skill definition
└── README.md                    # This file
```

## Requirements

- Python 3.11+ (for `tomllib` support in syntax validation; older Python skips TOML)
- Claude Code with plugin hook support and skill support
