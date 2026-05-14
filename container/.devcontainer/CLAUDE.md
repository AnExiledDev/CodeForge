# .devcontainer

The CodeForge devcontainer definition — features, plugins, scripts, config defaults, and AI documentation.

Entry: `AGENTS.md` — authoritative reference for all AI assistants; covers config keys, commands, plugins, auth, and modification procedures.

## Key Files

- `devcontainer.json` — container definition: 34+ features, VSCode settings/extensions, port mappings, postStartCommand
- `docker-compose.yml` — base Compose file: image, named volumes, resource limits
- `scripts/setup.sh` — postStartCommand orchestrator; runs all setup-*.sh subscripts, reads flags from `.codeforge/container.json`
- `scripts/generate-compose.mjs` — initializeCommand; discovers `.codeforge/secrets/` and generates `docker-compose.codeforge.yml`
- `scripts/generate-settings-profiles.js` — generates `.generated/codeforge/claude/settings/settings*.json` from base.json + profiles
- `defaults/codeforge/file-manifest.json` — controls which config files deploy to `~/.claude/` on container start; each entry has `id`, `src`, `dest`, `overwrite` (`if-changed`|`always`|`never`)
- `CHANGELOG.md` — user-facing change history (required entry for every PR)
- `AI-CONTEXT.md` — machine-readable environment facts for AI assistants (~700 token target)

## Subdirectories

- `features/` — 34 custom devcontainer features (see list below)
- `plugins/devs-marketplace/` — single marketplace plugin bundle; contains 12 Claude Code plugins under `plugins/`
- `scripts/` — setup-*.sh subscripts + generate-compose.mjs + generate-settings-profiles.js
- `defaults/codeforge/` — packaged config defaults deployed on every container start
  - `claude/settings/` — `base.json` (shared settings) + `profiles/*.json` (model overlays)
  - `claude/system-prompts/` — `template.md` (Jinja2), `main.md`, `orchestrator.md`, `writing.md`, `claude-default.md`, `components/` (14 partials)
  - `claude/rules/` — behavioral rules deployed to `~/.claude/rules/` every start
  - `claude/router/` — LLM provider routing config
  - `claude/statusline/` — ccstatusline widget layout
  - `rtk/`, `codex/` — tool-specific configs

## Features (custom, under features/)

agent-browser, ast-grep, biome, ccburn, ccdiag, ccms, ccstatusline, ccusage, chromaterm, claude-code-karma, claude-code-native, claude-code-router, claude-mem, claude-monitor, claude-session-analyzer, codeforge-cli, codex-cli, dprint, hadolint, hermes-agent, kitty-terminfo, lamarck, lsp-servers, mcp-qdrant, notify-hook, oh-my-claude, rtk, ruff, sandcastle, shellcheck, shfmt, tmux, tree-sitter, zsh-completions

## Plugins (under plugins/devs-marketplace/plugins/)

Active: agent-system, auto-code-quality, dangerous-command-blocker, protected-files-guard, session-context, skill-engine, workspace-scope-guard, codeforge-lsp
Archived/disabled: git-workflow, notify-hook, prompt-snippets, spec-workflow, ticket-workflow

## System Prompt Architecture

`defaults/codeforge/claude/system-prompts/` uses a Jinja2 template system:
- `template.md` — master template with named blocks (`{% block identity %}`, etc.) and `{% include "components/…" %}` directives
- `components/` — 14 partial files (identity, guardrails, task-approach, decision-authority, task-intake, code-quality, communication, platform, context-management, tools, subagent-routing, error-recovery, self-review, memory)
- `main.md`, `orchestrator.md`, `writing.md` — rendered variants (deployed via file-manifest)
- `claude-default.md` — fallback prompt for unmodified deployments

## Conventions

- Feature install order is explicit in `devcontainer.json` `overrideFeatureInstallOrder` — runtimes first, then Claude Code, then npm/uv-dependent tools
- Disable a feature without removing it: set `"version": "none"` in its config block
- `overwrite: "never"` entries in file-manifest are one-time seeds (user owns them after first deploy)
- Plugin hook scripts are Python; tested directly via importlib in `container/tests/plugins/`
- AGENTS.md is the source of truth for AI assistants; AI-CONTEXT.md is the machine-readable summary (~700 token hard ceiling)
- `workspace-scope-guard` MUST NOT be disabled without explicit user instruction
