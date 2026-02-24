# spec-workflow

Claude Code plugin that manages the full specification lifecycle: creating, refining, building, reviewing, updating, and auditing feature specs. Includes an advisory hook that reminds about spec updates when code changes but specs don't.

## What It Does

Two capabilities:

1. **Spec lifecycle skills** — 8 skills that cover the complete journey from bootstrapping a `.specs/` directory to closing out an as-built spec after implementation.

2. **Spec reminder hook** — A `Stop` hook that fires when source code was modified but no `.specs/` files were updated, advising Claude to run `/spec-update`.

### Skill Catalog

| Skill | Slash Command | Purpose |
|-------|---------------|---------|
| spec-init | `/spec-init` | Bootstrap `.specs/` directory with BACKLOG.md, MILESTONES.md, ROADMAP.md |
| spec-new | `/spec-new` | Create a new feature spec from EARS template |
| spec-refine | `/spec-refine` | Validate assumptions with user, upgrade requirements to `[user-approved]` |
| spec-build | `/spec-build` | Orchestrate full implementation: plan, build, review, close |
| spec-check | `/spec-check` | Audit all specs for health issues |
| spec-review | `/spec-review` | Verify implementation against a spec |
| spec-update | `/spec-update` | As-built closure: update spec to match implementation |
| specification-writing | `/skill specification-writing` | Domain knowledge for writing high-quality specs |

### Spec Lifecycle

```
/spec-init          Bootstrap .specs/ directory
     |
/spec-new           Create feature spec (draft, [assumed] requirements)
     |
/spec-refine        Validate with user -> [user-approved] requirements
     |
/spec-build         5-phase implementation orchestration:
     |                Phase 1: Discovery
     |                Phase 2: Planning
     |                Phase 3: Building ([ ] -> [~])
     |                Phase 4: Review   ([~] -> [x])
     |                Phase 5: Closure  (as-built update)
     |
/spec-review        Standalone verification (post-change audits)
     |
/spec-update        Manual as-built closure
     |
/spec-check         Health audit across all specs
```

### Acceptance Criteria Markers

| Marker | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[~]` | Implemented, not yet verified |
| `[x]` | Verified — tests pass, behavior confirmed |

### Approval and Requirement Tags

- `**Approval:** draft` — Spec is in draft, not ready for implementation
- `**Approval:** user-approved` — Spec reviewed and approved by user
- `[assumed]` — Requirement inferred by Claude, needs validation
- `[user-approved]` — Requirement explicitly approved by user

## How It Works

### Hook Lifecycle

```
Claude stops responding (Stop event)
  |
  +-> Stop fires
        |
        +-> spec-reminder.py
              |
              +-> .specs/ directory exists?
              |     |
              |     +-> No -> Silent exit (no output)
              |     +-> Yes -> Continue
              |
              +-> Source code modified this session?
              |     |
              |     +-> No -> Silent exit
              |     +-> Yes -> Continue
              |
              +-> .specs/ files also modified?
                    |
                    +-> Yes -> Silent exit (already updated)
                    +-> No -> Inject advisory: "Run /spec-update"
```

### Monitored Source Directories

The spec reminder watches for changes in these directories:

`src/`, `lib/`, `app/`, `pkg/`, `internal/`, `cmd/`, `tests/`, `api/`, `frontend/`, `backend/`, `packages/`, `services/`, `components/`, `pages/`, `routes/`

### Exit Code Behavior

| Exit Code | Meaning |
|-----------|---------|
| 0 | Advisory injected (or silent — no action needed) |

The hook never blocks operations.

### Error Handling

| Scenario | Behavior |
|----------|----------|
| No `.specs/` directory | Silent exit |
| Not a git repository | Silent exit |
| JSON parse failure | Silent exit |

### Timeouts

| Hook | Timeout |
|------|---------|
| Spec reminder (Stop) | 8s |

## Installation

### CodeForge DevContainer

Pre-installed and activated automatically — no setup needed.

### From GitHub

Use this plugin in any Claude Code setup:

1. Clone the [CodeForge](https://github.com/AnExiledDev/CodeForge) repository:

   ```bash
   git clone https://github.com/AnExiledDev/CodeForge.git
   ```

2. Enable the plugin in your `.claude/settings.json`:

   ```json
   {
     "enabledPlugins": {
       "spec-workflow@<clone-path>/.devcontainer/plugins/devs-marketplace": true
     }
   }
   ```

   Replace `<clone-path>` with the absolute path to your CodeForge clone.

## Plugin Structure

```
spec-workflow/
+-- .claude-plugin/
|   +-- plugin.json                     # Plugin metadata
+-- hooks/
|   +-- hooks.json                      # Stop hook registration
+-- scripts/
|   +-- spec-reminder.py                # Spec update advisory (Stop)
+-- skills/
|   +-- spec-init/                      # Bootstrap .specs/ directory
|   |   +-- SKILL.md
|   |   +-- references/
|   |       +-- backlog-template.md
|   |       +-- milestones-template.md
|   |       +-- roadmap-template.md
|   +-- spec-new/                       # Create new feature spec
|   |   +-- SKILL.md
|   |   +-- references/
|   |       +-- template.md
|   +-- spec-refine/                    # Validate assumptions with user
|   |   +-- SKILL.md
|   +-- spec-build/                     # Full implementation orchestration
|   |   +-- SKILL.md
|   |   +-- references/
|   |       +-- review-checklist.md
|   +-- spec-check/                     # Spec health audit
|   |   +-- SKILL.md
|   +-- spec-review/                    # Implementation verification
|   |   +-- SKILL.md
|   +-- spec-update/                    # As-built closure
|   |   +-- SKILL.md
|   +-- specification-writing/          # Domain knowledge skill
|       +-- SKILL.md
|       +-- references/
|           +-- criteria-patterns.md
|           +-- ears-templates.md
+-- README.md                           # This file
```

## Requirements

- Python 3.11+
- Git (for detecting file changes)
- Claude Code with plugin hook support (skills)
