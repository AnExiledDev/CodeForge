# CLI Flags and Output — Deep Dive

## 1. Complete Flag Reference

### Core Flags

| Flag | Description | Print Mode | Interactive |
|------|-------------|:----------:|:-----------:|
| `-p`, `--print` | Non-interactive mode; emit result and exit | Required | — |
| `--output-format` | `text`, `json`, `stream-json` | Yes | No |
| `--input-format` | `text`, `stream-json` (for pipeline chaining) | Yes | No |
| `--model` | Model alias (`sonnet`, `opus`, `haiku`) or full name | Yes | Yes |
| `--fallback-model` | Auto-fallback when primary model is overloaded | Yes | No |
| `--max-turns` | Maximum agentic turns; exits with error at limit | Yes | No |
| `--max-budget-usd` | Maximum dollar spend for the invocation | Yes | No |
| `--verbose` | Full turn-by-turn output to stderr | Yes | Yes |
| `--debug` | Debug logging with optional category filter | Yes | Yes |

### Tool and Permission Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--allowedTools` | Auto-approve matching tools (prefix/glob) | `"Read" "Bash(git *)"` |
| `--disallowedTools` | Remove tools from model context entirely | `"Write" "Edit"` |
| `--tools` | Restrict available tool set; `""` = none, `"default"` = all | `"Bash,Read,Glob"` |
| `--permission-mode` | `default`, `acceptEdits`, `plan`, `bypassPermissions` | `acceptEdits` |
| `--dangerously-skip-permissions` | Skip all permission prompts | — |
| `--permission-prompt-tool` | MCP tool name for non-interactive permission handling | `mcp_auth_tool` |

### System Prompt Flags

| Flag | Behavior | Modes |
|------|----------|-------|
| `--system-prompt` | Replace entire default system prompt | Print + Interactive |
| `--system-prompt-file` | Replace with file contents | Print only |
| `--append-system-prompt` | Append to default system prompt | Print + Interactive |
| `--append-system-prompt-file` | Append file contents to default prompt | Print only |

`--system-prompt` and `--system-prompt-file` are mutually exclusive. Append flags can combine with either replacement flag.

### Session Flags

| Flag | Description |
|------|-------------|
| `-c`, `--continue` | Resume most recent session in current directory |
| `-r`, `--resume` | Resume specific session by ID or name |
| `--session-id` | Use a specific UUID as the session ID |
| `--fork-session` | Create new session ID when resuming (preserves context, diverges history) |
| `--no-session-persistence` | Do not save session to disk (print mode only) |

### Output Control Flags

| Flag | Description |
|------|-------------|
| `--json-schema` | JSON Schema for structured output validation |
| `--include-partial-messages` | Include `stream_event` deltas (requires `stream-json`) |
| `--replay-user-messages` | Re-emit user messages on stdout (requires `stream-json` input and output) |

### Configuration Flags

| Flag | Description |
|------|-------------|
| `--mcp-config` | Load MCP servers from JSON file or string |
| `--strict-mcp-config` | Only use MCP servers from `--mcp-config`, ignore all others |
| `--agents` | Define custom subagents via JSON |
| `--settings` | Path to settings JSON file or inline JSON string |
| `--setting-sources` | Comma-separated: `user`, `project`, `local` |
| `--add-dir` | Add additional working directories |
| `--betas` | Beta feature headers (API key users only) |

---

## 2. JSON Output Schema

When using `--output-format json`, the response is a single JSON object:

```json
{
  "type": "result",
  "subtype": "success",
  "session_id": "abc123-def456-...",
  "is_error": false,
  "result": "The text content of Claude's final response",
  "num_turns": 5,
  "duration_ms": 15230,
  "duration_api_ms": 12100,
  "total_cost_usd": 0.042,
  "usage": {
    "inputTokens": 12500,
    "outputTokens": 3200,
    "cacheReadInputTokens": 8000,
    "cacheCreationInputTokens": 4500
  },
  "modelUsage": {
    "claude-sonnet-4-20250514": {
      "inputTokens": 12500,
      "outputTokens": 3200,
      "cacheReadInputTokens": 8000,
      "cacheCreationInputTokens": 4500,
      "webSearchRequests": 0,
      "costUSD": 0.042,
      "contextWindow": 200000
    }
  },
  "permission_denials": [],
  "structured_output": null
}
```

Error subtypes replace `"success"` with one of:
- `"error_max_turns"` — agentic turn limit reached
- `"error_max_budget_usd"` — budget limit exceeded
- `"error_during_execution"` — runtime error
- `"error_max_structured_output_retries"` — JSON schema validation retries exhausted

Error results include an `errors` array instead of `result`:

```json
{
  "type": "result",
  "subtype": "error_max_turns",
  "is_error": true,
  "errors": ["Maximum number of turns (10) reached"],
  "total_cost_usd": 0.035
}
```

---

## 3. Stream-JSON Event Type Catalog

### system (init)

Emitted once at session start. Contains session metadata:

