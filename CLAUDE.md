# CodeForge

DevContainer configuration project for AI-assisted development with Claude Code.

See `.devcontainer/CLAUDE.md` for full devcontainer documentation.

## Development Rules

### Branching Strategy

- **`main`** — production/release branch. Only updated via PRs from `staging`.
- **`staging`** — integration branch. All feature/fix branches target `staging` for PRs.
- Feature and fix branches should be created from `staging` and PRed back to `staging`.
- PRs from `staging` to `main` are used for releases.

### Changelog

Every change MUST have a corresponding entry in `.devcontainer/CHANGELOG.md`.

- New features, enhancements, fixes, and removals each get their own bullet
- Group related changes under the appropriate `### Added`, `### Changed`, `### Fixed`, or `### Removed` heading
- Use sub-headings (`####`) to organize by area (e.g., Workspace Scope Guard, Features, Configuration)
- If an unreleased version section doesn't exist, add changes to the current version's section
- Write entries from the user's perspective — what changed, not how it was implemented

### Documentation

All user-facing changes MUST be reflected in documentation:

- **Plugin changes** → update the plugin's `README.md`
- **Feature changes** → update `features/README.md` and the feature's `devcontainer-feature.json` if applicable
- **Config system changes** → update `.devcontainer/CLAUDE.md`
- **New config files in `.codeforge/config/`** → add entry to `.codeforge/file-manifest.json`
- **Docs site** → update relevant pages in `docs/` if the docs site exists

### User Configuration

All user-customizable configuration files belong in `.codeforge/`. New config files go in `.codeforge/config/`, with a corresponding entry in `.codeforge/file-manifest.json`.
