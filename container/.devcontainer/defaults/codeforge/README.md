# CodeForge Packaged Defaults

This directory contains shipped defaults. Do not copy it wholesale into
`.codeforge/`.

Project overrides use the same logical paths under `.codeforge/`. For example,
override `claude/system-prompts/main.md` by creating
`.codeforge/claude/system-prompts/main.md`.

Claude settings are generated from `claude/settings/base.json` plus one of the
profile overlays in `claude/settings/profiles/`. Generated files are written to
`.devcontainer/.generated/codeforge/claude/settings/` and deployed to
`~/.claude/settings*.json`.
