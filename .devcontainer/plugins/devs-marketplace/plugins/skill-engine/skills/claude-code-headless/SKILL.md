---
name: claude-code-headless
description: >-
  This skill should be used when the user asks to "run Claude Code in headless mode",
  "use claude -p for automation", "parse stream-json output from Claude Code",
  "use the Claude Agent SDK", "run Claude Code in CI/CD",
  "configure MCP servers for headless Claude",
  "set up Claude Code permissions for scripts",
  "track Claude Code costs programmatically", or discusses Claude Code
  print mode, non-interactive pipelines, SDK integration in TypeScript or Python,
  structured output with json-schema, or session management for automation.
version: 0.1.0
---

# Claude Code Headless

## Mental Model

Claude Code is a programmable coding agent. The `-p` (print) flag converts the interactive REPL into a single-shot pipeline tool. The same agentic loop runs — reading files, executing commands, editing code — but the interface is a non-interactive stream rather than a terminal UI.

Three output formats control how results are delivered:
- **`text`** — plain text for human consumption (default)
- **`json`** — a single JSON object with the result and metadata, emitted after completion
- **`stream-json`** — newline-delimited JSON events emitted in real time as the agent works

The `-p` flag is the foundation. Everything else — output format, permission mode, tool restrictions, session continuation — layers on top to control what the agent can do, what it produces, and how it interacts with the environment.

---

## Print Mode Basics

The core invocation is `claude -p "prompt"`. Input can also be piped via stdin:

```bash
# Direct prompt
claude -p "Explain the authentication flow in this project"

# Piped input
cat error.log | claude -p "Diagnose the root cause of these errors"

# File content as context
claude -p "Review this code for security issues" < src/auth.py
```

### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--model` | Model selection (alias or full name) | `--model sonnet` |
| `--max-turns` | Limit agentic turns; exits with error at limit | `--max-turns 10` |
| `--max-budget-usd` | Maximum dollar spend for the invocation | `--max-budget-usd 5.00` |
| `--output-format` | Output format: `text`, `json`, `stream-json` | `--output-format json` |
| `--verbose` | Full turn-by-turn output to stderr | `--verbose` |
| `--allowedTools` | Auto-approve specific tools (glob patterns) | `--allowedTools "Read" "Bash(git *)"` |
| `--disallowedTools` | Remove tools from model context entirely | `--disallowedTools "Write" "Edit"` |
| `--permission-mode` | Permission behavior preset | `--permission-mode acceptEdits` |

### System Prompt Flags

| Flag | Behavior | Recommendation |
|------|----------|----------------|
| `--system-prompt` | Replaces the entire default system prompt | Full control, but loses built-in capabilities |
| `--append-system-prompt` | Appends to the default system prompt | Preferred — adds instructions while preserving defaults |
| `--system-prompt-file` | Replaces with file contents (print mode only) | For version-controlled prompts |
| `--append-system-prompt-file` | Appends file contents (print mode only) | For version-controlled additions |

`--append-system-prompt` is the recommended approach for most automation. It preserves Claude Code's built-in tool usage patterns and project awareness while adding custom instructions.

> **Deep dive:** See `references/cli-flags-and-output.md` for the complete flag reference, environment variables, `--debug` categories, `--input-format stream-json` for chaining, and `--fallback-model` for overload resilience.

---

## Output Formats

### text (Default)

Plain text output. Suitable for human-readable results and simple shell pipelines:

```bash
claude -p "What does the main function do?" --output-format text
```

### json

A single JSON object emitted after the agent completes. Contains the result, cost, usage, and session metadata:

```bash
result=$(claude -p "Fix the type error in utils.ts" --output-format json)
echo "$result" | jq '.result'
echo "$result" | jq '.total_cost_usd'
```

The JSON output includes `result` (text), `session_id`, `is_error`, `total_cost_usd`, `num_turns`, `duration_ms`, and `usage` fields.

### stream-json

Newline-delimited JSON events emitted in real time. Each line is a JSON object with a `type` field. The event sequence is:

```text
system (init) → assistant/user messages (interleaved) → result (final)
```

```bash
claude -p "Refactor the database module" --output-format stream-json | while IFS= read -r line; do
  type=$(echo "$line" | jq -r '.type')
  case "$type" in
    system) echo "Session: $(echo "$line" | jq -r '.session_id')" ;;
    assistant) echo "$line" | jq -r '.message.content[]? | select(.type == "text") | .text' ;;
    result) echo "Cost: $(echo "$line" | jq -r '.total_cost_usd')" ;;
  esac
done
```

