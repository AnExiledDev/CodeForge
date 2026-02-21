---
name: claude-agent-sdk
description: >-
  This skill should be used when the user asks to "build an agent with the Claude Agent SDK",
  "use the Claude Agent SDK", "create an agent with TypeScript SDK", "configure SDK permissions",
  "use canUseTool callback", "create custom MCP tools with createSdkMcpServer",
  "manage SDK sessions", "define subagents", "configure SDK hooks",
  "set up SDK sandbox", "stream SDK messages", "use sdk query function",
  or discusses Claude Agent SDK TypeScript integration, SDK permission modes,
  SDK message types, agent definitions, or programmatic Claude agent orchestration.
version: 0.1.0
---

# Claude Agent SDK (TypeScript)

## Mental Model

The Claude Agent SDK is the Claude Code agent loop as a library. The same tools (Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch), the same context management, the same permission system — but accessed programmatically from TypeScript instead of through a CLI.

The SDK gives you a single function: `query()`. You pass a prompt and options, and get back an async generator of structured messages. The agent loop runs internally — reading files, executing commands, editing code — and you observe or control it through the message stream and callbacks.

Key distinction: The SDK is locked to Anthropic's Claude models. It supports cloud-hosted Claude through Bedrock, Vertex AI, and Azure AI Foundry, but cannot use non-Anthropic models. For multi-model support (GPT, Gemini, Groq, Mistral, Ollama), use PydanticAI (Path B).

---

## Getting Started

### Install

```bash
npm install @anthropic-ai/claude-agent-sdk
```

### Authentication

Set your API key:

```bash
export ANTHROPIC_API_KEY=your-api-key
```

For cloud-hosted Claude:

| Provider | Environment Variable |
|----------|---------------------|
| Amazon Bedrock | `CLAUDE_CODE_USE_BEDROCK=1` + AWS credentials |
| Google Vertex AI | `CLAUDE_CODE_USE_VERTEX=1` + Google Cloud credentials |
| Azure AI Foundry | `CLAUDE_CODE_USE_FOUNDRY=1` + Azure credentials |

### First Query

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find and fix the bug in auth.py",
  options: {
    allowedTools: ["Read", "Edit", "Bash"],
    permissionMode: "acceptEdits",
    model: "sonnet",
  },
})) {
  if (message.type === "assistant") {
    for (const block of message.message.content) {
      if ("text" in block) process.stdout.write(block.text);
    }
  } else if (message.type === "result") {
    console.log(`\nDone: ${message.subtype} | Cost: $${message.total_cost_usd}`);
  }
}
```

---

## Core API

### `query()` Signature

```typescript
function query({
  prompt,
  options
}: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}): Query
```

`prompt` is either a string or an async iterable for streaming input mode. The return value is a `Query` object — an `AsyncGenerator<SDKMessage, void>` with additional control methods.

### Key Options Fields

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `model` | `string` | CLI default | Claude model to use (e.g., `"sonnet"`, `"opus"`, `"haiku"`) |
| `allowedTools` | `string[]` | All tools | Tools the agent can use |
| `disallowedTools` | `string[]` | `[]` | Tools removed from model context entirely |
| `permissionMode` | `PermissionMode` | `'default'` | Permission behavior preset |
| `maxTurns` | `number` | unlimited | Maximum agentic turns before stopping |
| `maxBudgetUsd` | `number` | unlimited | Maximum dollar spend |
| `systemPrompt` | `string \| PresetPrompt` | minimal | System prompt — string for custom, or preset object |
| `mcpServers` | `Record<string, McpServerConfig>` | `{}` | MCP server configurations |
| `agents` | `Record<string, AgentDefinition>` | `undefined` | Subagent definitions |
| `hooks` | `Partial<Record<HookEvent, HookCallbackMatcher[]>>` | `{}` | Callback hooks for lifecycle events |
| `cwd` | `string` | `process.cwd()` | Working directory |
| `resume` | `string` | `undefined` | Session ID to resume |
| `settingSources` | `SettingSource[]` | `[]` | Which filesystem settings to load |
| `canUseTool` | `CanUseTool` | `undefined` | Custom permission callback |
| `sandbox` | `SandboxSettings` | `undefined` | Sandbox configuration |

### System Prompt Options

```typescript
// Custom system prompt (replaces default)
systemPrompt: "You are a security auditor. Review code for vulnerabilities."

