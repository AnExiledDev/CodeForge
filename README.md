# CodeForge

Monorepo for CodeForge — an AI-powered development environment for Claude Code.

## Packages

| Package | Description | Version |
|---------|-------------|---------|
| [`container/`](container/) | CodeForge DevContainer (`codeforge-dev` on npm) | 2.0.0 |
| [`cli/`](cli/) | CodeForge CLI (`codeforge-cli`) | 0.1.0 |
| [`docs/`](docs/) | Documentation site ([codeforge.core-directive.com](https://codeforge.core-directive.com)) | — |

## Quick Start

```bash
# Install the devcontainer into any project
npx codeforge-dev
```

See [`container/README.md`](container/README.md) for full setup instructions, prerequisites, and usage.

## Development

Each package manages its own dependencies independently:

```bash
# Container (npm)
cd container && npm test

# CLI (Bun)
cd cli && bun test

# Docs (npm)
cd docs && npm run build
```

See [`CLAUDE.md`](CLAUDE.md) for branching strategy and development rules.

## Links

- [Documentation](https://codeforge.core-directive.com)
- [npm package](https://www.npmjs.com/package/codeforge-dev)
- [GitHub](https://github.com/AnExiledDev/CodeForge)
- [Changelog](container/.devcontainer/CHANGELOG.md)

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md)
before submitting a pull request. All contributions require signing our
[Contributor License Agreement](CLA.md).

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE.txt).

**Commercial licensing** is available for organizations that need to use CodeForge
without GPL-3.0 obligations. Contact
[696222+AnExiledDev@users.noreply.github.com](mailto:696222+AnExiledDev@users.noreply.github.com)
or [open a GitHub issue](https://github.com/AnExiledDev/CodeForge/issues/new)
for terms.
