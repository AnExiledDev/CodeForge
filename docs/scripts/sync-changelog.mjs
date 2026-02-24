/**
 * Syncs .devcontainer/CHANGELOG.md into the docs content collection.
 *
 * Runs before `astro dev` and `astro build` so the docs site always
 * reflects the canonical changelog. The source file is the single
 * source of truth — never edit the generated docs page directly.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = resolve(__dirname, '../../.devcontainer/CHANGELOG.md');
const dest = resolve(__dirname, '../src/content/docs/reference/changelog.md');

const content = readFileSync(source, 'utf-8');

// Strip the H1 heading — Starlight generates one from the frontmatter title
const body = content.replace(/^# .+\n+/, '');

// Convert [vX.Y.Z] link-style headings to plain ## vX.Y.Z headings
// Source uses ## [v1.14.0] - 2026-02-24, docs need ## v1.14.0
const cleaned = body.replace(/^(##) \[v([\d.]+)\] - (\d{4}-\d{2}-\d{2})/gm, '$1 v$2\n\n**Release date:** $3');

const frontmatter = `---
title: Changelog
description: Complete version history for every CodeForge release — features, fixes, and migration guides.
sidebar:
  order: 1
---

:::note[Auto-Generated]
This page mirrors [\`.devcontainer/CHANGELOG.md\`](https://github.com/AnExiledDev/CodeForge/blob/main/.devcontainer/CHANGELOG.md) and is regenerated on every build. Do not edit directly — update the source file instead.
:::

## Versioning Policy

CodeForge follows semantic versioning:

- **Major** (X.0.0) — Breaking changes that require migration steps
- **Minor** (0.X.0) — New features and enhancements, backward compatible
- **Patch** (0.0.X) — Bug fixes with no feature changes

Breaking changes are rare. Most releases are minor versions that add new plugins, skills, or tools without requiring any user action beyond updating.

## Update Process

\`\`\`bash
# Update to latest version
npx codeforge-dev@latest

# Update to a specific version
npx codeforge-dev@1.14.0
\`\`\`

After updating, rebuild your DevContainer to apply changes:

1. Open the VS Code command palette (\`Ctrl+Shift+P\` / \`Cmd+Shift+P\`)
2. Select **Dev Containers: Rebuild Container**

:::tip[Non-Breaking Updates]
For minor and patch updates, you can usually just rebuild the container. Check the changelog entries below for any migration notes before upgrading across multiple major versions.
:::

## Related

- [Installation](../getting-started/installation/) — initial setup and update instructions
- [Architecture](./architecture/) — system design context for understanding changes

---

## Version History

`;

writeFileSync(dest, frontmatter + cleaned);
console.log('✓ Changelog synced from .devcontainer/CHANGELOG.md');
