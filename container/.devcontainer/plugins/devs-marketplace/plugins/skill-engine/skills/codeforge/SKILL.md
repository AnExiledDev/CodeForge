---
name: codeforge
description: >-
  CodeForge devcontainer deep context: toolchain inventory, filesystem map,
  safety constraints, and resource limits. Use when an AI assistant needs
  to understand the container environment — what's installed, where things
  live, what's blocked, and what persists.
version: 0.1.0
allowed-tools: Bash, Read
argument-hint: "[toolchain | filesystem | constraints | all]"
effort: low
---

# CodeForge Container Context

On-demand deep reference for the CodeForge devcontainer environment.
Complements the static `AI-CONTEXT.md` with full detail.

## Quick Environment Summary

- Debian-based container, `vscode` user, bash shell, 6 GB RAM, no swap
- Workspace at `/workspaces/`, projects at `/workspaces/projects/<name>/`
- Config: `.codeforge/` overrides → `.devcontainer/defaults/codeforge/` defaults
- Named Docker volumes persist `~/.claude/`, `~/.config/gh/`, caches across rebuilds
- Safety plugins block destructive commands, protect sensitive files, enforce project scope
- Tools: Python 3, Node.js, Go, Rust, Bun, gh, docker, ast-grep, tree-sitter, biome, ruff

---

## Reference Files

| File | Description |
|------|-------------|
| `references/toolchain.md` | Full tool inventory by category with binary paths and preferred-tool guidance |
| `references/filesystem.md` | Directory tree, volume mounts, config resolution, file-manifest system |
| `references/constraints.md` | Safety plugins, resource limits, auth model, container lifecycle |

---

## Ambiguity Policy

- No argument or `all` → load all three reference files
- `toolchain` → load `references/toolchain.md` only
- `filesystem` → load `references/filesystem.md` only
- `constraints` → load `references/constraints.md` only
