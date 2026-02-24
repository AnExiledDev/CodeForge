# Prompt Snippets Plugin

Quick behavioral mode switches via a single `/ps` slash command.

## Usage

```
/ps [snippet-name]
```

Type `/ps` followed by a snippet name to inject a behavioral directive for the remainder of the conversation.

### Available Snippets

| Snippet | What it does |
|---------|-------------|
| `noaction` | Investigate and report only — no edits, no commands |
| `brief` | Concise answers, no filler |
| `plan` | Plan first, don't implement until approved |
| `go` | Proceed without confirmation prompts |
| `review` | Audit only — report findings, don't modify |
| `ship` | Commit, push, and create a PR |
| `deep` | Thorough investigation, leave no stone unturned |
| `hold` | Do the work but don't commit or push |
| `recall` | Search session history with ccms for prior context |
| `wait` | When done, stop — no suggestions or follow-ups |

### Composing

Combine snippets by listing multiple names:

```
/ps noaction brief
```

## Design

This plugin contains a single skill (`/ps`) that uses `$ARGUMENTS` as a lookup key into a snippet table. It is:

- **Not auto-suggested** — `disable-model-invocation: true` keeps it out of the skill engine's auto-suggestion system
- **Independently toggleable** — disable via `enabledPlugins` in `settings.json` without affecting other skills
- **Extensible** — add a row to the table in `skills/ps/SKILL.md` to create new snippets

## Adding Custom Snippets

Edit `skills/ps/SKILL.md` and add a row to the "Available Snippets" table:

```markdown
| `mysnippet` | Your custom instruction here. |
```

No other files need to change.
