# CodeForge Devcontainer Changelog

## [v1.13.0] - 2026-02-21

### Fixed

- Feature version pins: node `1.6`→`1.7.1`, github-cli `1.0`→`1.1.0`, docker-outside-of-docker `1.7`→`1.6`, rust `1.4`→`1.5.0`, claude-code `1.1`→`1.0.5`
- setup-projects.sh: suppress background inotifywait output
- agent-system: add missing `verify-tests-pass.py` and `verify-no-regression.py` (referenced by agent defs)

### Added

#### Plugin Architecture: Focused Plugins
- **`agent-system` plugin** — 17 custom agents with built-in agent redirection, CWD injection, and read-only bash enforcement
- **`skill-engine` plugin** — 21 coding skills with auto-suggestion hook
- **`spec-workflow` plugin** — 8 spec lifecycle skills with spec-reminder hook
- **`session-context` plugin** — session boundary hooks (git state injection, TODO harvesting, commit reminders)

#### Other
- **`ticket-workflow` hooks** — auto-links GitHub issue/PR references in user prompts via `ticket-linker.py`
- **`auto-code-quality` advisory test runner** — runs affected tests at Stop via `advisory-test-runner.py`
- **`/team` skill** — agent team creation and management with specialist catalog (in `skill-engine`)

### Changed

- Plugin architecture: `code-directive` monolith replaced by focused plugins (`agent-system`, `skill-engine`, `spec-workflow`, `session-context`)
- `auto-code-quality` now consolidates `auto-formatter` + `auto-linter` (disabled separately, `auto-code-quality` is the superset)

### Removed

- `code-directive` plugin (replaced by `agent-system`, `skill-engine`, `spec-workflow`, `session-context`)
- `auto-formatter` and `auto-linter` disabled in settings (consolidated into `auto-code-quality`)

---

## [v1.12.0] - 2026-02-18

### Added

#### Plugin README Documentation
- **9 new README files** for all marketplace plugins: auto-formatter, auto-linter, code-directive, codeforge-lsp, dangerous-command-blocker, notify-hook, protected-files-guard, ticket-workflow, workspace-scope-guard. Each documents purpose, hook lifecycle, protected patterns, and plugin structure

#### Protected Files Guard: Bash Hook
- **`guard-protected-bash.py`** — new PreToolUse/Bash hook blocking bash commands that write to protected file paths (companion to existing Edit/Write guard). Covers `>`, `>>`, `tee`, `cp`, `mv`, `sed -i` targeting `.env`, lock files, `.git`, certificates, and credentials

#### Devcontainer Secrets Declaration
- **`secrets` block** in devcontainer.json declaring `GH_TOKEN`, `NPM_TOKEN`, `GH_USERNAME`, `GH_EMAIL` with documentation URLs for VS Code Codespaces/devcontainer secret management

#### Post-Start Hook System
- **`run_poststart_hooks()`** in setup.sh — runs executable `.sh` scripts from `/usr/local/devcontainer-poststart.d/`; controlled by `SETUP_POSTSTART` env flag (default: true)

#### Git Worktree Support
- **System prompt `<git_worktrees>` section** — layout convention, creation commands, project detection, and safety rules
- **CLAUDE.md documentation** — full worktree section with layout, creation, detection, and compatibility details
- **setup-projects.sh** — `.worktrees/` explicit scanning at depth 3, `.git` file detection via `gitdir:` check, `"worktree"` tag in Project Manager
- **protected-files-guard** — `.git` regex updated from `\.git/` to `\.git(/|$)` to cover worktree `.git` pointer files

#### Other
- **`CLAUDECODE=null` env var** — unsets the detection flag in `remoteEnv` to allow nested Claude Code sessions (claude-in-claude)
- **Go runtime option** — commented-out `ghcr.io/devcontainers/features/go:1` entry in devcontainer.json for easy opt-in

### Changed

#### Feature Version Pinning
- All local features pinned from `"latest"` to explicit versions: agent-browser `0.11.1`, ast-grep `0.40.5`, biome `2.4.2`, ruff `0.15.1`, pyright `1.1.408`, typescript-language-server `5.1.3`, TypeScript `5.9.3`
- External features pinned to minor versions: node `1.6`, github-cli `1.0`, docker-outside-of-docker `1.7`, uv `1.0`, rust `1.4`, claude-code `1.1`

#### Default Shell: bash → zsh
- VS Code terminal default profile changed from bash to zsh
- Explicit `zsh` profile added to terminal profile list
- Claude Teams tmux profile shell changed from bash to zsh

#### Security Hardening
- **dangerous-command-blocker** — 7 new blocked patterns: Docker container escape (`--privileged`, host root mount), destructive Docker ops (`stop/rm/kill/rmi`), bare force push (no branch specified), `find -exec rm`, `find -delete`, `git clean -f`, `rm -rf ../`. JSON parse failures now fail closed (exit 2 instead of 0)
- **protected-files-guard** — JSON parse failures fail closed (exit 2 instead of 0)

#### Build & Setup
- **ccms build cache** — install.sh checks `.build-cache/bin/ccms` before cargo building; caches binary after first build for faster rebuilds; pinned to commit `f90d259a4476`
- **setup.sh** — `setup-update-claude.sh` now runs in background (non-blocking container start); script failure output displayed for diagnostics; new `background` status indicator in summary
- **inotify-tools moved to build time** — tmux feature installs inotify-tools via apt at build; setup-projects.sh no longer attempts runtime apt-get install
- **Container memory** — recommended from 4GB/8GB to 6GB/12GB in troubleshooting docs

#### Writing System Prompt
- New **Emotional Architecture** section — cognitive-emotional loop, controlled emotion principle, autism framing for POV characters
- Expanded metaphor guidance — secondary sources beyond primary domain, "would he think this?" test
- Refined show-don't-tell rules — naming emotion permitted when it adds weight, brief internal processing after major events required
- Character profile additions — emotional architecture and trigger fields

#### Other
- **connect-external-terminal.ps1** — tmux session directory respects `WORKSPACE_ROOT` env var with fallback
- **setup-projects.sh** — inotifywait exclude pattern narrowed from `\.git/` to `\.git` for worktree compatibility
- **README.md** — 5 new badges (changelog, last commit, npm downloads, Node.js, issues), updated tool/feature/skill counts, added Rust/Bun/ccw, changelog section
- **CLAUDE.md** — expanded ccw description, fixed Bun registry reference, documented setup-auth.sh/check-setup.sh, added CLAUDECODE/env flags/experimental vars/git worktrees/rules system sections, skill count 17→28
- **Documentation** — `SETUP_TERMINAL`/`SETUP_POSTSTART` in configuration reference, `CLAUDECODE=null` env var, workspace-scope-guard in plugins.md
- **Agent definitions** — minor path/prompt fixes across 8 agents (claude-guide, debug-logs, dependency-analyst, explorer, generalist, git-archaeologist, researcher, security-auditor)
- **.gitignore** — added `.build-cache/` exclusion

