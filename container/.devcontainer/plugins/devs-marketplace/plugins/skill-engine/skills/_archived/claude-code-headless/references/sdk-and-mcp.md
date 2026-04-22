# SDK and MCP — Deep Dive

## 1. TypeScript SDK

### Installation

```bash
npm install @anthropic-ai/claude-agent-sdk
```

### query() Function

The primary interface. Returns an async generator that yields SDK messages:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

function query(params: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}): Query;
```

The `Query` object extends `AsyncGenerator<SDKMessage, void>` and exposes control methods:

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

### Full Options Reference

```typescript
interface Options {
  abortController?: AbortController;
  additionalDirectories?: string[];
  agents?: Record<string, AgentDefinition>;
  allowDangerouslySkipPermissions?: boolean;
  allowedTools?: string[];
  betas?: SdkBeta[];
  canUseTool?: CanUseTool;
  continue?: boolean;
  cwd?: string;
  disallowedTools?: string[];
  enableFileCheckpointing?: boolean;
  env?: Record<string, string>;
  executable?: "bun" | "deno" | "node";
  executableArgs?: string[];
  fallbackModel?: string;
  forkSession?: boolean;
  hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;
  includePartialMessages?: boolean;
  maxBudgetUsd?: number;
  maxThinkingTokens?: number;
  maxTurns?: number;
  mcpServers?: Record<string, McpServerConfig>;
  model?: string;
  outputFormat?: { type: "json_schema"; schema: JSONSchema };
  pathToClaudeCodeExecutable?: string;
  permissionMode?: PermissionMode;
  permissionPromptToolName?: string;
  plugins?: SdkPluginConfig[];
  resume?: string;
  resumeSessionAt?: string;
  sandbox?: SandboxSettings;
  settingSources?: SettingSource[];
  stderr?: (data: string) => void;
  strictMcpConfig?: boolean;
  systemPrompt?: string | { type: "preset"; preset: "claude_code"; append?: string };
  tools?: string[] | { type: "preset"; preset: "claude_code" };
}
```

### Complete Usage Example

```typescript
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";

const controller = new AbortController();

const messages = query({
  prompt: "Refactor the database module to use connection pooling",
  options: {
    model: "sonnet",
    maxTurns: 25,
    maxBudgetUsd: 5.0,
    allowedTools: ["Read", "Write", "Edit", "Bash(npm *)"],
    disallowedTools: ["Bash(rm *)"],
    permissionMode: "acceptEdits",
    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append: "Follow the existing code style. Prefer named exports.",
    },
    abortController: controller,
    cwd: "/home/user/project",
    stderr: (data) => process.stderr.write(data),
  },
});

let sessionId: string | undefined;

for await (const msg of messages) {
  switch (msg.type) {
    case "system":
      if (msg.subtype === "init") {
        sessionId = msg.session_id;
        console.log(`Session: ${sessionId}`);
        console.log(`Model: ${msg.model}`);
        console.log(`Tools: ${msg.tools.join(", ")}`);
      }
      break;

    case "assistant":
      for (const block of msg.message.content) {
        if ("text" in block) {
          process.stdout.write(block.text);
        } else if ("name" in block) {
          console.log(`\n[Tool: ${block.name}]`);
        }
      }
      break;

    case "result":
      console.log(`\n--- Result ---`);
      console.log(`Status: ${msg.subtype}`);
      console.log(`Turns: ${msg.num_turns}`);
      console.log(`Cost: $${msg.total_cost_usd}`);
      console.log(`Duration: ${msg.duration_ms}ms`);
      if (msg.is_error && msg.errors) {
        console.error(`Errors: ${msg.errors.join(", ")}`);
      }
      break;
  }
}
```

---

## 2. Python SDK

### Installation

```bash
pip install claude-agent-sdk
```

### Two Interfaces

| Feature | `query()` | `ClaudeSDKClient` |
|---------|-----------|-------------------|
| Session lifecycle | Creates new each call | Reuses across calls |
| Conversation | Single exchange | Multi-turn |
| Interrupts | Not supported | `client.interrupt()` |
| Custom tools | Via MCP config | Via MCP config |

### query() Function

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    session_id = None

    async for message in query(
        prompt="Analyze the test coverage gaps",
        options=ClaudeAgentOptions(
            model="sonnet",
            max_turns=15,
            max_budget_usd=2.0,
            allowed_tools=["Read", "Glob", "Grep", "Bash(pytest *)"],
            permission_mode="plan",
            system_prompt={
                "type": "preset",
                "preset": "claude_code",
                "append": "Focus on untested edge cases.",
            },
        ),
    ):
        if hasattr(message, "subtype") and message.subtype == "init":
            session_id = message.session_id
            print(f"Session: {session_id}")
        elif hasattr(message, "content"):
            for block in message.content:
                if hasattr(block, "text"):
                    print(block.text, end="")
        elif hasattr(message, "total_cost_usd"):
            print(f"\nCost: ${message.total_cost_usd}")

asyncio.run(main())
```

