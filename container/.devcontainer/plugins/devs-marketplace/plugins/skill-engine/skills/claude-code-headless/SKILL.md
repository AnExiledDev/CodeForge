---
name: claude-code-headless
description: >-
  Guides non-interactive Claude Code usage via the -p flag, stream-json output
  parsing, and CI/CD pipeline integration. USE WHEN the user asks to "run
  Claude Code in headless mode", "use claude -p for automation", "parse
  stream-json output", "run Claude Code in CI/CD", "track costs
  programmatically", "set up permissions for scripts", or works with
  --output-format stream-json, --permission-mode, --json-schema, --resume.
  DO NOT USE for the TypeScript SDK API — use claude-agent-sdk instead.
version: 0.3.0
effort: high
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
| `--verbose` | **Required with `stream-json`**. Full turn-by-turn JSON to stdout | `--verbose` |
| `--allowedTools` | Auto-approve specific tools (glob patterns) | `--allowedTools "Read" "Bash(git *)"` |
| `--disallowedTools` | Remove tools from model context entirely | `--disallowedTools "Write" "Edit"` |
| `--permission-mode` | Permission behavior preset | `--permission-mode acceptEdits` |

> **CRITICAL — `--verbose` is mandatory with `--output-format stream-json`.**
> Without it, the CLI immediately errors: `Error: When using --print, --output-format=stream-json requires --verbose`.
> This applies to both CLI invocations and programmatic `Bun.spawn`/`child_process.spawn` usage.

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
claude -p "Refactor the database module" --verbose --output-format stream-json | while IFS= read -r line; do
  type=$(echo "$line" | jq -r '.type')
  case "$type" in
    system) ;; # Hook events — skip
    assistant) echo "$line" | jq -r '.message.content[]? | select(.type == "text") | .text' ;;
    result) echo "Cost: $(echo "$line" | jq -r '.total_cost_usd')" ;;
  esac
done
```

### stream-json Gotchas

**1. `--verbose` is mandatory.** See the Key Flags table above. Without it, the process errors immediately.

**2. Event field nesting.** The `assistant` event nests everything under `event.message`:
- Model: `event.message.model` (NOT `event.model`)
- Usage: `event.message.usage.input_tokens` / `.output_tokens` (NOT top-level)
- Content: `event.message.content[]`

The `result` event has top-level fields: `event.total_cost_usd`, `event.structured_output`, `event.subtype`, `event.num_turns`.

**3. `ReadableStream.getReader()` is unreliable for subprocess stdout in long-lived Bun.serve processes.** When spawning Claude as a subprocess inside a Bun HTTP server, `proc.stdout.getReader()` may silently close after reading only a few events — even though the process runs to completion and produces all output. This is a Bun runtime issue with streaming readers in server contexts.

**Fix:** Collect all stdout after the process exits instead of streaming:
```typescript
// BROKEN inside Bun.serve — reader closes prematurely
const reader = proc.stdout.getReader();
while (true) {
  const { done, value } = await reader.read();  // ← may return done=true early
  if (done) break;
}

// WORKS — collect after exit
const exitCode = await proc.exited;
const stdout = await new Response(proc.stdout).text();
for (const line of stdout.split("\n")) {
  const event = JSON.parse(line.trim());
  // process event
}
```

This trades real-time streaming for reliability. If you need real-time progress, emit SSE events based on the process being alive rather than individual stream events.

**4. `system` events from hooks.** With `--verbose`, the stream includes `system` events for hooks (SessionStart, PreToolUse, etc.) before the first `assistant` event. Filter by `event.type === "assistant"` or `event.type === "result"` to skip them.

### jq Filtering Recipes

```bash
# Extract only text output from assistant messages
claude -p "query" --verbose --output-format stream-json \
  | jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "text") | .text'

# Extract tool usage
claude -p "query" --verbose --output-format stream-json \
  | jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "tool_use") | "\(.name): \(.input | tostring)"'

# Get final cost
claude -p "query" --verbose --output-format stream-json \
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

## Data Quality for LLM Analyzers

When using Claude Code headless (`-p`) to build an agent that **analyzes other Claude Code sessions** (conversation logs, behavioral patterns, usage metrics), the quality of analysis depends entirely on how data is presented to the subprocess. These rules prevent the most common failure modes.

### Rule 1: Give Tools, Not Data Dumps

