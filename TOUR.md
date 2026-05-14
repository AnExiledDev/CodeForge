# Codebase Tour

## Quick Reference

- **Repo shape:** Monorepo with 3 independent packages — `container/`, `cli/`, `docs/`
- **Languages/Runtimes:** Node.js (container, docs), TypeScript on Bun (cli), Python via pytest (container plugin tests)
- **Package Managers:** npm (`container/`, `docs/`), bun (`cli/`)
- **Test Frameworks:** pytest + `test.js` (container), `bun test` (cli), `astro build` with `starlight-links-validator` (docs)
- **Entry Points:** `container/setup.js`, `cli/src/index.ts`, `docs/astro.config.mjs`
- **Build commands:** `cd container && npm test` · `cd cli && bun test` · `cd docs && npm run build`

## If you need to find...

**Devcontainer install/setup logic**: Start at `container/setup.js` (the `@coredirective/cf-container` npm entry — copies `.devcontainer/` into target projects with checksum/update/preserve semantics). Runtime container declaration is `container/.devcontainer/devcontainer.json` (features, settings, port mappings). The `postStartCommand` orchestrator is `container/.devcontainer/scripts/setup.sh`, which dispatches gated `setup-*.sh` subscripts based on `container/.codeforge/container.json` flags.

**Plugin system**: Plugins live at `container/.devcontainer/plugins/devs-marketplace/plugins/`. There are 13 plugins: `agent-system`, `auto-code-quality`, `codeforge-lsp`, `dangerous-command-blocker`, `git-workflow`, `notify-hook`, `prompt-snippets`, `protected-files-guard`, `session-context`, `skill-engine`, `spec-workflow`, `ticket-workflow`, `workspace-scope-guard`. Plugin hook scripts are Python; unit tests are in `container/tests/plugins/` (loaded via `importlib` for isolation).

**Claude Code config defaults and deploy manifest**: Packaged defaults are in `container/.devcontainer/defaults/codeforge/`. Deploy logic is driven by `container/.devcontainer/defaults/codeforge/file-manifest.json` (id/src/dest/overwrite per file). Project-only overrides and state live in `container/.codeforge/` — never put defaults there.

**System prompts and Claude profiles**: Master template at `container/.devcontainer/defaults/codeforge/claude/system-prompts/template.md` (Jinja2; composes 14 component partials in `components/`, renders to `main.md`/`orchestrator.md`/`writing.md`). Claude Code settings base + model/context profile overlays: `container/.devcontainer/defaults/codeforge/claude/settings/base.json` and `claude/settings/profiles/*.json`; rendered via `generate-settings-profiles.js`.

**CLI commands and command registry**: Entry point `cli/src/index.ts` wires all `registerXxxCommand(parent)` modules. Commands live in `cli/src/commands/<domain>/`. Data access is centralized in `cli/src/loaders/` (reads `~/.claude/` files); output rendering in `cli/src/output/` (text/json/stats per domain).

**`codeforge session search`**: Command module `cli/src/commands/session/search.ts`. Streaming JSONL engine `cli/src/search/engine.ts`; boolean AND/OR/NOT parser `cli/src/search/query-parser.ts`; wire types `cli/src/schemas/session-message.ts`.

**`codeforge doctor` (environment diagnostics)**: `cli/src/commands/doctor/index.ts` — parallel health checks with `--fix` interactive mode.

**Container-proxy detection**: `cli/src/utils/context.ts` — `isInsideContainer()` and the auto-proxy that re-runs the CLI inside the container via `docker exec` when invoked from the host.

**Codebase indexer**: `cli/src/indexer/` — SQLite-backed symbol index (extractor, scanner, folder rules).

**Plugin management commands**: `cli/src/commands/plugin/` (`list`, `show`, `enable`, `disable`, `hooks`, `agents`, `skills`).

**Documentation pages**: Content in `docs/src/content/docs/`, organized by Starlight topic (`start-here/`, `use/`, `customize/`, `extend/`, `reference/`). One MDX per CodeForge plugin under `extend/plugins/`. Sidebar/topic structure is defined entirely in `docs/astro.config.mjs` — content file + sidebar entry must stay in sync. Content collections registered in `docs/src/content.config.ts`. Custom slot overrides: `docs/src/components/Hero.astro`, `docs/src/components/Header.astro`.

**Changelog (single source of truth)**: `container/.devcontainer/CHANGELOG.md`. The docs site mirrors it via `docs/scripts/sync-changelog.mjs` (auto-runs before `dev` and `build`) — never edit `docs/src/content/docs/reference/changelog.md` directly; it's generated.

**AI assistant reference for the devcontainer**: `container/.devcontainer/AGENTS.md` is the authoritative reference (commands, config, plugins, auth, modification procedures). `container/.devcontainer/AI-CONTEXT.md` is the machine-readable summary with a hard ~700-token ceiling.

**Per-project overrides and state**: `container/.codeforge/container.json` — setup flags, identity, timezone, versionLock, plugin blacklist. Any new override file needs a manifest entry.

**Compose-secret generation**: `container/.devcontainer/scripts/generate-compose.mjs` — `initializeCommand`; discovers `container/.codeforge/secrets/` files and emits Docker Compose secret mounts.

## Conventions

- **Changelog discipline**: Every change requires an entry in `container/.devcontainer/CHANGELOG.md`, grouped under `###` domain headings (e.g. `### Security`, `### Agent System`). Cross-package changes belong in a single PR, grouped by package in the commit message.
- **Branching**: feature/fix branches → `staging` (integration) → `main` (release). PRs from `staging` to `main` are used for releases. Never commit directly to `main`.
- **Per-package dependencies**: Each package manages its own dependencies — no root lockfile. Run tests in the affected package(s) before committing.
- **Defaults vs. overrides**: Packaged defaults live in `container/.devcontainer/defaults/codeforge/`; `container/.codeforge/` is project-override and state only.
- **Disabling a devcontainer feature**: Set `"version": "none"` in its block in `devcontainer.json` — do not remove the entry (preserves install order).
- **`workspace-scope-guard` is load-bearing**: Do not disable it without explicit user instruction — it enforces file-operation scoping across all agents.
