# CodeForge Monorepo

This repository contains three packages. Each package manages its own dependencies independently.

## Packages

| Package | Runtime | Package Manager |
|---------|---------|-----------------|
| `container/` | Node.js | npm |
| `cli/` | Bun | bun |
| `docs/` | Node.js | npm |

## Development Rules

### Branching Strategy

- **`main`** — production/release branch. Only updated via PRs from `staging`.
- **`staging`** — integration branch. All feature/fix branches target `staging` for PRs.
- Feature and fix branches should be created from `staging` and PRed back to `staging`.
- PRs from `staging` to `main` are used for releases.

### Package-Specific Rules

Each package has its own `CLAUDE.md` with package-specific development rules:

- [`container/CLAUDE.md`](container/CLAUDE.md) — changelog, documentation, and configuration rules for the devcontainer package
- `cli/` — Bun/TypeScript CLI; run `bun test` for tests
- `docs/` — Astro/Starlight site; run `npm run build` to verify

### Cross-Package Changes

When a change spans multiple packages, make the changes in a single branch and PR.
Group related changes in the commit message by package.

### Testing

Run tests for each affected package before committing:

- **Container**: `cd container && npm test`
- **CLI**: `cd cli && bun test`
- **Docs**: `cd docs && npm run build`
