# Session History Search

## Tool

`ccms` — high-performance CLI for searching Claude Code session JSONL files.

## Mandatory Behaviors

1. When the user asks about past decisions, previous work, conversation history,
   or says "do you remember" / "what did we work on" / "what did we decide":
   use `ccms` via the Bash tool.

2. **Project scoping (STRICT):** ALWAYS pass `--project <current-project-dir>`
   to restrict results to the active project. Cross-project leakage violates
   workspace isolation.

   Exception: When the working directory is `/workspaces` (workspace root),
   omit --project or use `--project /` since there is no specific project context.

3. **CLI mode only.** Always pass a query string so ccms runs non-interactively.
   Never launch bare `ccms` (TUI mode) from a Bash tool call.

4. **Use --no-color** to keep output clean for parsing.

## Usage Reference

Quick search (most common):
```
ccms --no-color --project "$(pwd)" "query terms"
```

Role-filtered search:
```
ccms --no-color --project "$(pwd)" -r assistant "what was decided"
ccms --no-color --project "$(pwd)" -r user "auth approach"
```

Boolean queries:
```
ccms --no-color --project "$(pwd)" "error AND connection"
ccms --no-color --project "$(pwd)" "(auth OR authentication) AND NOT test"
```

Time-scoped search:
```
ccms --no-color --project "$(pwd)" --since "1 day ago" "recent work"
ccms --no-color --project "$(pwd)" --since "1 week ago" "architecture"
```

JSON output (for structured parsing):
```
ccms --no-color --project "$(pwd)" -f json "query" -n 10
```

Statistics only:
```
ccms --no-color --project "$(pwd)" --stats ""
```

## Output Management

- Default to `-n 20` to limit results and conserve context
- Use `-r assistant` when looking for Claude's past answers/decisions
- Use `-r user` when looking for what the user previously asked/requested
- Use `--since` to narrow to recent history when appropriate
- Use `-f json` when you need structured data (session IDs, timestamps)