### ClaudeSDKClient for Multi-Turn Sessions

```python
import asyncio
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions

async def main():
    options = ClaudeAgentOptions(
        allowed_tools=["Read", "Edit", "Bash"],
        permission_mode="acceptEdits",
    )

    async with ClaudeSDKClient(options=options) as client:
        # First turn
        await client.query("Read the auth module and identify issues")
        async for message in client.receive_response():
            if hasattr(message, "content"):
                for block in message.content:
                    if hasattr(block, "text"):
                        print(block.text, end="")

        # Second turn — Claude retains full context
        await client.query("Fix the issues and add error handling")
        async for message in client.receive_response():
            if hasattr(message, "content"):
                for block in message.content:
                    if hasattr(block, "text"):
                        print(block.text, end="")

asyncio.run(main())
```

### Full Python Options

```python
@dataclass
class ClaudeAgentOptions:
    tools: list[str] | None = None
    allowed_tools: list[str] = field(default_factory=list)
    disallowed_tools: list[str] = field(default_factory=list)
    system_prompt: str | dict | None = None
    mcp_servers: dict[str, McpServerConfig] | str | Path = field(default_factory=dict)
    permission_mode: str | None = None
    continue_conversation: bool = False
    resume: str | None = None
    max_turns: int | None = None
    max_budget_usd: float | None = None
    model: str | None = None
    fallback_model: str | None = None
    output_format: dict | None = None
    permission_prompt_tool_name: str | None = None
    cwd: str | Path | None = None
    cli_path: str | Path | None = None
    env: dict[str, str] = field(default_factory=dict)
    can_use_tool: Callable | None = None
    include_partial_messages: bool = False
    fork_session: bool = False
    agents: dict[str, dict] | None = None
    setting_sources: list[str] | None = None
    max_thinking_tokens: int | None = None
    plugins: list[dict] = field(default_factory=list)
    sandbox: dict | None = None
    stderr: Callable[[str], None] | None = None
```

---

## 3. canUseTool Callback

The `canUseTool` callback intercepts every tool invocation, enabling custom permission logic:

### TypeScript

```typescript
import { query, type PermissionResult } from "@anthropic-ai/claude-agent-sdk";

const messages = query({
  prompt: "Update the configuration files",
  options: {
    canUseTool: async (
      toolName: string,
      input: Record<string, unknown>,
      { signal, suggestions }
    ): Promise<PermissionResult> => {
      // Block writes to protected paths
      const filePath = (input.file_path as string) ?? "";
      if (
        (toolName === "Write" || toolName === "Edit") &&
        filePath.startsWith("/etc/")
      ) {
        return {
          behavior: "deny",
          message: "System directory modifications not allowed",
          interrupt: true,
        };
      }

      // Redirect sandbox paths
      if (toolName === "Write" && filePath.includes("config")) {
        return {
          behavior: "allow",
          updatedInput: { ...input, file_path: `./sandbox/${filePath}` },
        };
      }

      // Allow everything else
      return { behavior: "allow", updatedInput: input };
    },
  },
});
```

### Python

```python
from claude_agent_sdk import query, ClaudeAgentOptions

async def permission_handler(tool_name, input_data, context):
    file_path = input_data.get("file_path", "")

    if tool_name in ("Write", "Edit") and file_path.startswith("/etc/"):
        return {
            "behavior": "deny",
            "message": "System directory modifications not allowed",
            "interrupt": True,
        }

    if tool_name == "Write" and "config" in file_path:
        return {
            "behavior": "allow",
            "updated_input": {**input_data, "file_path": f"./sandbox/{file_path}"},
        }

    return {"behavior": "allow", "updated_input": input_data}

async def main():
    async for msg in query(
        prompt="Update the configuration files",
        options=ClaudeAgentOptions(can_use_tool=permission_handler),
    ):
        pass
```

---

## 4. Custom MCP Tools

### TypeScript — createSdkMcpServer

Define custom tools that the agent can invoke, running in the same process:

```typescript
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const lookupUser = tool(
  "lookup_user",
  "Look up a user by email address",
  { email: z.string().email() },
  async (args) => {
    const user = await db.users.findByEmail(args.email);
    return {
      content: [{ type: "text", text: JSON.stringify(user) }],
    };
  }
);

const runQuery = tool(
  "run_sql",
  "Execute a read-only SQL query",
  { query: z.string() },
  async (args) => {
    const results = await db.query(args.query);
    return {
      content: [{ type: "text", text: JSON.stringify(results) }],
    };
  }
);

const server = createSdkMcpServer({
  name: "app-tools",
  tools: [lookupUser, runQuery],
});

for await (const msg of query({
  prompt: "Find all users who signed up this week",
  options: {
    mcpServers: { appTools: server },
    allowedTools: ["mcp__appTools__lookup_user", "mcp__appTools__run_sql"],
  },
})) {
  // Process messages
}
```

