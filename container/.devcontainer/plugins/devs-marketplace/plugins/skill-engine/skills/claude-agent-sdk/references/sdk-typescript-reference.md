# Claude Agent SDK — TypeScript Reference

Complete TypeScript API reference for `@anthropic-ai/claude-agent-sdk`.

Source: [platform.claude.com/docs/en/agent-sdk/typescript](https://platform.claude.com/docs/en/agent-sdk/typescript)

---

## Functions

### `query()`

The primary function. Creates an async generator that streams SDK messages.

```typescript
function query({
  prompt,
  options
}: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}): Query
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt` | `string \| AsyncIterable<SDKUserMessage>` | Input prompt as string or async iterable for streaming mode |
| `options` | `Options` | Optional configuration object |

Returns a `Query` object extending `AsyncGenerator<SDKMessage, void>` with control methods.

### `tool()`

Creates a type-safe MCP tool definition with Zod schema validation.

```typescript
function tool<Schema extends ZodRawShape>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (args: z.infer<ZodObject<Schema>>, extra: unknown) => Promise<CallToolResult>
): SdkMcpToolDefinition<Schema>
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Tool name |
| `description` | `string` | What the tool does |
| `inputSchema` | `Schema extends ZodRawShape` | Zod schema for input parameters |
| `handler` | `(args, extra) => Promise<CallToolResult>` | Async handler function |

### `createSdkMcpServer()`

Creates an in-process MCP server instance.

```typescript
function createSdkMcpServer(options: {
  name: string;
  version?: string;
  tools?: Array<SdkMcpToolDefinition<any>>;
}): McpSdkServerConfigWithInstance
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.name` | `string` | MCP server name |
| `options.version` | `string` | Optional version string |
| `options.tools` | `Array<SdkMcpToolDefinition>` | Tool definitions created with `tool()` |

---

## Full Options Interface

All configuration fields for `query()`.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `abortController` | `AbortController` | `new AbortController()` | Controller for cancelling operations |
| `additionalDirectories` | `string[]` | `[]` | Additional directories Claude can access |
| `agents` | `Record<string, AgentDefinition>` | `undefined` | Programmatically define subagents |
| `allowDangerouslySkipPermissions` | `boolean` | `false` | Required when using `permissionMode: 'bypassPermissions'` |
| `allowedTools` | `string[]` | All tools | List of allowed tool names |
| `betas` | `SdkBeta[]` | `[]` | Beta features (e.g., `['context-1m-2025-08-07']`) |
| `canUseTool` | `CanUseTool` | `undefined` | Custom permission callback |
| `continue` | `boolean` | `false` | Continue the most recent conversation |
| `cwd` | `string` | `process.cwd()` | Current working directory |
| `disallowedTools` | `string[]` | `[]` | Tools removed from model context |
| `enableFileCheckpointing` | `boolean` | `false` | Enable file change tracking for rewinding |
| `env` | `Dict<string>` | `process.env` | Environment variables |
| `executable` | `'bun' \| 'deno' \| 'node'` | Auto-detected | JavaScript runtime |
| `executableArgs` | `string[]` | `[]` | Arguments to pass to the runtime |
| `extraArgs` | `Record<string, string \| null>` | `{}` | Additional arguments |
| `fallbackModel` | `string` | `undefined` | Model to use if primary fails |
| `forkSession` | `boolean` | `false` | Fork to a new session ID when resuming |
| `hooks` | `Partial<Record<HookEvent, HookCallbackMatcher[]>>` | `{}` | Hook callbacks for lifecycle events |
| `includePartialMessages` | `boolean` | `false` | Include streaming token events |
| `maxBudgetUsd` | `number` | `undefined` | Maximum budget in USD |
| `maxThinkingTokens` | `number` | `undefined` | Maximum tokens for thinking |
| `maxTurns` | `number` | `undefined` | Maximum conversation turns |
| `mcpServers` | `Record<string, McpServerConfig>` | `{}` | MCP server configurations |
| `model` | `string` | Default from CLI | Claude model to use |
| `outputFormat` | `{ type: 'json_schema', schema: JSONSchema }` | `undefined` | Structured output schema |
| `pathToClaudeCodeExecutable` | `string` | Uses built-in | Path to Claude Code executable |
| `permissionMode` | `PermissionMode` | `'default'` | Permission behavior preset |
| `permissionPromptToolName` | `string` | `undefined` | MCP tool name for permission prompts |
| `plugins` | `SdkPluginConfig[]` | `[]` | Load custom plugins from local paths |
| `resume` | `string` | `undefined` | Session ID to resume |
| `resumeSessionAt` | `string` | `undefined` | Resume at a specific message UUID |
| `sandbox` | `SandboxSettings` | `undefined` | Sandbox configuration |
| `settingSources` | `SettingSource[]` | `[]` (no settings) | Filesystem settings to load |
| `stderr` | `(data: string) => void` | `undefined` | Callback for stderr output |
| `strictMcpConfig` | `boolean` | `false` | Enforce strict MCP validation |
| `systemPrompt` | `string \| { type: 'preset'; preset: 'claude_code'; append?: string }` | `undefined` (minimal) | System prompt config |
| `tools` | `string[] \| { type: 'preset'; preset: 'claude_code' }` | `undefined` | Tool configuration |

---

## Query Object

The `Query` extends `AsyncGenerator<SDKMessage, void>` with control methods:

```typescript
interface Query extends AsyncGenerator<SDKMessage, void> {
  interrupt(): Promise<void>;
  rewindFiles(userMessageUuid: string): Promise<void>;
  setPermissionMode(mode: PermissionMode): Promise<void>;
  setModel(model?: string): Promise<void>;
  setMaxThinkingTokens(maxThinkingTokens: number | null): Promise<void>;
  supportedCommands(): Promise<SlashCommand[]>;
  supportedModels(): Promise<ModelInfo[]>;
  mcpServerStatus(): Promise<McpServerStatus[]>;
  accountInfo(): Promise<AccountInfo>;
}
```

| Method | Description |
|--------|-------------|
| `interrupt()` | Interrupts the query (streaming input mode only) |
| `rewindFiles(uuid)` | Restores files to state at specified message. Requires `enableFileCheckpointing: true` |
| `setPermissionMode(mode)` | Changes permission mode at runtime (streaming input mode only) |
| `setModel(model)` | Changes model at runtime (streaming input mode only) |
| `setMaxThinkingTokens(n)` | Changes max thinking tokens (streaming input mode only) |
| `supportedCommands()` | Returns available slash commands |
| `supportedModels()` | Returns available models with display info |
| `mcpServerStatus()` | Returns status of connected MCP servers |
| `accountInfo()` | Returns account information |

---

## SDKMessage Types

### SDKMessage Union

```typescript
type SDKMessage =
  | SDKAssistantMessage
  | SDKUserMessage
  | SDKUserMessageReplay
  | SDKResultMessage
  | SDKSystemMessage
  | SDKPartialAssistantMessage
  | SDKCompactBoundaryMessage;
```

### SDKSystemMessage

First message emitted — contains session metadata.

```typescript
type SDKSystemMessage = {
  type: "system";
  subtype: "init";
  uuid: UUID;
  session_id: string;
  apiKeySource: ApiKeySource;
  cwd: string;
  tools: string[];
  mcp_servers: { name: string; status: string }[];
  model: string;
  permissionMode: PermissionMode;
  slash_commands: string[];
  output_style: string;
};
```

### SDKAssistantMessage

Agent output — text, tool calls, thinking.

```typescript
type SDKAssistantMessage = {
  type: "assistant";
  uuid: UUID;
  session_id: string;
  message: APIAssistantMessage; // From Anthropic SDK
  parent_tool_use_id: string | null;
};
```

### SDKUserMessage

Tool results fed back to the model.

```typescript
type SDKUserMessage = {
  type: "user";
  uuid?: UUID;
  session_id: string;
  message: APIUserMessage; // From Anthropic SDK
  parent_tool_use_id: string | null;
};
```

### SDKResultMessage

Final message — outcome, cost, usage. Two subtypes:

```typescript
// Success
type SDKResultSuccess = {
  type: "result";
  subtype: "success";
  uuid: UUID;
  session_id: string;
  duration_ms: number;
  duration_api_ms: number;
  is_error: boolean;
  num_turns: number;
  result: string;
  total_cost_usd: number;
  usage: NonNullableUsage;
  modelUsage: { [modelName: string]: ModelUsage };
  permission_denials: SDKPermissionDenial[];
  structured_output?: unknown;
};

// Error variants
type SDKResultError = {
  type: "result";
  subtype:
    | "error_max_turns"
    | "error_during_execution"
    | "error_max_budget_usd"
    | "error_max_structured_output_retries";
  uuid: UUID;
  session_id: string;
  duration_ms: number;
  duration_api_ms: number;
  is_error: boolean;
  num_turns: number;
  total_cost_usd: number;
  usage: NonNullableUsage;
  modelUsage: { [modelName: string]: ModelUsage };
  permission_denials: SDKPermissionDenial[];
  errors: string[];
};

type SDKResultMessage = SDKResultSuccess | SDKResultError;
```

### SDKPartialAssistantMessage

Streaming token events. Only emitted when `includePartialMessages: true`.

```typescript
type SDKPartialAssistantMessage = {
  type: "stream_event";
  event: RawMessageStreamEvent; // From Anthropic SDK
  parent_tool_use_id: string | null;
  uuid: UUID;
  session_id: string;
};
```

### SDKCompactBoundaryMessage

Emitted when context compaction occurs.

```typescript
type SDKCompactBoundaryMessage = {
  type: "system";
  subtype: "compact_boundary";
  uuid: UUID;
  session_id: string;
  compact_metadata: {
    trigger: "manual" | "auto";
    pre_tokens: number;
  };
};
```

### SDKPermissionDenial

```typescript
type SDKPermissionDenial = {
  tool_name: string;
  tool_use_id: string;
  tool_input: ToolInput;
};
```

---

## canUseTool Callback

### CanUseTool Type

```typescript
type CanUseTool = (
  toolName: string,
  input: ToolInput,
  options: {
    signal: AbortSignal;
    suggestions?: PermissionUpdate[];
  }
) => Promise<PermissionResult>;
```

### PermissionResult

```typescript
type PermissionResult =
  | {
      behavior: "allow";
      updatedInput: ToolInput;
      updatedPermissions?: PermissionUpdate[];
    }
  | {
      behavior: "deny";
      message: string;
      interrupt?: boolean;
    };
```

### Examples

```typescript
// Allow with modified input
return {
  behavior: "allow",
  updatedInput: { ...input, timeout: 30000 }, // enforce timeout
};

// Deny with explanation
return {
  behavior: "deny",
  message: "Write access to /etc is not permitted",
};

// Deny and stop the entire query
return {
  behavior: "deny",
  message: "Security violation detected",
  interrupt: true,
};

// Allow and update permission rules for future calls
return {
  behavior: "allow",
  updatedInput: input,
  updatedPermissions: [
    {
      type: "addRules",
      rules: [{ toolName: "Bash", ruleContent: "git *" }],
      behavior: "allow",
      destination: "session",
    },
  ],
};
```

---

## Custom MCP Tools

### createSdkMcpServer + tool

```typescript
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const server = createSdkMcpServer({
  name: "my-tools",
  version: "1.0.0",
  tools: [
    tool(
      "lookup_user",
      "Look up a user by email",
      { email: z.string().email() },
      async ({ email }) => ({
        content: [{ type: "text", text: JSON.stringify({ id: 1, email }) }],
      })
    ),
  ],
});

// Pass to query
const messages = query({
  prompt: "Look up user alice@example.com",
  options: { mcpServers: { users: server } },
});
```

### McpServerConfig Variants

```typescript
// stdio — spawns a subprocess
type McpStdioServerConfig = {
  type?: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

// SSE — connects to a running server
type McpSSEServerConfig = {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
};

// HTTP — streamable HTTP transport
type McpHttpServerConfig = {
  type: "http";
  url: string;
  headers?: Record<string, string>;
};

// SDK — in-process server (from createSdkMcpServer)
type McpSdkServerConfigWithInstance = {
  type: "sdk";
  name: string;
  instance: McpServer;
};

type McpServerConfig =
  | McpStdioServerConfig
  | McpSSEServerConfig
  | McpHttpServerConfig
  | McpSdkServerConfigWithInstance;
```

---

## Hook Types

### HookEvent

```typescript
type HookEvent =
  | "PreToolUse"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "Notification"
  | "UserPromptSubmit"
  | "SessionStart"
  | "SessionEnd"
  | "Stop"
  | "SubagentStart"
  | "SubagentStop"
  | "PreCompact"
  | "PermissionRequest";
```

### HookCallback

```typescript
type HookCallback = (
  input: HookInput,
  toolUseID: string | undefined,
  options: { signal: AbortSignal }
) => Promise<HookJSONOutput>;
```

### HookCallbackMatcher

```typescript
interface HookCallbackMatcher {
  matcher?: string; // Regex pattern for tool name matching
  hooks: HookCallback[];
}
```

### HookInput Variants

All hook inputs extend `BaseHookInput`:

```typescript
type BaseHookInput = {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode?: string;
};
```

| Hook Event | Additional Fields |
|------------|-------------------|
| `PreToolUse` | `tool_name: string`, `tool_input: unknown` |
| `PostToolUse` | `tool_name: string`, `tool_input: unknown`, `tool_response: unknown` |
| `PostToolUseFailure` | `tool_name: string`, `tool_input: unknown`, `error: string`, `is_interrupt?: boolean` |
| `Notification` | `message: string`, `title?: string` |
| `UserPromptSubmit` | `prompt: string` |
| `SessionStart` | `source: 'startup' \| 'resume' \| 'clear' \| 'compact'` |
| `SessionEnd` | `reason: ExitReason` |
| `Stop` | `stop_hook_active: boolean` |
| `SubagentStart` | `agent_id: string`, `agent_type: string` |
| `SubagentStop` | `stop_hook_active: boolean` |
| `PreCompact` | `trigger: 'manual' \| 'auto'`, `custom_instructions: string \| null` |
| `PermissionRequest` | `tool_name: string`, `tool_input: unknown`, `permission_suggestions?: PermissionUpdate[]` |

### HookJSONOutput

```typescript
type HookJSONOutput = AsyncHookJSONOutput | SyncHookJSONOutput;

// For long-running hooks
type AsyncHookJSONOutput = {
  async: true;
  asyncTimeout?: number;
};

// Standard hook output
type SyncHookJSONOutput = {
  continue?: boolean;
  suppressOutput?: boolean;
  stopReason?: string;
  decision?: "approve" | "block";
  systemMessage?: string;
  reason?: string;
  hookSpecificOutput?:
    | {
        hookEventName: "PreToolUse";
        permissionDecision?: "allow" | "deny" | "ask";
        permissionDecisionReason?: string;
        updatedInput?: Record<string, unknown>;
      }
    | {
        hookEventName: "UserPromptSubmit";
        additionalContext?: string;
      }
    | {
        hookEventName: "SessionStart";
        additionalContext?: string;
      }
    | {
        hookEventName: "PostToolUse";
        additionalContext?: string;
      };
};
```

---

## Sandbox Configuration

### SandboxSettings

```typescript
type SandboxSettings = {
  enabled?: boolean;
  autoAllowBashIfSandboxed?: boolean;
  excludedCommands?: string[];
  allowUnsandboxedCommands?: boolean;
  network?: NetworkSandboxSettings;
  ignoreViolations?: SandboxIgnoreViolations;
  enableWeakerNestedSandbox?: boolean;
};
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable sandbox mode |
| `autoAllowBashIfSandboxed` | `boolean` | `false` | Auto-approve bash when sandboxed |
| `excludedCommands` | `string[]` | `[]` | Commands that always bypass sandbox (no model involvement) |
| `allowUnsandboxedCommands` | `boolean` | `false` | Model can request unsandboxed execution via `dangerouslyDisableSandbox` |
| `network` | `NetworkSandboxSettings` | `undefined` | Network sandbox config |
| `ignoreViolations` | `SandboxIgnoreViolations` | `undefined` | Violations to ignore |
| `enableWeakerNestedSandbox` | `boolean` | `false` | Weaker nested sandbox for compatibility |

### NetworkSandboxSettings

```typescript
type NetworkSandboxSettings = {
  allowLocalBinding?: boolean;
  allowUnixSockets?: string[];
  allowAllUnixSockets?: boolean;
  httpProxyPort?: number;
  socksProxyPort?: number;
};
```

### SandboxIgnoreViolations

```typescript
type SandboxIgnoreViolations = {
  file?: string[];
  network?: string[];
};
```

**`excludedCommands` vs `allowUnsandboxedCommands`:**
- `excludedCommands`: Static list, always bypasses sandbox, no model involvement
- `allowUnsandboxedCommands`: Model decides at runtime via `dangerouslyDisableSandbox: true`, falls back to `canUseTool`

---

## Tool Input Types

### ToolInput Union

```typescript
type ToolInput =
  | AgentInput
  | AskUserQuestionInput
  | BashInput
  | BashOutputInput
  | FileEditInput
  | FileReadInput
  | FileWriteInput
  | GlobInput
  | GrepInput
  | KillShellInput
  | NotebookEditInput
  | WebFetchInput
  | WebSearchInput
  | TodoWriteInput
  | ExitPlanModeInput
  | ListMcpResourcesInput
  | ReadMcpResourceInput;
```

### Key Tool Input Types

```typescript
// Task (AgentInput)
interface AgentInput {
  description: string;   // Short (3-5 word) task description
  prompt: string;        // The task for the agent
  subagent_type: string; // Type of specialized agent
}

// Bash
interface BashInput {
  command: string;
  timeout?: number;            // ms, max 600000
  description?: string;
  run_in_background?: boolean;
}

// Edit
interface FileEditInput {
  file_path: string;     // Absolute path
  old_string: string;    // Text to replace
  new_string: string;    // Replacement text
  replace_all?: boolean; // Default false
}

// Read
interface FileReadInput {
  file_path: string;
  offset?: number;  // Start line
  limit?: number;   // Number of lines
}

// Write
interface FileWriteInput {
  file_path: string;
  content: string;
}

// Glob
interface GlobInput {
  pattern: string;
  path?: string;  // Defaults to cwd
}

// Grep
interface GrepInput {
  pattern: string;
  path?: string;
  glob?: string;
  type?: string;
  output_mode?: "content" | "files_with_matches" | "count";
  "-i"?: boolean;
  "-n"?: boolean;
  "-B"?: number;
  "-A"?: number;
  "-C"?: number;
  head_limit?: number;
  multiline?: boolean;
}

// WebFetch
interface WebFetchInput {
  url: string;
  prompt: string;
}

// WebSearch
interface WebSearchInput {
  query: string;
  allowed_domains?: string[];
  blocked_domains?: string[];
}
```

---

## Tool Output Types

### Key Tool Output Types

```typescript
// Task
interface TaskOutput {
  result: string;
  usage?: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
  total_cost_usd?: number;
  duration_ms?: number;
}

// Bash
interface BashOutput {
  output: string;
  exitCode: number;
  killed?: boolean;    // Timeout
  shellId?: string;    // Background processes
}

// Edit
interface EditOutput {
  message: string;
  replacements: number;
  file_path: string;
}

// Read
interface TextFileOutput {
  content: string;
  total_lines: number;
  lines_returned: number;
}

// Write
interface WriteOutput {
  message: string;
  bytes_written: number;
  file_path: string;
}

// Glob
interface GlobOutput {
  matches: string[];
  count: number;
  search_path: string;
}

// Grep (content mode)
interface GrepContentOutput {
  matches: Array<{ file: string; line_number?: number; line: string; before_context?: string[]; after_context?: string[] }>;
  total_matches: number;
}
```

---

## Cost Tracking

### SDKResultMessage Cost Fields

| Field | Type | Description |
|-------|------|-------------|
| `total_cost_usd` | `number` | Total cost in USD |
| `duration_ms` | `number` | Total duration including tool execution |
| `duration_api_ms` | `number` | Time spent on API calls only |
| `num_turns` | `number` | Number of agentic turns |
| `usage` | `NonNullableUsage` | Aggregate token usage |
| `modelUsage` | `{ [model: string]: ModelUsage }` | Per-model breakdown |

### ModelUsage

```typescript
type ModelUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests: number;
  costUSD: number;
  contextWindow: number;
};
```

### NonNullableUsage

```typescript
type NonNullableUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
};
```

---

## Other Types

### AgentDefinition

```typescript
type AgentDefinition = {
  description: string;
  tools?: string[];
  prompt: string;
  model?: "sonnet" | "opus" | "haiku" | "inherit";
};
```

### PermissionMode

```typescript
type PermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "plan";
```

### SettingSource

```typescript
type SettingSource = "user" | "project" | "local";
```

| Value | Location | Description |
|-------|----------|-------------|
| `"user"` | `~/.claude/settings.json` | Global user settings |
| `"project"` | `.claude/settings.json` | Shared project settings (version controlled) |
| `"local"` | `.claude/settings.local.json` | Local project settings (gitignored) |

**Precedence** (highest to lowest): local > project > user. Programmatic options always override filesystem settings.

### PermissionUpdate

```typescript
type PermissionUpdate =
  | { type: "addRules"; rules: PermissionRuleValue[]; behavior: PermissionBehavior; destination: PermissionUpdateDestination }
  | { type: "replaceRules"; rules: PermissionRuleValue[]; behavior: PermissionBehavior; destination: PermissionUpdateDestination }
  | { type: "removeRules"; rules: PermissionRuleValue[]; behavior: PermissionBehavior; destination: PermissionUpdateDestination }
  | { type: "setMode"; mode: PermissionMode; destination: PermissionUpdateDestination }
  | { type: "addDirectories"; directories: string[]; destination: PermissionUpdateDestination }
  | { type: "removeDirectories"; directories: string[]; destination: PermissionUpdateDestination };
```

### PermissionBehavior

```typescript
type PermissionBehavior = "allow" | "deny" | "ask";
```

### PermissionUpdateDestination

```typescript
type PermissionUpdateDestination = "userSettings" | "projectSettings" | "localSettings" | "session";
```

### PermissionRuleValue

```typescript
type PermissionRuleValue = {
  toolName: string;
  ruleContent?: string;
};
```

### SdkBeta

```typescript
type SdkBeta = "context-1m-2025-08-07";
```

| Value | Description | Compatible Models |
|-------|-------------|-------------------|
| `"context-1m-2025-08-07"` | 1M token context window | Claude Opus 4.6, Claude Sonnet 4.5, Claude Sonnet 4 |

### SdkPluginConfig

```typescript
type SdkPluginConfig = {
  type: "local";
  path: string;
};
```

### SlashCommand

```typescript
type SlashCommand = {
  name: string;
  description: string;
  argumentHint: string;
};
```

### ModelInfo

```typescript
type ModelInfo = {
  value: string;
  displayName: string;
  description: string;
};
```

### McpServerStatus

```typescript
type McpServerStatus = {
  name: string;
  status: "connected" | "failed" | "needs-auth" | "pending";
  serverInfo?: { name: string; version: string };
};
```

### AccountInfo

```typescript
type AccountInfo = {
  email?: string;
  organization?: string;
  subscriptionType?: string;
  tokenSource?: string;
  apiKeySource?: string;
};
```

### ApiKeySource

```typescript
type ApiKeySource = "user" | "project" | "org" | "temporary";
```

### CallToolResult

```typescript
type CallToolResult = {
  content: Array<{ type: "text" | "image" | "resource"; [key: string]: unknown }>;
  isError?: boolean;
};
```

### AbortError

```typescript
class AbortError extends Error {}
```