// Preset with append (preserves Claude Code defaults + adds instructions)
systemPrompt: {
  type: "preset",
  preset: "claude_code",
  append: "Focus on security best practices.",
}
```

The preset approach is recommended — it preserves Claude Code's built-in tool usage patterns while adding custom instructions.

### Query Control Methods

The `Query` object exposes methods for runtime control (primarily useful in streaming input mode):

| Method | Description |
|--------|-------------|
| `interrupt()` | Interrupts the current query |
| `rewindFiles(uuid)` | Restores files to state at a message. Requires `enableFileCheckpointing: true` |
| `setPermissionMode(mode)` | Changes the permission mode at runtime |
| `setModel(model)` | Changes the model at runtime |
| `setMaxThinkingTokens(n)` | Changes max thinking tokens |
| `supportedCommands()` | Returns available slash commands |
| `supportedModels()` | Returns available models with display info |
| `mcpServerStatus()` | Returns status of connected MCP servers |
| `accountInfo()` | Returns account information |

> **Deep dive:** See `references/sdk-typescript-reference.md` for the complete `Options` interface (~35 fields), full `Query` type definition, and all control methods.

---

## Message Types

The `query()` generator yields `SDKMessage` — a union of message types that form the event stream:

```text
system (init) -> assistant/user messages (interleaved) -> result (final)
```

### SDKMessage Union

| Type | `message.type` | `message.subtype` | When |
|------|----------------|-------------------|------|
| `SDKSystemMessage` | `"system"` | `"init"` | First message — session metadata |
| `SDKAssistantMessage` | `"assistant"` | — | Agent text, tool calls, thinking |
| `SDKUserMessage` | `"user"` | — | Tool results fed back to the model |
| `SDKResultMessage` | `"result"` | `"success"` or error variant | Final message — cost, usage, outcome |
| `SDKPartialAssistantMessage` | `"stream_event"` | — | Streaming tokens (requires `includePartialMessages: true`) |
| `SDKCompactBoundaryMessage` | `"system"` | `"compact_boundary"` | Context compaction occurred |

### System Init Message

The first message provides session metadata:

```typescript
if (message.type === "system" && message.subtype === "init") {
  console.log(`Session: ${message.session_id}`);
  console.log(`Model: ${message.model}`);
  console.log(`Tools: ${message.tools.join(", ")}`);
  console.log(`Permission mode: ${message.permissionMode}`);
}
```

### Result Message

The final message contains cost tracking and outcome:

```typescript
if (message.type === "result") {
  if (message.subtype === "success") {
    console.log(`Result: ${message.result}`);
    console.log(`Cost: $${message.total_cost_usd}`);
    console.log(`Turns: ${message.num_turns}`);
    console.log(`Duration: ${message.duration_ms}ms`);
  } else {
    // Error variants: error_max_turns, error_during_execution,
    // error_max_budget_usd, error_max_structured_output_retries
    console.error(`Error: ${message.subtype}`, message.errors);
  }
}
```

> **Deep dive:** See `references/sdk-typescript-reference.md` for complete TypeScript type definitions of all message types, including `SDKPermissionDenial`, `ModelUsage`, and `NonNullableUsage`.

---

## Permissions

### Permission Modes

| Mode | Behavior |
|------|----------|
| `'default'` | Standard prompting for sensitive operations |
| `'acceptEdits'` | Auto-accept file edits; prompt for bash commands |
| `'plan'` | Planning mode — read-only, no execution |
| `'bypassPermissions'` | Skip all permission checks (requires `allowDangerouslySkipPermissions: true`) |

### `canUseTool` Callback

For fine-grained permission control, provide a `canUseTool` callback:

```typescript
import { query, PermissionResult } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Refactor the auth module",
  options: {
    canUseTool: async (
      toolName: string,
      input: ToolInput,
      { signal, suggestions }
    ): Promise<PermissionResult> => {
      // Allow all reads
      if (toolName === "Read" || toolName === "Glob" || toolName === "Grep") {
        return { behavior: "allow", updatedInput: input };
      }

      // Block destructive bash commands
      if (toolName === "Bash" && /rm\s+-rf/.test((input as any).command)) {
        return { behavior: "deny", message: "Destructive commands blocked" };
      }

      // Allow everything else
      return { behavior: "allow", updatedInput: input };
    },
  },
})) {
  // process messages
}
```

### PermissionResult Type

```typescript
type PermissionResult =
  | { behavior: "allow"; updatedInput: ToolInput; updatedPermissions?: PermissionUpdate[] }
  | { behavior: "deny"; message: string; interrupt?: boolean }
