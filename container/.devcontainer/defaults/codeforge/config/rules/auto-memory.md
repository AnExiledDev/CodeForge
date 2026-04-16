# Auto Memory Usage

Use the auto-memory system to persist important information across sessions.
Memory files live in the configured memory directory with YAML frontmatter.

## Constraints

- **Max 100 lines per memory file.** Keep memories focused and actionable.
- **Timestamp all memories.** Include `added: YYYY-MM-DD` in frontmatter.
- **Prune stale memories.** When adding new memories, remove older ones that
  are no longer relevant or have been superseded.
- **Refresh active memories.** When updating an existing memory, update its
  `added` date to the current date — this signals it's still actively needed.

## File Format

```markdown
---
name: descriptive-slug
description: One-line summary
type: user|feedback|project|reference|workflow
added: 2026-04-16
---

Content here. Be specific and actionable.
```

## Memory Types

| Type | When to Save |
|------|--------------|
| `user` | Role, expertise, preferences, accessibility needs |
| `feedback` | Behavioral corrections from the user |
| `project` | Undocumented architecture decisions, tribal knowledge |
| `reference` | Working configs, API patterns, hard-won solutions |
| `workflow` | Tool preferences, process patterns, recurring workflows |

## Mandatory Behaviors

1. **Session start:** Read `MEMORY.md` to load cross-session context.
2. **Before recommendations:** Check if relevant memories exist.
3. **When user repeats themselves:** Check if you should already know this.
4. **Before citing a memory:** Verify referenced files/APIs still exist.
5. **On stale observation:** Update or delete the memory immediately.

## What NOT to Save

- Code patterns or snippets (reference files instead)
- Git history or commit details (use git tools)
- Debugging solutions for transient issues
- Anything already in CLAUDE.md, README, or project docs
- Session-specific ephemeral state
- Information derivable from the codebase in seconds

## MEMORY.md Index

`MEMORY.md` is the index file containing one-line pointers to each memory
(max ~200 lines). When saving a memory:

1. Write the memory file
2. Update `MEMORY.md` with a pointer line