### jq Filtering Recipes

```bash
# Extract only text output from assistant messages
claude -p "query" --output-format stream-json \
  | jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "text") | .text'

# Extract tool usage
claude -p "query" --output-format stream-json \
  | jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "tool_use") | "\(.name): \(.input | tostring)"'

# Get final cost
claude -p "query" --output-format stream-json \
  | jq -r 'select(.type == "result") | "Cost: $\(.total_cost_usd) | Turns: \(.num_turns)"'
```

### Structured Output with --json-schema

Force the final response to conform to a JSON Schema:

```bash
claude -p "Extract all API endpoints from this project" \
  --output-format json \
  --json-schema '{
    "type": "object",
    "properties": {
      "endpoints": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "method": {"type": "string"},
            "path": {"type": "string"},
            "description": {"type": "string"}
          },
          "required": ["method", "path"]
        }
      }
    },
    "required": ["endpoints"]
  }'
```

The `structured_output` field in the result contains the validated JSON. Validation failures trigger retries up to a configurable limit.

> **Deep dive:** See `references/cli-flags-and-output.md` for the complete `stream-json` event type catalog with TypeScript type definitions, the full JSON output schema, and `--input-format stream-json` for pipeline chaining.

---

## Permissions and Tools

### Tool Control

Three flags control tool availability:

| Flag | Effect |
|------|--------|
| `--allowedTools` | Auto-approve matching tools (no permission prompt). Supports prefix/glob matching |
| `--disallowedTools` | Remove tools from model context entirely — the model cannot see or use them |
| `--tools` | Restrict the set of available tools. `""` = none, `"default"` = all built-in |

```bash
# Read-only analysis — no file modifications
claude -p "Analyze code quality" \
  --allowedTools "Read" "Glob" "Grep" "Bash(git log *)" \
  --disallowedTools "Write" "Edit"

# Full automation — approve all edits
claude -p "Fix all lint errors" \
  --allowedTools "Read" "Write" "Edit" "Bash"
```

### Permission Modes

| Mode | Behavior |
|------|----------|
| `default` | Standard prompting for sensitive operations |
| `acceptEdits` | Auto-accept file edits; prompt for bash commands |
| `plan` | Planning mode — read-only, no execution |
| `bypassPermissions` | Skip all permission checks (requires `--dangerously-skip-permissions`) |

For trusted automation pipelines, `--permission-mode acceptEdits` combined with `--allowedTools` for specific bash commands provides a safe middle ground.

---

## Agent SDK

The Claude Agent SDK provides programmatic access to the Claude Code agentic loop from TypeScript and Python.

### TypeScript

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const messages = query({
  prompt: "Find and fix the bug in auth.py",
  options: {
    allowedTools: ["Read", "Edit", "Bash"],
    permissionMode: "acceptEdits",
    model: "sonnet",
    maxTurns: 20,
    maxBudgetUsd: 2.0,
    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append: "Focus on security best practices.",
    },
  },
});

for await (const message of messages) {
  if (message.type === "assistant") {
    for (const block of message.message.content) {
      if ("text" in block) process.stdout.write(block.text);
    }
  } else if (message.type === "result") {
    console.log(`\nDone: ${message.subtype} | Cost: $${message.total_cost_usd}`);
  }
}
```

### Python

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="Find and fix the bug in auth.py",
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Edit", "Bash"],
            permission_mode="acceptEdits",
            model="sonnet",
            max_turns=20,
            max_budget_usd=2.0,
            system_prompt={"type": "preset", "preset": "claude_code", "append": "Focus on security."},
        ),
    ):
        if hasattr(message, "content"):
            for block in message.content:
                if hasattr(block, "text"):
                    print(block.text, end="")
        elif hasattr(message, "total_cost_usd"):
            print(f"\nDone: {message.subtype} | Cost: ${message.total_cost_usd}")

asyncio.run(main())
```

The `query()` function returns an async iterator of SDK messages. The `systemPrompt` preset `"claude_code"` preserves the default system prompt; the `append` field adds custom instructions.

> **Deep dive:** See `references/sdk-and-mcp.md` for the full SDK options reference, `canUseTool` callback patterns, `ClaudeSDKClient` for multi-turn sessions, custom MCP tools with `createSdkMcpServer`, and `--permission-prompt-tool` for non-interactive permission handling.

