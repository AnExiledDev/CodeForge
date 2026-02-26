# Contributing to CodeForge

Thank you for your interest in contributing to CodeForge! This document provides
guidelines for contributing to the project.

## How to Contribute

1. **Fork** the repository
2. **Create a branch** from `main` for your change
3. **Make your changes** following the guidelines below
4. **Submit a pull request** using the PR template

## Development Setup

```bash
git clone https://github.com/AnExiledDev/CodeForge.git
cd CodeForge
npm test
```

To test the devcontainer itself, open the project in VS Code and select
"Reopen in Container".

## Pull Request Process

- Fill out the [pull request template](.github/pull_request_template.md)
- Ensure `npm test` passes
- Add an entry to `.devcontainer/CHANGELOG.md` describing your change
- Update documentation if your change affects user-facing behavior
- PRs require one approving review before merge

## Code Style

- **JavaScript** — formatted and linted with [Biome](https://biomejs.dev/)
- **Shell scripts** — follow existing conventions; formatted with shfmt where applicable
- Keep changes focused — one logical change per PR

## Licensing

All contributions are licensed under the
[GNU General Public License v3.0](LICENSE.txt). By submitting a pull request,
you agree that your contributions will be licensed under GPL-3.0.

## Contributor License Agreement

A CLA is required for all contributions. The
[CLA Assistant](https://cla-assistant.io/) bot will prompt you to sign on your
first pull request.

**Why a CLA?** CodeForge is dual-licensed (GPL-3.0 for open source use +
commercial licenses for proprietary use). The CLA grants the maintainer
(Marcus Krueger) the right to offer contributions under both licenses. You
retain copyright of your work. See [CLA.md](CLA.md) for the full agreement.

## Reporting Issues

- **Bugs** — use the [bug report template](https://github.com/AnExiledDev/CodeForge/issues/new?template=bug-report.yml)
- **Feature requests** — use the [feature request template](https://github.com/AnExiledDev/CodeForge/issues/new?template=feature-request.yml)
- **Security vulnerabilities** — email [696222+AnExiledDev@users.noreply.github.com](mailto:696222+AnExiledDev@users.noreply.github.com) directly