### Removed

- **mcp-reasoner feature** — entire feature directory deleted (README, devcontainer-feature.json, install.sh, poststart-hook.sh)
- **splitrail feature** — entire feature directory deleted (README, devcontainer-feature.json, install.sh)

---

## [v1.11.0] - 2026-02-17

### Added

#### New Feature: ccms (Session History Search)
- **`ccms` devcontainer feature** — Rust-based CLI for searching Claude Code session JSONL files. Installed via `cargo install`. Supports boolean queries, role filtering, time scoping, project isolation, and JSON output
- **`session-search.md` rule** — global rule requiring project-scoped `ccms` usage and documenting CLI flags/query syntax
- **Rust runtime** — added `ghcr.io/devcontainers/features/rust:1` as a devcontainer feature (required by ccms)
- **System prompt `<session_search>` section** — inline reference for ccms usage with key flags and examples
- **Context management updated** — `<context_management>` now references ccms as the primary recovery tool for compacted sessions (three-source recovery: session history → source files → plan/requirement files)

#### New Feature: ccw (Writing Mode)
- **`ccw` alias** — launches Claude with `writing-system-prompt.md` for creative-writing tasks
- **`writing-system-prompt.md`** — dedicated system prompt for writing mode, distributed via file-manifest

#### New Plugin: workspace-scope-guard
- **`workspace-scope-guard`** — safety plugin that blocks writes and warns on reads outside the working directory. Registered in marketplace.json and enabled by default in settings.json

#### New Skills: spec-build, spec-review (code-directive plugin — 28 skills total)
- **`/spec-build`** — orchestrates the full implementation lifecycle from an approved spec: plan, build, review, and close in one pass. 5-phase workflow with acceptance criteria markers (`[ ]` → `[~]` → `[x]`)
- **`/spec-review`** — standalone deep implementation review against a spec. Reads code, verifies requirements and acceptance criteria, recommends `/spec-update` when done

#### New Hook: inject-cwd.py
- **`inject-cwd.py`** (PostToolUse, all tools) — injects current working directory into every tool response via `additionalContext`

#### Status Line: CWD Widget
- **`ccstatusline-cwd`** — new custom-command widget showing the basename of Claude Code's working directory. Layout expanded from 7 to 8 lines (16 → 17 widgets)

### Changed

#### setup-aliases.sh Idempotency Fix
- **Block-marker strategy** — replaced cleanup+guard approach (which left aliases missing on re-run) with a delete-and-rewrite strategy using `START`/`END` block markers. The managed block is removed wholesale by sed range match, then always re-written fresh — no guard/`continue` needed
- **Legacy cleanup expanded** — added removal of v1.10.0 orphaned aliases/exports/`_CLAUDE_BIN`/`cc-tools()` that existed outside block markers, in addition to pre-v1.10.0 function forms
- **cc-tools expanded** — added `ccw`, `ccms`, `cargo` to the tool listing

#### Spec Workflow: Version-Based → Domain-Based Organization
- **Directory structure** — specs now live in domain subfolders (`.specs/{domain}/{feature}.md`) instead of version directories (`.specs/v0.1.0/feature.md`)
- **ROADMAP.md → MILESTONES.md** — version tracker renamed to milestone tracker throughout all skills, templates, and system prompt
- **`**Version:**` → `**Domain:**`** — spec template metadata field renamed across spec-new template, spec-writer agent, specification-writing skill, spec-update, spec-check
- **`roadmap-template.md` → `milestones-template.md`** — reference template replaced
- **Acceptance criteria markers** — three-state progress tracking: `[ ]` (not started), `[~]` (implemented, not yet verified), `[x]` (verified). Used by `/spec-build` phases and recognized by `/spec-check` and `/spec-update`
- **Spec lifecycle expanded** — `/spec-review` inserted before `/spec-update` in the recommended post-implementation workflow. `spec-reminder.py` advisory message updated accordingly
- **Agent skill lists** — architect, generalist, and spec-writer agents gained `/spec-review` access

#### LSP Plugin: Declarative Server Configuration
- **`codeforge-lsp/plugin.json`** — added `lspServers` block with pyright (Python), typescript-language-server (JS/TS), and gopls (Go) declarative configurations replacing implicit setup

#### git-state-injector.py Enhancements
- **Working directory injection** — always outputs cwd with scope restriction message, even outside git repos
- **cwd from hook input** — reads `cwd` from Claude Code's hook JSON input (falls back to `os.getcwd()`)

#### System Prompt Formatting
- **Line unwrapping** — long wrapped lines consolidated to single lines throughout (no content changes, only formatting)

