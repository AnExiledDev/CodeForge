# docs

Astro 6 + Starlight documentation site for CodeForge, deployed to codeforge.core-directive.com.

Entry: `astro.config.mjs` — single source of truth for sidebar structure, plugins, and all navigation; read this first when adding or reorganizing pages.

## Key Files

- `astro.config.mjs` — sidebar topics, all Starlight plugin config, integrations, OG/head tags
- `src/content.config.ts` — Astro content collection definitions (docs + versions loaders)
- `src/content/docs/index.mdx` — site homepage (splash template)
- `src/content/docs/reference/changelog.md` — auto-generated; do NOT edit directly (see cross-package note)
- `scripts/sync-changelog.mjs` — copies `container/.devcontainer/CHANGELOG.md` into the docs content collection before every dev/build
- `src/components/Hero.astro` — custom Starlight Hero override (full-width, animated)
- `src/components/Header.astro` — custom Starlight Header override
- `src/styles/global.css` — Tailwind 4 global styles

## Subdirectories

- `src/content/docs/` — all page content, organized by sidebar topic: `start-here/`, `use/`, `customize/`, `extend/`, `reference/`
- `src/content/docs/extend/plugins/` — one `.md` per plugin
- `src/content/versions/` — archived version snapshots (currently empty; `starlight-versions` is commented out until v2 is archived)
- `src/components/` — Astro component overrides for Starlight slots
- `src/assets/` — logo files referenced in `astro.config.mjs`
- `public/` — static assets: `favicon.png`, `og-image.png`, `apple-touch-icon.png`
- `scripts/` — build-time Node.js scripts

## Cross-Package Dependency

`scripts/sync-changelog.mjs` reads `../../container/.devcontainer/CHANGELOG.md` at build time. The `dev` and `build` npm scripts run sync automatically. `reference/changelog.md` is a generated file — edit the source in `container/` only.

## Commands

- `npm run dev` — sync changelog + start dev server (0.0.0.0:4321)
- `npm run build` — sync changelog + production build (broken links fail the build via `starlight-links-validator`)
- `npm run preview` — serve the last production build
- `npm run sync` — run changelog sync alone

## Conventions

- Sidebar order and page slugs are defined exclusively in `astro.config.mjs` under `starlightSidebarTopics`; adding a page requires both a file and a sidebar entry
- Each content page uses Starlight frontmatter: `title`, `description`, and optionally `sidebar.order`
- `starlight-links-validator` runs during `npm run build` — broken internal links are a build error; no separate test step exists
- `starlight-kbd` is configured with two types: `mac` (detector: apple) and `windows` (detector: windows, default)
- `starlight-versions` is present in `package.json` but commented out in config; activate when archiving v2
- TypeScript uses `astro/tsconfigs/strict` with no additional overrides