### Python — create_sdk_mcp_server

```python
from claude_agent_sdk import tool, create_sdk_mcp_server, query, ClaudeAgentOptions

@tool("lookup_user", "Look up a user by email", {"email": str})
async def lookup_user(args):
    user = await db.users.find_by_email(args["email"])
    return {"content": [{"type": "text", "text": str(user)}]}

server = create_sdk_mcp_server(name="app-tools", tools=[lookup_user])

async for msg in query(
    prompt="Find the user with email admin@example.com",
    options=ClaudeAgentOptions(
        mcp_servers={"appTools": server},
        allowed_tools=["mcp__appTools__lookup_user"],
    ),
):
    pass
```

MCP tool names follow the pattern `mcp__<serverName>__<toolName>`. Include them in `allowedTools` to auto-approve invocations.

---

## 5. CLI MCP Configuration

### --mcp-config

Load MCP servers from a JSON configuration file:

```bash
claude -p "Query the database" --mcp-config ./mcp-servers.json
```

```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/app"],
      "env": {
        "PGPASSWORD": "secret"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/docs"]
    }
  }
}
```

MCP server types:
- **stdio** — spawns a subprocess communicating via stdin/stdout (most common)
- **sse** — connects to an HTTP server-sent events endpoint
- **http** — connects to an HTTP endpoint using the Streamable HTTP transport

### --strict-mcp-config

When set, only MCP servers defined in `--mcp-config` are used. All other configured servers (from settings, project config) are ignored:

```bash
claude -p "query" --strict-mcp-config --mcp-config ./ci-servers.json
```

This ensures reproducible behavior in CI/CD where the environment should not inherit user-level MCP configurations.

---

## 6. Subagent Definitions

### --agents Flag

Define custom subagents that the main agent can delegate to:

```bash
claude -p "Review and fix all issues in this project" --agents '{
  "code-reviewer": {
    "description": "Expert code reviewer for quality and security analysis.",
    "prompt": "Analyze code for bugs, security issues, and style violations. Report findings clearly.",
    "tools": ["Read", "Grep", "Glob"],
    "model": "haiku"
  },
  "fixer": {
    "description": "Code fixer that applies targeted repairs.",
    "prompt": "Apply minimal, focused fixes. Preserve existing style.",
    "tools": ["Read", "Edit", "Write", "Bash"],
    "model": "sonnet"
  }
}'
```

Agent definition fields:
- `description` (required) — when to use this agent; helps the main agent decide delegation
- `prompt` (required) — system-level instructions for the subagent
- `tools` (optional) — restrict available tools; inherits all if omitted
- `model` (optional) — `sonnet`, `opus`, `haiku`, or `inherit` from parent

---

## 7. Non-Interactive Permission Handling

### --permission-prompt-tool

For fully automated pipelines where `bypassPermissions` is too broad, `--permission-prompt-tool` delegates permission decisions to an MCP tool:

```bash
claude -p "Deploy the application" \
  --permission-prompt-tool mcp__auth__check_permission \
  --mcp-config ./auth-server.json
```

The specified MCP tool receives each permission request and returns an allow/deny decision. This enables centralized policy enforcement without blanket permission bypass.

---

## 8. Session Continuation Patterns

### TypeScript — Capture and Resume

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

// Phase 1: Analysis
let sessionId: string | undefined;

for await (const msg of query({
  prompt: "Analyze the codebase architecture and identify improvements",
  options: { permissionMode: "plan" },
})) {
  if (msg.type === "system" && msg.subtype === "init") {
    sessionId = msg.session_id;
  }
  if (msg.type === "result") {
    console.log(`Analysis complete. Session: ${sessionId}`);
  }
}

// Phase 2: Implementation (resumes with full context)
for await (const msg of query({
  prompt: "Implement the top 3 improvements identified",
  options: {
    resume: sessionId,
    permissionMode: "acceptEdits",
    maxBudgetUsd: 5.0,
  },
})) {
  if (msg.type === "result") {
    console.log(`Implementation: ${msg.subtype} | Cost: $${msg.total_cost_usd}`);
  }
}
```

### CLI — Capture and Resume

```bash
# Phase 1
session_id=$(claude -p "Analyze the auth module" \
  --output-format json \
  --permission-mode plan \
  | jq -r '.session_id')

# Phase 2
claude -p "Fix the issues found" \
  --resume "$session_id" \
  --output-format json \
  --permission-mode acceptEdits
```

Session continuation preserves the full conversation history, including tool results and file contents read during previous phases. This enables multi-phase workflows where analysis and implementation run as separate invocations with different permission modes.