```typescript
type SDKSystemMessage = {
  type: "system";
  subtype: "init";
  uuid: string;
  session_id: string;
  apiKeySource: "user" | "project" | "org" | "temporary";
  cwd: string;
  tools: string[];
  mcp_servers: { name: string; status: string }[];
  model: string;
  permissionMode: string;
  slash_commands: string[];
  output_style: string;
};
```

Example:

```json
{"type":"system","subtype":"init","session_id":"abc-123","model":"claude-sonnet-4-20250514","tools":["Read","Write","Edit","Bash","Glob","Grep"],"permissionMode":"acceptEdits","cwd":"/home/user/project"}
```

### assistant

Claude's response containing text and/or tool use content blocks:

```typescript
type SDKAssistantMessage = {
  type: "assistant";
  uuid: string;
  session_id: string;
  message: {
    role: "assistant";
    content: (TextBlock | ToolUseBlock | ThinkingBlock)[];
  };
  parent_tool_use_id: string | null;
};
```

Example:

```json
{"type":"assistant","session_id":"abc-123","message":{"role":"assistant","content":[{"type":"text","text":"Reading the file..."},{"type":"tool_use","id":"tu_1","name":"Read","input":{"file_path":"/app/main.py"}}]},"parent_tool_use_id":null}
```

### user

Tool results and user input fed back to the model:

```typescript
type SDKUserMessage = {
  type: "user";
  uuid?: string;
  session_id: string;
  message: {
    role: "user";
    content: (ToolResultBlock | TextBlock)[];
  };
  parent_tool_use_id: string | null;
};
```

### stream_event (partial messages)

Only emitted when `--include-partial-messages` is set. Provides token-by-token streaming deltas from the Anthropic API:

```typescript
type SDKPartialAssistantMessage = {
  type: "stream_event";
  uuid: string;
  session_id: string;
  event: RawMessageStreamEvent;
  parent_tool_use_id: string | null;
};
```

Common event subtypes within `event`:
- `content_block_start` — beginning of a text or tool_use block
- `content_block_delta` — incremental content (`text_delta` or `input_json_delta`)
- `content_block_stop` — end of a content block
- `message_start` / `message_stop` — message boundaries

### result

Final event signaling completion:

```typescript
type SDKResultMessage = {
  type: "result";
  subtype: "success" | "error_max_turns" | "error_during_execution" | "error_max_budget_usd" | "error_max_structured_output_retries";
  uuid: string;
  session_id: string;
  is_error: boolean;
  num_turns: number;
  duration_ms: number;
  duration_api_ms: number;
  total_cost_usd: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
  };
  modelUsage: Record<string, ModelUsage>;
  permission_denials: { tool: string; reason: string }[];
  result?: string;
  structured_output?: unknown;
  errors?: string[];
};
```

### system (compact_boundary)

Emitted when conversation compaction occurs mid-session:

```json
{"type":"system","subtype":"compact_boundary","session_id":"abc-123","compact_metadata":{"trigger":"auto","pre_tokens":180000}}
```

---

## 4. Pipeline Chaining

Chain multiple Claude invocations using `--input-format stream-json` and `--output-format stream-json`:

```bash
# First agent analyzes, second agent acts on findings
claude -p "Identify all security vulnerabilities" \
  --output-format stream-json \
  --permission-mode plan \
  | claude -p "Fix the identified vulnerabilities" \
    --input-format stream-json \
    --output-format stream-json \
    --permission-mode acceptEdits \
  | claude -p "Write a summary of changes made" \
    --input-format stream-json \
    --output-format json
```

When using `--input-format stream-json`, the agent receives the full conversation history from the upstream agent as context. The `--replay-user-messages` flag re-emits user messages from the input stream on stdout, preserving the full event sequence for downstream consumers.

---

## 5. Environment Variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | API key for direct Anthropic authentication |
| `ANTHROPIC_MODEL` | Default model (overridden by `--model` flag) |
| `CLAUDE_CODE_USE_BEDROCK` | Set to `1` for Amazon Bedrock provider |
| `CLAUDE_CODE_USE_VERTEX` | Set to `1` for Google Vertex AI provider |
| `CLAUDE_CODE_USE_FOUNDRY` | Set to `1` for Microsoft Azure AI Foundry provider |

Provider-specific authentication follows the respective cloud SDK conventions (AWS credentials for Bedrock, Google ADC for Vertex, Azure credentials for Foundry).

---

## 6. Verbose and Debug Output

`--verbose` writes full turn-by-turn output to stderr, including tool invocations and their results. Useful for debugging automation scripts:

```bash
claude -p "Fix the tests" --output-format json --verbose 2>debug.log
```

`--debug` enables debug-level logging with optional category filtering:

```bash
# All debug output
claude -p "query" --debug

# Specific categories
claude -p "query" --debug "api,mcp"
```

Debug categories include `api` (API requests/responses), `mcp` (MCP server communication), and other internal subsystems. Debug output goes to stderr, keeping stdout clean for piping.