```

- **Allow** — must include `updatedInput` (can be the original input unchanged). Optionally update permission rules.
- **Deny** — must include a `message` explaining why. Set `interrupt: true` to stop the entire query.

### Read-Only Agent Pattern

```typescript
for await (const message of query({
  prompt: "Review this code for best practices",
  options: {
    allowedTools: ["Read", "Glob", "Grep"],
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
  },
})) {
  if ("result" in message) console.log(message.result);
}
```

---

## Custom MCP Tools

Create in-process MCP tools using `createSdkMcpServer()` and `tool()` with Zod schemas:

```typescript
import { query, createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const ticketServer = createSdkMcpServer({
  name: "ticket-tools",
  tools: [
    tool(
      "create_ticket",
      "Create a support ticket in the issue tracker",
      { title: z.string(), priority: z.enum(["low", "medium", "high"]) },
      async ({ title, priority }) => ({
        content: [{ type: "text", text: `Ticket created: ${title} (${priority})` }],
      })
    ),
    tool(
      "list_tickets",
      "List open tickets",
      { status: z.enum(["open", "closed", "all"]).default("open") },
      async ({ status }) => ({
        content: [{ type: "text", text: `Listing ${status} tickets...` }],
      })
    ),
  ],
});

for await (const message of query({
  prompt: "Create a high-priority ticket for the auth bug",
  options: {
    mcpServers: { tickets: ticketServer },
  },
})) {
  // The agent can now use create_ticket and list_tickets
}
```

### External MCP Servers

Connect external MCP servers via stdio, SSE, or HTTP:

```typescript
mcpServers: {
  // stdio — spawns a subprocess
  playwright: { command: "npx", args: ["@playwright/mcp@latest"] },

  // SSE — connects to a running server
  myServer: { type: "sse", url: "http://localhost:3001/sse" },

  // HTTP — streamable HTTP transport
  remote: { type: "http", url: "https://api.example.com/mcp" },
}
```

---

## Sessions

### Capture and Resume

Capture the `session_id` from the init message, then pass it as `resume` to continue:

```typescript
let sessionId: string | undefined;

// First query — capture session ID
for await (const message of query({
  prompt: "Read the authentication module",
  options: { allowedTools: ["Read", "Glob"] },
})) {
  if (message.type === "system" && message.subtype === "init") {
    sessionId = message.session_id;
  }
}

// Second query — resume the session
for await (const message of query({
  prompt: "Now find all places that call it",
  options: { resume: sessionId },
})) {
  if ("result" in message) console.log(message.result);
}
```

### Fork Session

Create a new session ID that preserves context but diverges history:

```typescript
for await (const message of query({
  prompt: "Try an alternative approach",
  options: {
    resume: sessionId,
    forkSession: true,  // new session ID, same conversation context
  },
})) {
  // ...
}
```

---

## Subagents

Define specialized agents that the main agent can delegate to via the Task tool:

```typescript
for await (const message of query({
  prompt: "Review this codebase for security issues, then fix any critical findings",
  options: {
    allowedTools: ["Read", "Write", "Edit", "Glob", "Grep", "Task"],
    agents: {
      "security-reviewer": {
        description: "Expert security auditor. Finds vulnerabilities in code.",
        prompt: "Analyze code for security vulnerabilities. Report findings with severity levels.",
        tools: ["Read", "Glob", "Grep"],
        model: "opus",
      },
      "code-fixer": {
        description: "Applies targeted code fixes based on review findings.",
        prompt: "Fix the identified issues with minimal changes. Preserve existing behavior.",
        tools: ["Read", "Edit", "Write"],
        model: "sonnet",
      },
    },
  },
})) {
  // The main agent orchestrates: delegates review to security-reviewer,
  // then passes findings to code-fixer
}
```

### AgentDefinition

```typescript
type AgentDefinition = {
  description: string;              // When to use this agent
  prompt: string;                   // The agent's system prompt
  tools?: string[];                 // Allowed tools (inherits all if omitted)
  model?: "sonnet" | "opus" | "haiku" | "inherit";  // Model override
}
```

Messages from subagents include a `parent_tool_use_id` field for tracking which delegation produced them.

---

## Hooks

SDK callback hooks intercept lifecycle events for logging, validation, or control:

```typescript
import { query, HookCallback } from "@anthropic-ai/claude-agent-sdk";
import { appendFileSync } from "fs";

const auditLog: HookCallback = async (input) => {
  const filePath = (input as any).tool_input?.file_path ?? "unknown";
  appendFileSync("./audit.log", `${new Date().toISOString()}: modified ${filePath}\n`);
  return {};
};

const blockDestructive: HookCallback = async (input) => {
  const cmd = (input as any).tool_input?.command ?? "";
  if (/rm\s+-rf\s+\//.test(cmd)) {
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "Destructive command blocked by hook",
      },
    };
  }
  return {};
};

