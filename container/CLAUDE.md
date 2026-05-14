# CodeForge Container

The `@coredirective/cf-container` npm package — a complete development container for AI-powered coding with Claude Code.

Entry: `setup.js` — npm package entry point; installs `.devcontainer/` into a target project, handles fresh install, checksum-based update, and `--reset` modes.

## Key Files

- `setup.js` — CLI installer (~22KB): copyDirectory, checksum-based preserve, mergeManifestEntries, `--force`/`--reset` flags
- `test.js` — TAP-style Node.js tests for setup.js exports (run: `npm test`)
- `.devcontainer/` — full devcontainer definition (features, plugins, scripts, defaults, config)
- `.codeforge/container.json` — project-level overrides: setup flags, identity, timezone, versionLock, plugin blacklist
- `tests/` — pytest suite testing plugin hook scripts directly via importlib

## Subdirectories

- `.devcontainer/` — see `.devcontainer/CLAUDE.md` for full layout
- `.codeforge/` — project-level state/overrides only (not defaults); secrets go in `.codeforge/secrets/`
- `tests/` — pytest tests for devs-marketplace plugin scripts
- `logos/` — branding PNGs (not published to npm via .npmignore)

## Testing

Two independent test suites:
- `npm test` → runs `test.js` (Node/TAP-style, tests setup.js logic)
- `pytest tests/ -v` → tests plugin hook Python scripts via importlib dynamic loading
- `npm run test:all` → runs both

## Container Development Rules

### Changelog

Every change MUST have a corresponding entry in `.devcontainer/CHANGELOG.md`.

- New features, enhancements, fixes, and removals each get their own bullet
- Group related changes under domain headings (`###`) by area (e.g., `### Security`, `### Agent System`, `### Documentation`, `### Configuration`)
- If an unreleased version section doesn't exist, add changes to the current version's section
- Write entries from the user's perspective — what changed, not how it was implemented

### Documentation

All user-facing changes MUST be reflected in documentation:

- **Plugin changes** → update the plugin's `README.md`
- **Feature changes** → update `features/README.md` and the feature's `devcontainer-feature.json` if applicable
- **Config system changes** → update `.devcontainer/CLAUDE.md`
- **New config files in `.codeforge/`** → add entry to `.codeforge/file-manifest.json`
- **Docs site** → update relevant pages in `../docs/` (sibling package in the monorepo)

### User Configuration

Packaged defaults belong in `.devcontainer/defaults/codeforge/`. `.codeforge/` is only for project overrides and state. New config defaults should go under the relevant `claude/`, `codex/`, or `rtk/` subfolder and get a stable `id` in `.devcontainer/defaults/codeforge/file-manifest.json`; project overrides use the same logical path under `.codeforge/`.
