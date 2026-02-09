---
name: dependency-management
description: >-
  This skill should be used when the user asks to "check dependencies",
  "audit dependencies", "find outdated packages", "check dependency health",
  "scan for vulnerabilities", "find unused dependencies", "license check",
  "npm audit", "pip audit", "cargo audit", or discusses dependency analysis,
  supply chain security, package version gaps, or license compliance.
version: 0.1.0
---

# Dependency Management

## Mental Model

Dependency health is **ongoing hygiene**, not a one-time audit. Every dependency is a trust relationship — you inherit its bugs, vulnerabilities, and license obligations. Healthy projects monitor five dimensions continuously:

1. **Currency** — How far behind are you? Major gaps accumulate breaking changes; patch gaps leave security holes open.
2. **Security** — Are there known vulnerabilities? Severity × exploitability × exposure = actual risk.
3. **Unused** — Dead dependencies increase attack surface and slow installs for zero value.
4. **Conflicts** — Version mismatches cause subtle runtime bugs that are expensive to diagnose.
5. **Licensing** — License obligations propagate transitively. One GPL dependency can change your distribution obligations.

Treat dependency updates like any other code change: assess, plan, execute, verify.

---

## Ecosystem Detection

Identify which package managers are in use before running any analysis. A project may span multiple ecosystems (e.g., Python backend + Node.js frontend).

| Ecosystem | Manifest Files | Lock Files |
|-----------|---------------|------------|
| **Node.js** | `package.json` | `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` |
| **Python** | `pyproject.toml`, `setup.py`, `requirements*.txt`, `Pipfile` | `poetry.lock`, `uv.lock`, `Pipfile.lock` |
| **Rust** | `Cargo.toml` | `Cargo.lock` |
| **Go** | `go.mod` | `go.sum` |

Use `Glob` to discover manifests. Read each manifest to count direct dependencies before running analysis commands.

For monorepos, identify each workspace/package separately and analyze independently.

---

## Analysis Workflow

### Phase 1: Outdated Packages

Check currency across all detected ecosystems. Categorize findings by version gap:

- **Major** — Likely breaking changes. Review changelog before upgrading.
- **Minor** — New features, generally low risk.
- **Patch** — Bug fixes and security patches. Upgrade promptly.

Prioritize patch-level upgrades first — they carry the least risk and often fix security issues.

### Phase 2: Security Vulnerabilities

Run ecosystem-specific audit tools. For each finding, report:
- Package name and installed version
- Vulnerability ID (CVE, GHSA)
- Severity (critical / high / medium / low)
- Fixed version (if available)
- Whether it is a **direct** or **transitive** dependency

Direct dependencies are simpler to fix. Transitive vulnerabilities may require upgrading an intermediary package.

### Phase 3: Unused Dependencies

Cross-reference manifest declarations with source imports:
1. Read the manifest to list declared dependencies.
2. Search for import/require statements across all source files.
3. Flag packages with zero import matches as potentially unused.

Mark known implicit-use categories separately: plugins, CLI tools, type packages (`@types/*`), test frameworks in `devDependencies`, build tools, and runtime-loaded modules. These get a "verify manually" note rather than a definitive "unused" label.

### Phase 4: Version Conflicts

Check for conflicting version requirements in the dependency tree. Peer dependency issues in Node.js, version resolution conflicts in Python, and duplicate packages at different versions all indicate problems.

### Phase 5: License Compliance

Classify all dependency licenses and flag risk:
- **Permissive** (MIT, BSD, Apache-2.0, ISC) — Safe for all use.
- **Weak copyleft** (LGPL, MPL) — Safe as library, restrictions on modifications.
- **Strong copyleft** (GPL, AGPL) — May require source disclosure. Flag for commercial projects.
- **Unknown/Missing** — Flag for manual review. Unlicensed code carries legal risk.

---

## Version Gap Classification

| Gap | Risk | Action |
|-----|------|--------|
| Patch (0.0.x) | Low | Upgrade promptly — bug fixes and security patches |
| Minor (0.x.0) | Low–Medium | Review changelog, usually safe to upgrade |
| Major (x.0.0) | Medium–High | Review migration guide, test thoroughly |
| Multiple majors behind | High | Plan incremental upgrade path, one major at a time |

---

## Vulnerability Severity

CVSS scores provide a starting point but need context:

| CVSS Range | Label | Typical Action |
|------------|-------|---------------|
| 9.0–10.0 | Critical | Patch immediately. These often have active exploits. |
| 7.0–8.9 | High | Patch within days. Check if your usage triggers the vulnerability. |
| 4.0–6.9 | Medium | Patch within weeks. Assess exploitability in your context. |
| 0.1–3.9 | Low | Patch during regular maintenance. Low exploitability. |

A critical vulnerability in a transitive dependency used only in tests has lower effective risk than a medium vulnerability in a direct dependency exposed to user input. Always assess exploitability in context.

---

## Ambiguity Policy

| Ambiguity | Default |
|-----------|---------|
| **Scope not specified** | Run all five phases (outdated, security, unused, conflicts, licenses) |
| **Ecosystem not specified** | Analyze all detected ecosystems |
| **Severity threshold** | Report all severities, highlight critical and high |
| **Update recommendations** | Advisory only — never modify manifests or lock files |
| **Direct vs transitive** | Always distinguish; prioritize direct dependencies |

---

## Reference Files

| File | Contents |
|------|----------|
| [Ecosystem Commands](references/ecosystem-commands.md) | Per-ecosystem command tables for npm, pip/uv, cargo, and go — outdated checks, audits, unused detection, conflict checks, and license listing |
| [License Compliance](references/license-compliance.md) | License classification table, SPDX identifiers, commercial implications, common conflicts, and recommended actions per risk level |
