# CodeForge Container

The `codeforge-dev` npm package — a complete development container for AI-powered coding with Claude Code.

See `.devcontainer/CLAUDE.md` for full devcontainer documentation.
See the root `CLAUDE.md` for monorepo-wide development rules (branching strategy, testing).

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

All user-customizable configuration files belong in `.codeforge/`. New config files go in `.codeforge/config/`, with a corresponding entry in `.codeforge/file-manifest.json`.
