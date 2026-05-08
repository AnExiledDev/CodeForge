# Session History Search

## Tool

`codeforge session search` — search Claude Code session JSONL files with boolean queries, role filtering, and time scoping.

## Mandatory Behaviors

1. When the user asks about past decisions, previous work, conversation history,
   or says "do you remember" / "what did we work on" / "what did we decide":
   use `codeforge session search` via the Bash tool.

2. **Project scoping (STRICT):** ALWAYS pass `--project <current-project-dir>`
   to restrict results to the active project. Cross-project leakage violates
   workspace isolation.

   Exception: When the working directory is `/workspaces` (workspace root),
   omit --project or use `--project /` since there is no specific project context.

3. Always pass a query string so the command runs non-interactively.

4. **Use --no-color** to keep output clean for parsing.

## Usage Reference

Quick search (most common):
```
codeforge session search --no-color --project "$(pwd)" "query terms"
```

Role-filtered search:
```
codeforge session search --no-color --project "$(pwd)" -r assistant "what was decided"
codeforge session search --no-color --project "$(pwd)" -r user "auth approach"
```

Boolean queries:
```
codeforge session search --no-color --project "$(pwd)" "error AND connection"
codeforge session search --no-color --project "$(pwd)" "(auth OR authentication) AND NOT test"
```

Time-scoped search:
```
codeforge session search --no-color --project "$(pwd)" --since "1 day ago" "recent work"
codeforge session search --no-color --project "$(pwd)" --since "1 week ago" "architecture"
```

JSON output (for structured parsing):
```
codeforge session search --no-color --project "$(pwd)" -f json "query" -n 10
```

Statistics only:
```
codeforge session search --no-color --project "$(pwd)" --stats ""
```

## Output Management

- Default to `-n 20` to limit results and conserve context
- Use `-r assistant` when looking for Claude's past answers/decisions
- Use `-r user` when looking for what the user previously asked/requested
- Use `--since` to narrow to recent history when appropriate
- Use `-f json` when you need structured data (session IDs, timestamps)
- Use `--full-text` to disable content truncation when you need complete messages