#### Documentation
- **CLAUDE.md** — added `ccw`, `ccms` commands; added `writing-system-prompt.md` to directory tree and config table; added workspace-scope-guard to plugin list; skill count 17 → 28; added Rust to `version: "none"` support; updated setup-aliases.sh description
- **README.md** — added Safety Plugins section; updated spec workflow commands/lifecycle/structure for domain-based organization; added `/spec-build` and `/spec-review` to skill table; fixed system prompt override path (`system-prompt.md` → `main-system-prompt.md`)
- **claude-guide agent** — fixed system prompt path reference (`system-prompt.md` → `main-system-prompt.md`)
- **doc-writer agent** — "Version ships" → "Milestone ships" terminology
- **marketplace.json** — skill count updated (16 → 28); workspace-scope-guard added
- **skill-suggester.py** — added keyword mappings for `spec-build` and `spec-review`
- **spec-workflow.md rule** — added `/spec-build` and `/spec-review` rules (#10, #11); added acceptance criteria markers section; updated directory convention to domain-based

### Removed

- **`spec-init/references/roadmap-template.md`** — replaced by `milestones-template.md`

---

## [v1.10.0] - 2026-02-13

### Added

#### New Skill: spec-refine (code-directive plugin — 26 skills total)
- **`/spec-refine`** — iterative 6-phase spec refinement: assumption mining, requirement validation (`[assumed]` → `[user-approved]`), acceptance criteria review, scope audit, and final approval gate

#### setup-terminal.sh
- New setup script configures VS Code Shift+Enter keybinding for Claude Code multi-line terminal input (idempotent, merges into existing keybindings.json)

### Changed

#### Native Binary Preference
- **setup-aliases.sh** — introduces `_CLAUDE_BIN` variable resolution: prefers `~/.local/bin/claude` (official `claude install` location), falls back to `/usr/local/bin/claude`, then PATH. All aliases (`cc`, `claude`, `ccraw`) use `"$_CLAUDE_BIN"`
- **setup-update-claude.sh** — complete rewrite: delegates to `claude install` (first run) and `claude update` (subsequent starts) instead of manual binary download/checksum/swap. Logs to `/tmp/claude-update.log`

#### Smart Test Selection
- **advisory-test-runner.py** — rewritten to run only affected tests based on edited files. Maps source files to test files (pytest directory mirroring, vitest `--related`, jest `--findRelatedTests`, Go package mapping). Timeout reduced from 60s to 15s. Skips entirely if no files edited
- **hooks.json** — advisory-test-runner timeout reduced from 65s to 20s

#### Two-Level Project Detection
- **setup-projects.sh** — two-pass scanning: depth-1 directories with project markers registered directly; directories without markers treated as containers and children scanned. Recursive inotifywait with noise exclusion. Clean process group shutdown

#### Spec Approval Workflow
- **spec-writer agent** — adds `**Approval:** draft` field, requires `[assumed]` tagging on all requirements, adds `## Resolved Questions` section, references `/spec-refine` before implementation
- **spec-new skill** — pre-fills `**Approval:** draft`, notes features should come from backlog
- **spec-check skill** — adds Unapproved (high) and Assumed Requirements (medium) issue checks, Approval column in health table, approval summary
- **spec-update skill** — minor alignment with approval workflow
- **spec-init templates** — backlog template expanded with P0–P3 priority grades + Infrastructure section; roadmap template rewritten with pull-from-backlog workflow
- **specification-writing skill** — updated with approval field and requirement tagging guidance

#### Spec Workflow Completeness
- **spec-workflow.md (global rule)** — softened 200-line hard cap to "aim for ~200"; added approval workflow rules (spec-refine gate, requirement tags, spec-reminder hook); added `**Approval:**` and `## Resolved Questions` to standard template
- **main-system-prompt.md** — softened 4× hard "≤200 lines" references to "~200 lines"
- **spec-new skill** — fixed "capped at 200" internal contradiction; added explanation of what `/spec-refine` does and why
- **spec-new template** — added Approval Workflow section explaining `[assumed]`/`[user-approved]` tags and `draft`/`user-approved` status
- **spec-update skill** — added approval gate warning for draft specs; added spec-reminder hook documentation; added approval validation to checklist
- **spec-check skill** — added `implemented + draft` (High) and `inconsistent approval` (High) checks
- **spec-init skill** — expanded next-steps with full lifecycle (backlog → roadmap → spec → refine → implement → update → check)
- **spec-reminder.py** — added `/spec-refine` mention in advisory message for draft specs

#### Documentation Sizing
- **Relaxed 200-line hard cap** to "aim for ~200 lines" across global rule, system prompt, spec-new skill, architect agent, doc-writer agent, documentation-patterns skill, and spec-check skill

#### Other
- **setup.sh** — added `SETUP_TERMINAL` flag, normalized update-claude invocation via `run_script` helper
- **check-setup.sh** — removed checks for disabled features (shfmt, shellcheck, hadolint, dprint); checks RC files for alias instead of `type cc`
- **connect-external-terminal.sh** — uses `${WORKSPACE_ROOT:-/workspaces}` instead of hardcoded path
- **devcontainer.json** — formatting normalization
- **main-system-prompt.md** — updates for spec approval workflow and requirement tagging

### Removed
- **test-project/README.md** — deleted (no longer needed)

---

## [v1.9.0] - 2026-02-10

### Added

#### Agent Context Inheritance (code-directive plugin)
- **Project Context Discovery** — all 14 project-interacting agents now read `.claude/rules/*.md` and CLAUDE.md files before starting work. Agents walk up the directory tree from their working directory to the workspace root, applying conventions from each level (deeper files take precedence)
- **Execution Discipline** — 7 agents (generalist, refactorer, migrator, test-writer, doc-writer, architect, researcher) gain structured pre/post-work verification: read before writing, verify after writing, no silent deviations, failure diagnosis before retry
- **Code Standards** — 5 agents (generalist full; refactorer, migrator, test-writer, architect compact) gain SOLID, DRY/KISS/YAGNI, function size limits, error handling rules, and forbidden patterns (god classes, magic numbers, dead code)
- **Professional Objectivity** — 10 agents gain explicit instruction to prioritize technical accuracy over agreement, present evidence when it conflicts with assumptions
- **Communication Standards** — all 14 agents gain response brevity rules: substance-first responses, no preamble, explicit uncertainty marking, file:line references
- **Documentation Convention** — 2 write agents (generalist, migrator) gain inline comment guidance (explain "why", not "what")
- **Context Management** — generalist gains instruction to continue working normally when context runs low
- **Testing Guidance** — generalist gains testing standards (verify behavior not implementation, max 3 mocks per test)
- **Scope Discipline** — refactorer gains explicit constraint: never expand scope beyond the requested refactoring
- **Tiered approach**: Tier 1 (generalist, 139→268 lines, all blocks), Tier 2 (4 write agents, full blocks), Tier 3 (9 read-only agents, compact blocks). 3 agents skipped (bash-exec, claude-guide, statusline-config — no project context needed)

#### Specification Workflow System (code-directive plugin — 4 new skills, 25 total)
- **`/spec-new`** — creates a new spec from the standard template in `.specs/`
- **`/spec-update`** — performs as-built spec update after implementation (checks off criteria, adds implementation notes, updates paths)
- **`/spec-check`** — audits spec health: stale specs, missing coverage, orphaned files
- **`/spec-init`** — bootstraps `.specs/` directory structure for projects that don't have one
- **`spec-reminder.py`** `[Stop]` — new advisory hook reminds about spec updates when implementation work is detected
- **Spec skills assigned to agents** — generalist and spec-writer agents gain spec skill access in frontmatter

#### Default Rules Distribution
- **`config/defaults/rules/`** — new directory containing default `.claude/rules/` files distributed to all projects via file-manifest
- **`spec-workflow.md`** — rule enforcing spec-before-implementation workflow, ≤200 line spec limit, `.specs/` directory convention, as-built update requirement
- **`workspace-scope.md`** — rule restricting file operations to the current project directory

#### New Plugin: auto-code-quality
- **Self-contained code quality plugin** — combines auto-formatter + auto-linter into a single drop-in plugin with independent temp file namespace (`claude-cq-*`). Includes all 7 formatters (Ruff, Biome, gofmt, shfmt, dprint, rustfmt, Black fallback) and 7 linters (Pyright, Ruff, Biome, ShellCheck, go vet, hadolint, clippy) plus syntax validation. Designed for use outside the CodeForge devcontainer where auto-formatter and auto-linter aren't available separately

### Changed

#### Config System
- **`file-manifest.json`** — added 2 new entries for default rules files (`defaults/rules/spec-workflow.md`, `defaults/rules/workspace-scope.md`) targeting `${CLAUDE_CONFIG_DIR}/rules`
- **`setup-config.sh` bug fix** — fixed bash field-collapse bug where empty `destFilename` caused subsequent fields to shift. Uses `__NONE__` sentinel in jq output to prevent `read` from collapsing consecutive tab delimiters

#### Plugin References
- **`frontend-design` plugin name corrected** — fixed `frontend-design@claude-code-plugins` → `frontend-design@claude-plugins-official` in both `settings.json` and `CLAUDE.md`

#### Code-Directive Plugin
- **`hooks.json`** — added `spec-reminder.py` to Stop hooks (now 3 Stop hooks: advisory-test-runner, commit-reminder, spec-reminder)
- **`marketplace.json`** — added `auto-code-quality` plugin entry (10 plugins total, was 9)
- **Agent definitions** — 14 of 17 agents updated with orchestrator-mirrored instructions (see Agent Context Inheritance above)

#### Formatting
- **Whitespace normalization** — `settings.json`, `file-manifest.json`, `marketplace.json`, `hooks.json`, `package.json`, `setup-config.sh` reformatted to consistent tab indentation

---

## [v1.8.0] - 2026-02-09

### Added

#### Config System: Declarative File Manifest
- **`config/file-manifest.json`** — new declarative manifest controlling which config files are copied and how. Replaces hardcoded `copy_file` calls with per-file `overwrite` modes: `"if-changed"` (sha256-based, default), `"always"`, or `"never"`
- **`config/defaults/`** — config files relocated from `config/` to `config/defaults/` (settings.json, keybindings.json, main-system-prompt.md)
- **`setup-config.sh` rewritten** — reads file-manifest.json, supports variable expansion (`${CLAUDE_CONFIG_DIR}`, `${WORKSPACE_ROOT}`), sha256-based change detection, and legacy fallback if manifest is missing

#### Features
- **ruff feature** — Python formatter/linter via `uv tool install ruff`; replaces Black as primary Python formatter (Black kept as fallback)
- **shfmt feature** — Shell script formatter via direct binary download from GitHub releases; supports `.sh`, `.bash`, `.zsh`, `.mksh`, `.bats`
- **dprint feature** — Pluggable formatter for Markdown, YAML, TOML, and Dockerfile via GitHub releases binary; ships global config at `/usr/local/share/dprint/dprint.json` with four plugins (markdown, yaml, toml, dockerfile)
- **shellcheck feature** — Shell script linter via `apt-get install`; JSON output parsing for structured diagnostics
- **hadolint feature** — Dockerfile linter via direct binary download from GitHub releases; JSON output parsing

#### Formatter Coverage (format-on-stop.py)
- **Ruff formatter** — `.py`/`.pyi` files now formatted with Ruff (falls back to Black if Ruff not installed)
- **Biome expanded** — added `.css`, `.json`, `.jsonc`, `.graphql`, `.gql`, `.html`, `.vue`, `.svelte`, `.astro` (was JS/TS only; now 18 extensions total)
- **shfmt integration** — `.sh`, `.bash`, `.zsh`, `.mksh`, `.bats` files auto-formatted on Stop
- **dprint integration** — `.md`, `.markdown`, `.yaml`, `.yml`, `.toml` files and `Dockerfile`/`.dockerfile` auto-formatted on Stop
- **rustfmt integration** — `.rs` files auto-formatted if `rustfmt` is in PATH (conditional, zero overhead when unused)

#### Linter Coverage (lint-file.py)
- **Ruff linter** — Python files now checked by both Pyright (type checking) and Ruff (style/correctness); complementary, not redundant
- **Biome lint** — JS/TS/CSS/GraphQL files linted via `biome lint --reporter=json`; surfaces unsafe diagnostics not auto-fixed by formatter
- **ShellCheck** — shell scripts linted via `shellcheck --format=json`; structured severity/line/message output
- **go vet** — `.go` files linted via `go vet`; stderr parsed for diagnostics
- **hadolint** — `Dockerfile`/`.dockerfile` files linted via `hadolint --format json`
- **clippy** — `.rs` files linted via `cargo clippy` if cargo is in PATH (conditional)

#### version:none Support
- **All 20 local features** now support `"version": "none"` in devcontainer.json to skip installation entirely
- Added `version` option to 7 features that previously lacked it: ccstatusline, notify-hook, shellcheck, mcp-qdrant, mcp-reasoner, splitrail, lsp-servers
- Added skip guard (`if [ "${VERSION}" = "none" ]; then exit 0; fi`) to all 20 install.sh files

#### Advisory Hooks (code-directive plugin)
- **advisory-test-runner.py** `[Stop]` — runs project test suite on Stop, injects pass/fail results as `additionalContext`. Never blocks (always exit 0). Detects pytest, vitest, jest, mocha, go test, cargo test. 60s timeout, truncates to last 30 lines
- **git-state-injector.py** `[SessionStart]` — injects branch, status summary, recent commits, and diff stats as `additionalContext` on every session start. 5s per git command, total output capped at 2000 chars
- **ticket-linker.py** `[UserPromptSubmit]` — auto-fetches GitHub issues/PRs when prompt contains `#123` or full GitHub URLs. Up to 3 refs per prompt, body capped at 1500 chars each
- **commit-reminder.py** `[Stop]` — checks for uncommitted changes (staged/unstaged counts) and injects advisory reminder as `additionalContext`. Checks `stop_hook_active`
- **todo-harvester.py** `[SessionStart]` — greps for TODO/FIXME/HACK/XXX across 13 source extensions, injects count + top 10 items. Excludes noise dirs, output capped at 800 chars

#### New Skills (code-directive plugin — 5 new, 21 total)
- **api-design** — REST conventions, error handling patterns, OpenAPI/Swagger guidance
- **ast-grep-patterns** — structural code search patterns across languages
- **dependency-management** — ecosystem-specific audit commands, license compliance
- **documentation-patterns** — docstring formats, API doc templates
- **migration-patterns** — Python and JavaScript framework migration guides

#### Commands & Scripts
- **`cc-tools`** — new shell function listing all installed CodeForge tools with version info
- **`check-setup`** — new health check script (`check-setup.sh`) verifying container setup is working correctly; aliased in shell rc files

#### Workspace
- **`CLAUDE.md`** — workspace-level project instructions (workspace scoping rules)
- **`test-project/`** — minimal test project directory

### Changed

#### NPM Package (setup.js)
- **`--force` is now non-destructive** — selectively syncs files instead of rm+copy. Framework files (scripts, features, plugins) are overwritten; user config files (settings, keybindings, system prompt, file-manifest) are preserved with `.codeforge-new` versions saved for diffing
- **`--reset` flag** — new option for complete fresh install (deletes and re-copies everything)
- **`.codeforge-preserve`** — user-customizable file listing additional paths to preserve during `--force` updates
- **devcontainer.json handling** — user's version backed up as `.bak` during `--force`, then overwritten with package version
- **`.npmignore`** — excludes `.codeforge-new`, `.bak`, and `.codeforge-preserve` artifacts from npm package

#### Setup System
- **setup.sh** — removed `set -e` (individual script failures no longer abort the entire setup); structured pass/fail/skip reporting with elapsed time summary
- **setup-aliases.sh** — backs up `.bashrc`/`.zshrc` before modifying (keeps last 3 backups); cleans up old cc-tools/check-setup definitions; adds `cc-tools` function and `check-setup` alias
- **OVERWRITE_CONFIG deprecated** — replaced by per-file `overwrite` in `config/file-manifest.json`. Legacy env var triggers a deprecation warning

#### Code-Directive Plugin
- **hooks.json** — expanded from 3 to 6 hook events (added Stop, SessionStart, updated UserPromptSubmit with ticket-linker)
- **Agent definitions** — architect gains documentation outputs section + api-design skill link; multiple agents updated with refined instructions
- **skill-suggester.py** — added keyword mappings for 5 new skills (api-design, ast-grep-patterns, dependency-management, documentation-patterns, migration-patterns)
- **specification-writing skill** — expanded with additional templates and patterns
- **code-directive plugin.json** — description updated to "17 custom agents, 16 coding skills, agent redirection, syntax validation, and skill auto-suggestion"

#### Other
- **format-on-stop.py** — rewritten with expanded dispatch: 7 formatters covering 31 file extensions (was 3 formatters, 12 extensions)
- **lint-file.py** — rewritten as multi-language dispatcher: 7 linters across Python, JS/TS/CSS, Shell, Go, Dockerfile, Rust (was Pyright-only for Python)
- **auto-linter hook timeout** — increased from 30s to 60s (each individual linter subprocess still capped at 10s)
- **auto-formatter plugin.json** — description updated to reflect all 7 formatters
- **auto-linter plugin.json** — description updated to reflect all 7 linters
- **marketplace.json** — descriptions updated for auto-formatter, auto-linter, and code-directive plugins
- **devcontainer.json** — 5 new features registered in `overrideFeatureInstallOrder` and `features` object; added install order documentation comments
- **.env.example** — removed `OVERWRITE_CONFIG`, added `SETUP_PROJECTS`, updated descriptions
- **.gitignore** — updated with additional exclusions

### Removed

- **`features/claude-code/`** — entire local feature deleted (Claude Code now installed via `ghcr.io/anthropics/devcontainer-features/claude-code:1`, the official Anthropic feature)
- **`config/settings.json`**, **`config/keybindings.json`**, **`config/main-system-prompt.md`** — moved to `config/defaults/` subdirectory
- **`OVERWRITE_CONFIG` env var** — deprecated in favor of `config/file-manifest.json` per-file overwrite modes

### Documentation

- **New `docs/` directory** with 5 focused guides: configuration-reference, keybindings, optional-features, plugins, troubleshooting
- **CLAUDE.md** — rewritten for new config system (file-manifest.json, config/defaults/), added cc-tools/check-setup commands, added version:none section, updated plugin descriptions
- **README.md** — added new tools (ruff, shfmt, dprint, shellcheck, hadolint, Bun), updated config system docs, added SETUP_PROJECTS and PLUGIN_BLACKLIST env vars, updated ccstatusline description

---

## [v1.7.1] - 2026-02-08

### Added

- **Automatic Git & NPM auth on container start** — new `setup-auth.sh` script reads tokens from `.devcontainer/.secrets` (or environment variables) and configures GitHub CLI, git user identity, and NPM registry auth automatically
- **`.secrets.example` template** — committed template showing required variables (`GH_TOKEN`, `GH_USERNAME`, `GH_EMAIL`, `NPM_TOKEN`)
- **`.env.example` template** — committed template for environment configuration (`.env` itself remains gitignored)
- **`SETUP_AUTH` env var** — controls whether auth setup runs on container start (default: `true`)
- **`AGENT-REDIRECTION.md`** — guide on how the PreToolUse hook system works, how built-in agents are swapped to custom ones, and what else is possible (prompt injection, model overrides, conditional routing, external service chaining)

### Changed

- **README split by audience** — root `README.md` is now the npm/GitHub landing page (install, prerequisites, what's included, quick start); `.devcontainer/README.md` is now the usage guide (auth, tools, config, agents, keybindings, gotchas). No duplicated content between the two
- **Auto-linter moved to Stop hook** — was PostToolUse (ran pyright per-edit, caused agent re-reads); now batch-lints all edited Python files when Claude stops, matching auto-formatter's pattern. Uses its own temp file (`claude-lint-files-{session_id}`) independent of the formatter pipeline
- **`collect-edited-files.py`** — now writes to both `claude-edited-files-*` (formatter) and `claude-lint-files-*` (linter) temp files, keeping the two Stop hook pipelines independent
- **`.devcontainer/.gitignore`** — added `.secrets` explicit ignore and negation patterns (`!.env.example`, `!.secrets.example`, `!.gitignore`) to override root `.*` rule for files that should be tracked
- **`setup.sh` orchestration** — `setup-auth.sh` runs early (after symlink, before config/plugins) so NPM auth is available for plugin installation
- **`PLUGIN_BLACKLIST`** — cleared (was `"workflow-enhancer,planning-reminder"`)

### Removed

- **`workflow-enhancer` plugin** — deleted entirely (was scaffolding only, never active)
- **`planning-reminder` plugin** — deleted entirely (redundant with Claude Code v2.1+ auto plan mode)

---

## [v1.7.0] - 2026-02-08

### Added

- **ccburn feature** — new devcontainer feature for visual token burn rate tracking with shell aliases and statusline wrapper
- **Session resume widget** — ccstatusline displays copyable `cc --resume {sessionId}` command on line 5
- **Burn rate widget** — ccstatusline line 6 shows live ccburn compact output with pace indicators (session/weekly/sonnet limits)
- **17 custom agent definitions** — code-directive plugin now includes specialized agents: architect, bash-exec, claude-guide, debug-logs, dependency-analyst, doc-writer, explorer, generalist, git-archaeologist, migrator, perf-profiler, refactorer, researcher, security-auditor, spec-writer, statusline-config, test-writer
- **6 new skills** — claude-agent-sdk, git-forensics, performance-profiling, refactoring-patterns, security-checklist, specification-writing
- **Agent redirect hook** — `redirect-builtin-agents.py` (PreToolUse/Task) transparently swaps built-in agent types (Explore→explorer, Plan→architect, etc.) to enhanced custom agents
- **Readonly bash guard** — `guard-readonly-bash.py` blocks write operations for read-only agents
- **Regression test hooks** — `verify-no-regression.py` (PostToolUse for refactorer) and `verify-tests-pass.py` (Stop for test-writer)
- **REVIEW-RUBRIC.md** — quality standards document for agent/skill development
- **Keybindings configuration** — new `config/keybindings.json` with schema support
- **VS Code terminal passthrough** — `Ctrl+P` and `Ctrl+F` pass through to Claude Code via `terminal.integrated.commandsToSkipShell`
- **claude-agent-sdk skill** — new code-directive skill for Claude Agent SDK TypeScript integration
- **OVERWRITE_CONFIG documentation** — documented ephemeral settings behavior
- **Project Manager integration** — `setup-projects.sh` auto-detects projects under `/workspaces/`, watches for changes via inotifywait, maintains `projects.json`
- **Claude config symlink** — `setup-symlink-claude.sh` symlinks `~/.claude` → `$CLAUDE_CONFIG_DIR` for third-party tool compatibility
- **Project Manager VS Code extension** — `alefragnani.project-manager` added to devcontainer

### Changed

- **ccstatusline layout** — expanded from 3→6 lines (13→16 widgets), reorganized into logical groups (core metrics, tokens, git, session, totals, burn rate)
- **ccstatusline version** — bumped from 1.0.0 to 1.1.0
- **Plugin declarations centralized** — all 9 marketplace plugins declared in `enabledPlugins` in `config/settings.json`
- **setup-plugins.sh cache sync** — re-added plugin install loop to sync cache from source on every container start; added `.env` fallback so `PLUGIN_BLACKLIST` works on standalone invocation
- **Feature-level config synced** — `features/claude-code/config/settings.json` mirrors main config (model → `claude-opus-4-6`, `MAX_THINKING_TOKENS` → `63999`, `cleanupPeriodDays` → `60`, all env vars)
- **8 new env vars** — `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY`, `CLAUDE_CODE_MAX_RETRIES`, `BASH_MAX_OUTPUT_LENGTH`, `TASK_MAX_OUTPUT_LENGTH`, `CLAUDE_CODE_PLAN_MODE_INTERVIEW_PHASE`, `CLAUDE_CODE_PLAN_V2_AGENT_COUNT`, `CLAUDE_CODE_PLAN_MODE_REQUIRED`, `CLAUDE_CODE_FORCE_GLOBAL_CACHE`
- **setup-config.sh** — added `chown` for correct ownership; added keybindings.json to copy pipeline
- **setup-aliases.sh** — added idempotency guard
- **TMPDIR consistency** — `setup-update-claude.sh` and `ccstatusline/install.sh` use `${TMPDIR:-/tmp}`
- **installsAfter references** — mcp-qdrant and mcp-reasoner updated from `./features/claude-code` to `ghcr.io/anthropics/devcontainer-features/claude-code:1`
- **code-directive hooks.json** — added PreToolUse/Task hook for agent redirection
- **Auto-linter timeout** — pyright reduced from 55s to 10s
- **Auto-formatter tool paths** — resolved via `which` first
- **Protected-files-guard regex** — tightened `id_rsa` pattern
- **Syntax-validator JSONC regex** — handles URLs containing `://`
- **Skill-suggester keywords** — consolidated claude-agent-sdk phrases; added "compose" to docker
- **redirect-builtin-agents.py fix** — `updatedInput` now preserves all original tool input fields (Claude Code replaces rather than merges)
- **System prompt hardened** — added anti-fabrication rule, failure recovery strategy, and silent-violation guard to `execution_discipline` and `rule_precedence`

### Removed

- **setup-irie-claude.sh** — deleted (personal script, no longer invoked)
- **output-style widget** — removed from ccstatusline (low value)

### Documentation

- **CLAUDE.md** — added keybindings.json, updated plugins list, fixed model name, documented VS Code conflicts, documented OVERWRITE_CONFIG, added agents/skills sections, added new scripts
- **README.md** — fixed max output tokens, added keybindings section, added agents/skills, added project manager
- **features/README.md** — full rewrite listing all features
- **CHANGELOG.md** — squashed v1.6.0 + v1.6.1 into this entry

---

## [v1.5.8] - 2026-02-06

### Changed

- **tmux is now opt-in in VS Code**: Reverted auto-tmux-everywhere approach (forced all terminals into tmux, caused shared-view conflicts and hotkey clashes with Claude Code). Default terminal is plain `bash`. A **"Claude Teams (tmux)"** profile is available from the VS Code terminal dropdown for Agent Teams split-pane sessions. External terminal connectors (WezTerm/iTerm2) are unchanged — they still auto-enter tmux
- **Removed auto-tmux from `.bashrc`/`.zshrc`**: The `exec tmux` block that forced every interactive shell into tmux has been removed from `setup-aliases.sh`

---

## [v1.5.3] - 2026-02-06

### Added

- **Catppuccin Mocha tmux theme**: Replaced barebones tmux config with Catppuccin v2.1.3. Rounded window tabs, Nerd Font icons, transparent status bar, colored pane borders. Installed at build time via shallow git clone (~200KB, ~2s)

### Fixed

- **ccstatusline powerline glyphs**: Powerline separators/caps were empty strings, rendering as underscores. Now uses proper Nerd Font glyphs (U+E0B0, U+E0B4, U+E0B6)
- **Unicode rendering in external terminals**: tmux rendered ALL Unicode as underscores because `docker exec` doesn't propagate locale vars. External terminal scripts now pass `LANG`/`LC_ALL=en_US.UTF-8` and use `tmux -u` to force UTF-8 mode. Locale exports also added to `.bashrc`/`.zshrc` as permanent fallback

### Fixed

- **cc/claude aliases**: Converted from shell functions to simple aliases — functions were not reliably invoked across shell contexts (tmux, docker exec, external terminals), causing Claude to launch without config
- **CLAUDE_CONFIG_DIR export**: Now exported in `.bashrc`/`.zshrc` directly, so credentials are found in all shells (not just VS Code terminals where `remoteEnv` applies)

---

## [v1.5.0] - 2026-02-06

### Added

#### Agent Teams (Experimental)
- **Claude Code Agent Teams**: Enabled via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1"` and `teammateMode: "auto"`
- **System prompt guidance**: Agent Teams section with 3–5 active teammate limit and usage heuristics
- **Task tracking**: `CLAUDE_CODE_ENABLE_TASKS: "true"` for structured task management
- **Effort level**: `CLAUDE_CODE_EFFORT_LEVEL: "high"`

#### Features
- **tmux feature**: Split-pane terminal multiplexer for Agent Teams
  - Pre-configured Catppuccin color palette, mouse support, 10,000-line scrollback
  - Creates `claude-teams` session on container start
- **Biome feature**: Fast JS/TS/JSON/CSS formatter via global `@biomejs/biome` install
- **External terminal connectors**: Bash (`.sh`) and PowerShell (`.ps1`) scripts to connect host terminals to devcontainer tmux sessions
- **Claude Code auto-update**: `setup-update-claude.sh` checks for newer Claude Code native binary on every container start
  - Runs non-blocking in background via `setup.sh`
  - Downloads from GCS, verifies SHA256 checksum, atomic binary replacement
  - Controlled by `SETUP_UPDATE_CLAUDE` env var in `.env` (default: `true`)

#### Plugins
- **code-directive plugin**: Replaces `codedirective-skills` with expanded hook infrastructure
  - **New skill**: `debugging` — Log forensics, Docker log analysis, error pattern recognition
  - **Hooks**: `skill-suggester.py` (UserPromptSubmit, SubagentStart), `syntax-validator.py` + `collect-edited-files.py` (PostToolUse)
  - All 10 existing skills migrated from `codedirective-skills`

#### VS Code Extensions
- `GitHub.vscode-github-actions` — GitHub Actions workflow support
- `fabiospampinato.vscode-todo-plus` — Todo+ task management

### Changed

- **Default model**: Claude Opus 4-5 → **Claude Opus 4-6** (frontier)
- **Max output tokens**: 64,000 → **128,000**
- **Container memory**: 3GB → **4GB** (`--memory-swap` raised to 8GB)
- **External terminal connectors**: Now run as `vscode` user and auto-launch `cc` on new tmux sessions
- **Auto-formatter**: Switched from PostToolUse (`format-file.py`) to Stop hook (`format-on-stop.py`)
  - Added Biome support for JS/TS/CSS alongside existing Black and gofmt
  - Batch-formats all edited files when Claude stops instead of formatting on every edit
- **Auto-linter**: Switched from PostToolUse to Stop hook
- **Agent-browser**: Optimized to install only Chromium (previously installed all Playwright browsers)

### Removed

- **codedirective-skills plugin**: Replaced by `code-directive` (all skills preserved)
- **format-file.py**: Replaced by `format-on-stop.py`
- **`CLAUDE_CODE_SUBAGENT_MODEL`**: Environment variable removed (no longer needed)

### Gitignore

- Added `claude-dev-discord-logs/`, `devforge/`

---

## [v1.4.0] - 2026-02-01

### Breaking

- **Package rename**: `claudepod` → `codeforge-dev` on npm. Install via `npx codeforge-dev`
- **Full rebrand**: All references renamed from ClaudePod/claudepod to CodeForge/codeforge

### Added

#### Plugins
- **codedirective-skills plugin**: 9 coding reference skills for the CodeDirective tech stack
  - `fastapi` - Routing, middleware, SSE, Pydantic models
  - `pydantic-ai` - Agents, tools, models, streaming
  - `svelte5` - Runes, reactivity, components, routing, dnd, LayerCake, AI SDK
  - `sqlite` - Python/JS patterns, schema, pragmas, advanced queries
  - `docker` - Dockerfile patterns, Compose services
  - `docker-py` - Container lifecycle, resources, security
  - `claude-code-headless` - CLI flags, output, SDK/MCP
  - `testing` - FastAPI and Svelte testing patterns
  - `skill-building` - Meta-skill for authoring skills
- **codeforge-lsp plugin**: Replaces `claudepod-lsp` with identical functionality
- **Svelte MCP plugin**: Added `svelte@sveltejs/mcp` to official plugins
- **Plugin blacklist system**: `PLUGIN_BLACKLIST` env var in `.env` to skip plugins during auto-install
  - Parsed by `is_blacklisted()` helper in `setup-plugins.sh`
  - Default: `workflow-enhancer` blacklisted

#### System Prompt
- **`<execution_discipline>`**: Verify before assuming, read before writing, instruction fidelity, verify after writing, no silent deviations
- **`<professional_objectivity>`**: Prioritize technical accuracy over agreement, direct measured language
- **`<structural_search>`**: ast-grep and tree-sitter usage guidance with when-to-use-which
- **Scope discipline**: Modify only what the task requires, trust internal code, prefer inline clarity
- **Continuation sessions**: Re-read source files after compaction, verify state before changes
- **Brevity additions**: No problem restatement, no filler/narrative, no time estimates

#### DevContainer
- **Bun runtime**: Added `ghcr.io/rails/devcontainer/features/bun:1.0.2`
- **Playwright browsers**: Installed via `npx playwright install --with-deps` in agent-browser feature
- **Memory cap**: Container limited to 3GB via `--memory=3g --memory-swap=3g`
- **TMPDIR**: Set to `/workspaces/.tmp`
- **VS Code remote extension**: `wenbopan.vscode-terminal-osc-notifier` configured as UI extension

### Changed

- **Permission model**: `--dangerously-skip-permissions` → `--permission-mode plan --allow-dangerously-skip-permissions`
- **Settings**: `autoCompact: true`, `alwaysThinkingEnabled: true`
- **Autocompact threshold**: 80% → 95%
- **Cleanup period**: 360 days → 60 days
- **Tool search**: Added `ENABLE_TOOL_SEARCH: "auto:5"`
- **Tree-sitter**: Removed Go grammar from defaults
- **Ticket-workflow commands**: Renamed `ticket:` → `ticket꞉` for cross-platform filesystem compatibility
- **notify-hook**: Added empty `matcher` field to hooks.json schema

### Removed

- **claudepod-lsp plugin**: Replaced by `codeforge-lsp`

### Gitignore

- Added `code-directive/`, `article/`, `claude-research/`, `dashboard/`, `simple-review/`, `workflow-enhancer/`

---

## [v1.3.1] - 2025-01-24

### Fixed

- **Plugin installation**: Fixed invalid plugin.json schema causing installation failures
  - Removed `$schema`, `category`, `version`, `lspServers` keys from individual plugin.json files
  - These fields now correctly reside only in `marketplace.json`
- **setup-plugins.sh**: Fixed path resolution for marketplace discovery
  - Changed from `${containerWorkspaceFolder:-.}` to `SCRIPT_DIR` relative path
  - Script now works correctly regardless of working directory

### Changed

- **Consolidated LSP setup**: Merged `setup-lsp.sh` into `setup-plugins.sh`
  - Single script now handles both official and local marketplace plugins
  - Removed `SETUP_LSP` environment variable (no longer needed)
- **settings.json**: Updated Claude Code configuration
  - Increased `MAX_THINKING_TOKENS` from 14999 to 63999
  - Added `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`: 80 (auto-compact at 80% context)
  - Added `CLAUDE_CODE_SHELL`: zsh
  - Added `FORCE_AUTOUPDATE_PLUGINS`: true
  - Added `autoUpdatesChannel`: "latest"

### Removed

- **setup-lsp.sh**: Deleted (functionality consolidated into setup-plugins.sh)

---

## [v1.3.0] - 2025-01-24

### Added

#### Code Quality Hooks
- **dangerous-command-blocker**: PreToolUse hook blocks dangerous bash commands
  - Blocks `rm -rf /`, `rm -rf ~`, `sudo rm`, `chmod 777`
  - Blocks `git push --force` to main/master
  - Blocks writes to system directories (`/usr`, `/etc`, `/bin`)
  - Blocks disk formatting (`mkfs.*`, `dd of=/dev/`)
- **protected-files-guard**: PreToolUse hook blocks modifications to sensitive files
  - Blocks `.env`, `.env.*` environment files
  - Blocks `.git/` directory
  - Blocks lock files (`package-lock.json`, `yarn.lock`, `poetry.lock`, etc.)
  - Blocks certificates/keys (`.pem`, `.key`, `.crt`)
  - Blocks credential files and auth directories (`.ssh/`, `.aws/`)
- **auto-formatter**: PostToolUse hook auto-formats edited files
  - Python files via Black (`/usr/local/py-utils/bin/black`)
  - Go files via gofmt (`/usr/local/go/bin/gofmt`)
- **auto-linter**: PostToolUse hook auto-lints edited files
  - Python files via Pyright with JSON output parsing
- **planning-reminder**: PreToolUse hook encourages plan-before-implement workflow

#### Features
- **notify-hook feature**: Desktop notifications when Claude finishes responding
  - OSC escape sequences for terminal notification support
  - Optional audio bell
  - VS Code extension recommendation for terminal notifications
- **agent-browser feature**: Headless browser automation CLI for AI agents
  - Accessibility tree snapshots for AI navigation
  - Screenshots and PDF capture
  - Element interaction and cookie management
- **Go LSP (gopls)**: Full Go language server support
  - Added `gopls` to codeforge-lsp plugin configuration
  - Added `goplsVersion` option to lsp-servers feature
  - Supports `.go`, `.mod`, `.sum` file extensions
- **Go language**: Added `ghcr.io/devcontainers/features/go:1` feature

#### Plugins
- **ticket-workflow plugin**: EARS-based ticket workflow with GitHub integration
  - `/ticket:new` - Transform requirements into EARS-formatted GitHub issues
  - `/ticket:work` - Create technical implementation plans from tickets
  - `/ticket:review-commit` - Thorough code review with requirements verification
  - `/ticket:create-pr` - Create PRs with aggressive security/architecture review
- **notify-hook plugin**: Claude Code hook integration for completion notifications
- **codeforge-lsp plugin.json**: Proper plugin structure for LSP servers

#### Commands & Aliases
- **ccraw alias**: Runs vanilla Claude Code without any config
  - Bypasses the function override via `command claude`
  - Useful for debugging or running without custom system prompt

#### Documentation
- **System prompt**: Added `<tools_reference>` section with all available tools
- **System prompt**: Added `<browser_automation>` section with usage guidance

### Changed

- **claude command**: Now behaves the same as `cc` (auto-creates local config)
  - Uses `command claude` internally to call the actual binary
  - Both `claude` and `cc` auto-setup `.claude/system-prompt.md` and `.claude/settings.json`
- **Container name**: Now includes project folder name for multi-project clarity
  - Format: `CodeForge - ${localWorkspaceFolderBasename}`
- **setup-lsp.sh**: Replaced hard-coded plugin list with dynamic discovery
  - Now reads all plugins from `marketplace.json` using `jq`
  - Automatically installs new plugins when added to marketplace
- **System prompt**: Updated to use correct Claude Code tool names
  - Fixed plan mode references: `PlanMode` → `EnterPlanMode` / `ExitPlanMode`
  - Added explicit tool names throughout directives
- **Plugin installation**: Reduced from 7 plugins to 1 official plugin (frontend-design skill)

### Removed

- `code-review@claude-plugins-official` (command plugin)
- `commit-commands@claude-plugins-official` (command plugin)
- `pr-review-toolkit@claude-plugins-official` (command + agent plugin)
- `code-simplifier` npx installation block

### Files Created

```
.devcontainer/
├── features/
│   ├── agent-browser/
│   │   ├── devcontainer-feature.json
│   │   ├── install.sh
│   │   └── README.md
│   └── notify-hook/
│       ├── devcontainer-feature.json
│       ├── install.sh
│       └── README.md
└── plugins/devs-marketplace/plugins/
    ├── auto-formatter/
    │   ├── .claude-plugin/plugin.json
    │   ├── hooks/hooks.json
    │   └── scripts/format-file.py
    ├── auto-linter/
    │   ├── .claude-plugin/plugin.json
    │   ├── hooks/hooks.json
    │   └── scripts/lint-file.py
    ├── codeforge-lsp/
    │   └── .claude-plugin/plugin.json
    ├── dangerous-command-blocker/
    │   ├── .claude-plugin/plugin.json
    │   ├── hooks/hooks.json
    │   └── scripts/block-dangerous.py
    ├── notify-hook/
    │   ├── .claude-plugin/plugin.json
    │   └── hooks/hooks.json
    ├── planning-reminder/
    │   ├── .claude-plugin/plugin.json
    │   └── hooks/hooks.json
    ├── protected-files-guard/
    │   ├── .claude-plugin/plugin.json
    │   ├── hooks/hooks.json
    │   └── scripts/guard-protected.py
    └── ticket-workflow/
        └── .claude-plugin/
            ├── plugin.json
            ├── system-prompt.md
            └── commands/
                ├── ticket:new.md
                ├── ticket:work.md
                ├── ticket:review-commit.md
                └── ticket:create-pr.md
```

### Files Modified

- `.devcontainer/devcontainer.json` - Added features, VS Code settings, dynamic name
- `.devcontainer/config/main-system-prompt.md` - Tools reference, browser automation
- `.devcontainer/scripts/setup-aliases.sh` - Claude function override, ccraw alias
- `.devcontainer/scripts/setup-lsp.sh` - Dynamic plugin discovery
- `.devcontainer/scripts/setup-plugins.sh` - Trimmed to frontend-design only
- `.devcontainer/features/lsp-servers/install.sh` - Added gopls installation
- `.devcontainer/features/lsp-servers/devcontainer-feature.json` - Added goplsVersion
- `.devcontainer/plugins/devs-marketplace/.claude-plugin/marketplace.json` - All new plugins
- `.devcontainer/CLAUDE.md` - Updated plugin docs, local marketplace section
- `.devcontainer/README.md` - Added agent-browser, Go to tools tables

---

## [v1.2.3] - 2025-01-19

### Changed
- Added `--force` flag support
- Removed devpod references

---

## [v1.2.0] - 2025-01-19

### Added
- **GitHub CLI**: Added `ghcr.io/devcontainers/features/github-cli:1` feature
- **Official Anthropic Plugins**: New `setup-plugins.sh` script
- **SETUP_PLUGINS** environment variable
- **GitHub CLI Credential Persistence**: `GH_CONFIG_DIR=/workspaces/.gh`
- **README.md**: Comprehensive documentation
- **CLAUDE.md**: Development guide for Claude Code

### Changed
- **Plan Mode Default**: Changed `defaultMode` from `"dontAsk"` to `"plan"`
- **cc Command**: Replaced simple alias with smart function

### Removed
- **Specwright**: Completely removed (setup script, aliases, plugin files, ORCHESTRATOR.md)