---

## Session Management

Sessions persist conversation context across invocations. Capture the session ID from JSON output and use it to continue work:

```bash
# First invocation — capture session ID
session_id=$(claude -p "Read the auth module and identify issues" \
  --output-format json | jq -r '.session_id')

# Continue with the same context
claude -p "Now fix the issues identified" \
  --resume "$session_id" \
  --output-format json
```

| Flag | Behavior |
|------|----------|
| `--continue`, `-c` | Resume the most recent session in the current directory |
| `--resume`, `-r` | Resume a specific session by ID or name |
| `--session-id` | Use a specific UUID as the session ID |
| `--fork-session` | Create a new session ID when resuming (preserves context, diverges history) |
| `--no-session-persistence` | Do not save the session to disk (ephemeral, print mode only) |

For automation scripts that do not need session replay, `--no-session-persistence` avoids accumulating session files.

---

## CI/CD Patterns

### Basic CI Invocation

```bash
#!/bin/bash
set -euo pipefail

result=$(claude -p "Review the changes in this PR for bugs and security issues" \
  --output-format json \
  --model sonnet \
  --max-turns 15 \
  --max-budget-usd 3.00 \
  --permission-mode plan \
  --allowedTools "Read" "Glob" "Grep" "Bash(git diff *)" "Bash(git log *)" \
  --no-session-persistence)

is_error=$(echo "$result" | jq -r '.is_error')
cost=$(echo "$result" | jq -r '.total_cost_usd')
review=$(echo "$result" | jq -r '.result')

echo "Cost: \$${cost}"
if [ "$is_error" = "true" ]; then
  echo "Error during review"
  exit 1
fi
echo "$review"
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | API key for authentication |
| `ANTHROPIC_MODEL` | Default model (overridden by `--model`) |
| `CLAUDE_CODE_USE_BEDROCK` | Set to `1` for Amazon Bedrock provider |
| `CLAUDE_CODE_USE_VERTEX` | Set to `1` for Google Vertex AI provider |

### Cost Tracking

The `result` message (both JSON and stream-json) includes cost fields:

```json
{
  "total_cost_usd": 0.042,
  "duration_ms": 15230,
  "duration_api_ms": 12100,
  "num_turns": 5,
  "usage": {
    "inputTokens": 12500,
    "outputTokens": 3200,
    "cacheReadInputTokens": 8000,
    "cacheCreationInputTokens": 4500
  }
}
```

The `modelUsage` field (stream-json) breaks down cost per model when fallback models are used. Track `total_cost_usd` across invocations for budget monitoring.

### Error Handling

| Exit Condition | `is_error` | `subtype` |
|---------------|-----------|-----------|
| Successful completion | `false` | `success` |
| Max turns reached | `true` | `error_max_turns` |
| Budget exceeded | `true` | `error_max_budget_usd` |
| Runtime error | `true` | `error_during_execution` |
| Schema validation retries exhausted | `true` | `error_max_structured_output_retries` |

Check `is_error` and `subtype` to determine whether the invocation completed successfully and route failures appropriately.

---

## Ambiguity Policy

These defaults apply when the user does not specify a preference. State the assumption when applying a default:

- **System prompt:** `--append-system-prompt` over `--system-prompt` to preserve built-in behaviors
- **Output format:** `--output-format json` for scripts; `stream-json` when real-time display is needed
- **Model:** `sonnet` for automation tasks (balanced cost and capability)
- **Permission mode:** `--permission-mode acceptEdits` for trusted pipelines; `plan` for read-only analysis
- **Session persistence:** `--no-session-persistence` in CI/CD unless session continuation is required
- **SDK system prompt:** `{ type: "preset", preset: "claude_code", append: "..." }` to preserve defaults

---

## Reference Files

| File | Contents |
|------|----------|
| `references/cli-flags-and-output.md` | Complete flag reference, `stream-json` event type catalog with TypeScript types, JSON output schema, jq recipes, `--input-format stream-json` chaining, environment variables, `--verbose` and `--debug` flags |
| `references/sdk-and-mcp.md` | TypeScript and Python SDK full options, `canUseTool` callback, `ClaudeSDKClient` multi-turn, `createSdkMcpServer` custom tools, `--mcp-config`, `--permission-prompt-tool`, `--agents` subagent definitions, session continuation patterns |