for await (const message of query({
  prompt: "Clean up the project",
  options: {
    permissionMode: "acceptEdits",
    hooks: {
      PostToolUse: [{ matcher: "Edit|Write", hooks: [auditLog] }],
      PreToolUse: [{ matcher: "Bash", hooks: [blockDestructive] }],
    },
  },
})) {
  // ...
}
```

### Available Hook Events

| Event | When | Use Case |
|-------|------|----------|
| `PreToolUse` | Before a tool executes | Validation, permission override, input modification |
| `PostToolUse` | After a tool succeeds | Audit logging, output inspection |
| `PostToolUseFailure` | After a tool fails | Error tracking, retry logic |
| `Stop` | Agent is about to stop | Final validation, cleanup |
| `UserPromptSubmit` | User prompt received | Prompt filtering, context injection |
| `SessionStart` | Session begins | Setup, context loading |
| `SessionEnd` | Session ends | Cleanup, reporting |
| `SubagentStart` | Subagent spawned | Tracking, resource allocation |
| `SubagentStop` | Subagent finished | Result aggregation |
| `PreCompact` | Before context compaction | Custom compaction instructions |
| `Notification` | Agent sends a notification | Routing notifications |
| `PermissionRequest` | Permission prompt triggered | Custom permission UI |

### HookCallbackMatcher

```typescript
interface HookCallbackMatcher {
  matcher?: string;    // Regex pattern to match tool names (for tool hooks)
  hooks: HookCallback[];
}
```

The `matcher` field is a regex string tested against the tool name. Omit it to match all tools.

> **Deep dive:** See `references/sdk-typescript-reference.md` for all `HookInput` variants, `HookJSONOutput` fields, and `AsyncHookJSONOutput` for long-running hooks.

---

## Sandbox

Configure sandboxed execution for untrusted environments:

```typescript
for await (const message of query({
  prompt: "Build and test my project",
  options: {
    sandbox: {
      enabled: true,
      autoAllowBashIfSandboxed: true,
      network: { allowLocalBinding: true },
    },
  },
})) {
  // Agent runs in sandbox — filesystem and network restricted
}
```

### SandboxSettings

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable sandbox mode |
| `autoAllowBashIfSandboxed` | `boolean` | `false` | Auto-approve bash when sandboxed |
| `excludedCommands` | `string[]` | `[]` | Commands that always bypass sandbox |
| `allowUnsandboxedCommands` | `boolean` | `false` | Allow model to request unsandboxed execution |
| `network` | `NetworkSandboxSettings` | `undefined` | Network restrictions |

### Permissions Fallback

When `allowUnsandboxedCommands` is `true`, the model can set `dangerouslyDisableSandbox: true` in tool input. These requests fall back to the `canUseTool` handler:

```typescript
canUseTool: async (tool, input) => {
  if (tool === "Bash" && (input as any).dangerouslyDisableSandbox) {
    console.log(`Unsandboxed command requested: ${(input as any).command}`);
    // Apply your own authorization logic
    return { behavior: "deny", message: "Unsandboxed execution not allowed" };
  }
  return { behavior: "allow", updatedInput: input };
}
```

**Warning:** If `permissionMode` is `"bypassPermissions"` AND `allowUnsandboxedCommands` is enabled, the model can execute commands outside the sandbox without approval.

---

## Authentication Model

### Self-Hosted (Local)

OAuth subscription — CodeDirective manages API access. The user authenticates through the platform, and the SDK uses the subscription credentials automatically.

### Customer Infrastructure (BYOK)

User provides their own API credentials:

```bash
# Direct Anthropic API
export ANTHROPIC_API_KEY=sk-ant-...

# Amazon Bedrock
export CLAUDE_CODE_USE_BEDROCK=1
# + AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION)

# Google Vertex AI
export CLAUDE_CODE_USE_VERTEX=1
# + Google Cloud credentials (GOOGLE_APPLICATION_CREDENTIALS)

# Azure AI Foundry
export CLAUDE_CODE_USE_FOUNDRY=1
# + Azure credentials
```

### Model Constraint

The Claude Agent SDK supports Claude models only. This includes all Claude model variants (Haiku, Sonnet, Opus) across all supported providers (Anthropic API, Bedrock, Vertex AI, Foundry).

For multi-model support (GPT, Gemini, Groq, Mistral, Ollama), use PydanticAI (Path B).

---

## Ambiguity Policy

These defaults apply when the user does not specify a preference. State the assumption when applying a default:

- **System prompt:** `{ type: "preset", preset: "claude_code", append: "..." }` to preserve default behaviors
- **Permission mode:** `"acceptEdits"` for trusted automation; `"plan"` for read-only analysis
- **Model:** `"sonnet"` for automation tasks (balanced cost and capability)
- **Session persistence:** New session by default; resume only when continuation is explicitly needed
- **Settings sources:** `[]` (no filesystem settings) unless the user needs CLAUDE.md or project settings
- **Sandbox:** Disabled by default; enable for untrusted environments or multi-tenant scenarios

---

## Reference Files

| File | Contents |
|------|----------|
| `references/sdk-typescript-reference.md` | Full Options interface, Query object methods, all SDKMessage type definitions, CanUseTool callback, createSdkMcpServer + tool(), hook types and inputs, sandbox configuration, tool input/output types, cost tracking, permission types |