Instead of pre-loading all data into the prompt, provide query commands the agent can call via Bash:

```bash
# BAD — dumps everything into the prompt, wastes tokens, overwhelms the model
claude -p "Here are 500 messages: $(cat messages.json). Analyze them." \
  --allowedTools "Read"

# GOOD — gives the agent tools to explore on its own
claude -p "Use these query commands to explore the session data..." \
  --allowedTools "Bash(bun run scripts/query-db.ts *)" "Read" "Glob" "Grep"
```

Benefits:
- The agent decides what's relevant, not you
- Keeps prompt tokens low
- Scales to any data size
- The agent can drill into interesting areas

### Rule 2: Explain the Data Taxonomy

When an LLM agent processes conversation data, it **MUST** understand the role taxonomy. Claude Code sessions have multiple message types that look similar but carry very different signal:

| Message type | Role | Signal value |
|-------------|------|-------------|
| `user` (string, no system tags) | Human input | **PRIMARY** — preferences, corrections, instructions |
| `user` (string, with `<system-reminder>`) | System injection | **NOISE** — hooks, workspace reminders |
| `user` (array, text blocks only) | Human input | **PRIMARY** — if no system tags in text |
| `user` (array, tool_result only) | Tool plumbing | **NOISE** — tool execution results |
| `assistant` (text blocks) | Claude's response | **CONTEXT** — what user reacted to |
| `assistant` (tool_use blocks) | Claude's actions | **CONTEXT** — workflow patterns |
| `assistant` (thinking blocks) | Internal reasoning | **NOISE** — skip entirely |
| `system` | System hooks | **NOISE** — skip |
| `progress` | Tool execution | **NOISE** — skip |

**Critical distinction:** In a typical 264-message session, only **7 messages** (~3%) are actual human input. The rest is tool plumbing, system injections, and assistant actions. Without taxonomy guidance, the analyzer treats all 264 messages as equally important and produces garbage.

### Rule 3: Distinguish AI-Generated from Human-Authored Content

Plans, specs, and proposals submitted by the user were typically **AI-generated in a previous session**. The user approved them, but didn't write them:

```
# This is a user message, but the PLAN CONTENT is AI-generated:
"Implement the following plan:\n\n# Feature X\n\n## Context\n..."
```

The behavioral signal is: "user uses a plan-first workflow" — NOT the plan's content, structure, or technical decisions. Never attribute AI writing style to the user.

### Rule 4: Comprehensive Prompts Beat Ambiguous Ones

For analysis tasks, a detailed prompt with explicit guidance produces far better results than a terse one. Include:

- **What good output looks like** — concrete examples of correct analysis
- **What bad output looks like** — explicit anti-patterns with explanations
- **Category definitions** — with concrete signals to look for in each
- **Evidence requirements** — what counts as evidence, what doesn't
- **Quality gates** — when to return empty results vs forcing observations

A 3000-token prompt that produces 5 high-quality observations is better than a 500-token prompt that produces 20 garbage observations.

---

## Ambiguity Policy

These defaults apply when the user does not specify a preference. State the assumption when applying a default:

- **System prompt:** `--append-system-prompt` over `--system-prompt` to preserve built-in behaviors
- **Output format:** `--output-format json` for scripts; `--verbose --output-format stream-json` when event-level access is needed (both flags required)
- **Model:** `sonnet` for automation tasks (balanced cost and capability)
- **Permission mode:** `--permission-mode acceptEdits` for trusted pipelines; `plan` for read-only analysis
- **Session persistence:** `--no-session-persistence` in CI/CD unless session continuation is required
- **SDK system prompt:** `{ type: "preset", preset: "claude_code", append: "..." }` to preserve defaults

---

## Reference Files

| File | Contents |
|------|----------|
| `references/cli-flags-and-output.md` | Complete flag reference, `stream-json` event type catalog with TypeScript types, JSON output schema, jq recipes, `--input-format stream-json` chaining, environment variables, `--verbose` requirement for `stream-json`, and `--debug` flags |
| `references/sdk-and-mcp.md` | TypeScript and Python SDK full options, `canUseTool` callback, `ClaudeSDKClient` multi-turn, `createSdkMcpServer` custom tools, `--mcp-config`, `--permission-prompt-tool`, `--agents` subagent definitions, session continuation patterns |
