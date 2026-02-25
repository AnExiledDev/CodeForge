# git-workflow

Claude Code plugin that provides standalone git workflow commands. Not tied to the EARS ticket lifecycle — works independently, but optionally links to tickets when context exists.

## What It Does

Provides two slash commands for shipping code and reviewing pull requests.

### Slash Commands

| Command | Description |
|---------|-------------|
| `/ship` | Review all changes, commit with a detailed message, push, and optionally create a PR |
| `/pr:review` | Review an existing PR by number/URL or auto-detect from current branch (never merges) |

## How It Works

### `/ship` Workflow

```text
/ship [optional commit message hint]
  │
  └─→ Gather context (git status, diff, branch, project rules)
       │
       └─→ Full review (security, rules, quality, architecture, tests)
            │
            └─→ Present findings → User decisions (fix/issue/ignore)
                 │
                 └─→ Draft commit message → User approval
                      │
                      └─→ Commit + Push
                           │
                           └─→ AskUserQuestion: "Create a PR?"
                                │
                                ├─→ Yes: Create PR (+ link ticket if context exists)
                                └─→ No: Done
```

### `/pr:review` Workflow

```text
/pr:review [PR number, URL, or omit for auto-detect]
  │
  └─→ Identify target PR (argument, auto-detect, or ask)
       │
       └─→ Fetch PR details + diff + changed files
            │
            └─→ Aggressive analysis (attack surface, threats, deps, rules, architecture, quality, tests, breaking changes)
                 │
                 └─→ Present findings → User decisions (note/issue/ignore)
                      │
                      └─→ Post review comment (NEVER approve/merge)
```

### Ticket Awareness

Both commands are **optionally ticket-aware**:
- If a ticket number exists in the session context (from a prior `/ticket:work` call), it is linked in commit messages, PRs, and issue comments
- If reviewing a PR that references a ticket in its body (`Closes #N`, `Refs #N`), requirements are verified against the diff
- Neither command prompts for a ticket — they work fully standalone

### Review Depth

| Command | Review Depth | Purpose |
|---------|-------------|---------|
| `/ship` | Full (same as `/ticket:review-commit`) | Pre-commit gate — catches issues before they enter history |
| `/pr:review` | Aggressive (same as `/ticket:create-pr`) | Final gate — deep security, threat modeling, and architecture review |

### Finding Severity Levels

| Level | Meaning |
|-------|---------|
| Critical | Active vulnerability, data exposure, auth bypass, breaking production |
| High | Security weakness, significant bug, major pattern violation |
| Medium | Code smell, minor vulnerability, missing validation |
| Low | Style, optimization, minor improvements |
| Info | Observations, questions, future considerations |

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
       "git-workflow@<clone-path>/.devcontainer/plugins/devs-marketplace": true
     }
   }
   ```

   Replace `<clone-path>` with the absolute path to your CodeForge clone.

## Plugin Structure

```text
git-workflow/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata
├── skills/
│   ├── ship/
│   │   └── SKILL.md         # /ship command definition
│   └── pr-review/
│       └── SKILL.md         # /pr:review command definition
└── README.md                # This file
```

## Requirements

- Claude Code with plugin command support
- [GitHub CLI](https://cli.github.com/) (`gh`) installed and authenticated
- A GitHub repository as the working context
