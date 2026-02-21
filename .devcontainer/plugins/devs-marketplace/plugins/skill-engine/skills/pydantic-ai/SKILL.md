---
name: pydantic-ai
description: >-
  This skill should be used when the user asks to "build a PydanticAI agent",
  "create an AI agent with PydanticAI", "add tools to a PydanticAI agent",
  "stream responses with PydanticAI", "test a PydanticAI agent",
  "connect PydanticAI to a Svelte frontend", "use RunContext for dependency injection",
  "configure model fallbacks in PydanticAI", or discusses PydanticAI agents,
  tool decorators, structured output, agent testing, or VercelAIAdapter.
version: 0.1.0
---

# PydanticAI Agent Development

## Mental Model

PydanticAI is a Python agent framework where **the `Agent` class is the single orchestration primitive**. An agent binds a model, a set of tools, and a typed output contract into one object. Tools are plain Python functions decorated onto the agent; the framework generates JSON schemas from their type annotations and docstrings, sends them to the model, and validates the model's tool-call arguments with Pydantic before invoking the function. This means type annotations are the contract -- there is no separate schema definition layer.

Dependency injection flows through `RunContext[DepsT]`. The caller passes a `deps` object at run time; every tool and validator receives it via `RunContext.deps`. This keeps tools pure (no global state, no module-level singletons) and makes testing straightforward -- swap the deps object, swap the behavior.

Streaming and structured output are first-class. An agent can stream raw text deltas, partially-validated Pydantic models, or both. The `VercelAIAdapter` bridges PydanticAI's streaming protocol to the Vercel AI Data Stream Protocol, enabling direct consumption by `@ai-sdk/svelte` on the frontend without a custom SSE layer.

Assume `pydantic-ai>=0.1` with Pydantic v2 for all new code.

---

## Agent Definition

The `Agent` class is generic over dependencies and output type: `Agent[DepsT, OutputT]`. The constructor wires together model, tools, output contract, and defaults:

```python
from pydantic_ai import Agent
from pydantic import BaseModel

class CityInfo(BaseModel):
    name: str
    country: str
    population: int

agent = Agent(
    "anthropic:claude-sonnet-4-20250514",
    output_type=CityInfo,
    instructions="Extract structured city information from user queries.",
    deps_type=type(None),
    retries=2,
    end_strategy="early",
)
```

Key constructor parameters:

- **`model`**: String identifier like `"openai:gpt-5"` or `"anthropic:claude-sonnet-4-20250514"`, or a `Model` instance. Overridable per-run.
- **`output_type`**: Defaults to `str`. Accepts a Pydantic `BaseModel`, dataclass, `TypedDict`, list of types (union), `ToolOutput`, `NativeOutput`, or `PromptedOutput`.
- **`instructions`**: Static string or dynamic callable returning a string. Re-evaluated each run. Not included when `message_history` is provided.
- **`system_prompt`**: Static string(s) included in every request, preserved in conversation history.
- **`deps_type`**: The type of the dependency object passed at run time.
- **`retries`**: Default retry count for tools when the model sends invalid arguments (default 1).
- **`end_strategy`**: `"early"` stops on first valid output; `"exhaustive"` runs all pending tool calls first.

### Running an Agent

```python
# Async (preferred)
result = await agent.run("Tell me about Paris", deps=my_deps)
print(result.output)        # CityInfo(name='Paris', country='France', population=2161000)
print(result.usage())       # RunUsage(requests=1, input_tokens=..., output_tokens=...)

# Sync convenience
result = agent.run_sync("Tell me about Paris")

# With overrides
result = await agent.run(
    "Tell me about Paris",
    model="openai:gpt-5",
    model_settings={"temperature": 0.0},
    usage_limits=UsageLimits(request_limit=5),
)
```

The `AgentRunResult` exposes `.output` (typed), `.usage()`, `.all_messages()`, and `.new_messages()` for conversation continuation.

---

## Tools

Tools give the agent the ability to take actions and retrieve information. There are two decorator forms based on whether the tool needs access to dependencies:

### Context-Aware Tools

```python
from pydantic_ai import Agent, RunContext

agent = Agent("openai:gpt-5", deps_type=DatabasePool)

@agent.tool(retries=3)
async def lookup_user(ctx: RunContext[DatabasePool], user_id: int) -> str:
    """Find a user by their ID. Returns the user's name and email."""
    row = await ctx.deps.fetchrow("SELECT name, email FROM users WHERE id = $1", user_id)
    if not row:
        raise ModelRetry("No user found with that ID, try a different one")
    return f"{row['name']} ({row['email']})"
```

The first parameter **must** be `RunContext[DepsT]`. All subsequent parameters become the tool's JSON schema. The docstring becomes the tool description sent to the model.

### Plain Tools

```python
@agent.tool_plain
def roll_dice(sides: int = 6) -> str:
    """Roll a die with the specified number of sides."""
    return str(random.randint(1, sides))
```

No `RunContext` parameter. Use for stateless utilities that need no dependencies.

### Tool Decorator Options

Both `@agent.tool` and `@agent.tool_plain` accept:

- **`retries`**: Override the agent-level retry count for this tool.
- **`prepare`**: A `ToolsPrepareFunc` to dynamically include/exclude the tool or modify its schema per run.
- **`name`** / **`description`**: Override the function name or docstring.

### Error Handling with ModelRetry

```python
from pydantic_ai import ModelRetry

@agent.tool
async def search(ctx: RunContext[SearchClient], query: str) -> str:
    """Search the knowledge base."""
    results = await ctx.deps.search(query)
    if not results:
        raise ModelRetry("No results found. Try broader or different search terms.")
    return "\n".join(r.summary for r in results[:5])
```

Raising `ModelRetry(message)` sends the error back to the model as a tool-call error, letting it self-correct its arguments.

> **Deep dive:** See `references/agents-and-tools.md` for tool registration via constructor, `prepare` functions for dynamic tool filtering, result types and validators, and advanced output type patterns (unions, `ToolOutput`, `NativeOutput`).

---

## Dependency Injection with RunContext

The dependency system is explicit: define a deps type, pass it at run time, access it in tools and validators through `RunContext.deps`:

```python
from dataclasses import dataclass
from pydantic_ai import Agent, RunContext

@dataclass
class AppDeps:
    db: DatabasePool
    cache: RedisClient
    api_key: str

agent = Agent("anthropic:claude-sonnet-4-20250514", deps_type=AppDeps)

@agent.tool
async def fetch_order(ctx: RunContext[AppDeps], order_id: str) -> str:
    """Retrieve order details by ID."""
    cached = await ctx.deps.cache.get(f"order:{order_id}")
    if cached:
        return cached
    row = await ctx.deps.db.fetchrow("SELECT * FROM orders WHERE id = $1", order_id)
    return json.dumps(dict(row))

# At call site
deps = AppDeps(db=pool, cache=redis, api_key=os.environ["API_KEY"])
result = await agent.run("What's the status of order ORD-123?", deps=deps)
```

Dependencies can be any object -- a dataclass, a named tuple, a plain class, or even a single value. The `deps_type` annotation enables type checking throughout the tool chain.

---

## Model Configuration

### Model Selection

```python
# By string identifier (most common)
agent = Agent("anthropic:claude-sonnet-4-20250514")
agent = Agent("openai:gpt-5")
agent = Agent("google-gla:gemini-2.0-flash")

# Override at run time
result = await agent.run("prompt", model="openai:gpt-5")
```

### FallbackModel

Sequence multiple models; the framework switches to the next on API errors:

```python
from pydantic_ai.models.fallback import FallbackModel

fallback = FallbackModel("anthropic:claude-sonnet-4-20250514", "openai:gpt-5")
agent = Agent(fallback)
```

On failure of all models, raises `FallbackExceptionGroup`. By default only `ModelHTTPError` triggers fallback; validation errors use the retry mechanism instead.

### ModelSettings

Control generation parameters per-agent or per-run:

```python
from pydantic_ai import ModelSettings

agent = Agent(
    "openai:gpt-5",
    model_settings=ModelSettings(temperature=0.0, max_tokens=1000),
)

# Override per-run
result = await agent.run("prompt", model_settings={"temperature": 0.7})
```

Available settings: `temperature`, `max_tokens`, `top_p`, `timeout`, `seed`, `parallel_tool_calls`, `presence_penalty`, `frequency_penalty`, `stop_sequences`.

> **Deep dive:** See `references/models-and-streaming.md` for streaming patterns (text, structured, deltas), `VercelAIAdapter` for Svelte integration, `TestModel` and `FunctionModel` for testing, and usage tracking with `UsageLimits`.

---

## Streaming

### Text Streaming

```python
async with agent.run_stream("Tell me a story") as result:
    async for delta in result.stream_text(delta=True):
        print(delta, end="", flush=True)
```

`stream_text()` yields cumulative text by default. Pass `delta=True` for incremental chunks. The `debounce_by` parameter (default `0.1s`) batches rapid chunks to reduce overhead.

### Structured Output Streaming

```python
agent = Agent("openai:gpt-5", output_type=Story)

async with agent.run_stream("Write a story") as result:
    async for partial in result.stream_output(debounce_by=0.1):
        print(partial)  # Partially-validated Story objects
```

Each yielded object is a `Story` instance with whatever fields have been parsed so far. Validators with side effects should check `ctx.partial_output` to avoid running during intermediate validations.

---

## Testing

PydanticAI provides two test models that avoid real API calls:

### TestModel

Calls all registered tools and generates data matching output schemas procedurally:

```python
from pydantic_ai.models.test import TestModel

with agent.override(model=TestModel()):
    result = agent.run_sync("test prompt")
    assert isinstance(result.output, CityInfo)
```

### FunctionModel

Full control over model responses via a callback:

```python
from pydantic_ai.models.function import FunctionModel, AgentInfo
from pydantic_ai.messages import ModelResponse, TextPart

def mock_model(messages, info: AgentInfo) -> ModelResponse:
    return ModelResponse(parts=[TextPart("mocked response")])

with agent.override(model=FunctionModel(mock_model)):
    result = agent.run_sync("test")
    assert result.output == "mocked response"
```

### Safety Guard

Prevent accidental real API calls in test suites:

```python
from pydantic_ai import models
models.ALLOW_MODEL_REQUESTS = False  # Raises error if a non-test model is used
```

---

## VercelAIAdapter (Svelte Integration)

Bridge a PydanticAI agent to a Vercel AI SDK frontend with a single endpoint:

```python
from fastapi import FastAPI, Request, Response
from pydantic_ai import Agent
from pydantic_ai.ui.vercel_ai import VercelAIAdapter

app = FastAPI()
agent = Agent("anthropic:claude-sonnet-4-20250514", instructions="Be helpful.")

@app.post("/chat")
async def chat(request: Request) -> Response:
    return await VercelAIAdapter.dispatch_request(request, agent=agent)
```

On the Svelte side, consume with `@ai-sdk/svelte`:

```svelte
<script>
  import { useChat } from '@ai-sdk/svelte';
  const { messages, input, handleSubmit } = useChat({ api: '/chat' });
</script>
```

`VercelAIAdapter` translates PydanticAI's event format to the Vercel AI Data Stream Protocol automatically -- no custom SSE parsing needed.

---

## Ambiguity Policy

These defaults apply when the user does not specify a preference. State the assumption when making a choice so the user can override:

- **Model selection:** Default to `"anthropic:claude-sonnet-4-20250514"` for agents requiring tool use. Use `"openai:gpt-5"` only when the user specifies OpenAI.
- **Output type:** Default to `str` for conversational agents. Use a Pydantic model when the caller needs structured data.
- **Dependency injection:** Default to a dataclass for `deps_type` when multiple resources are needed. Use a single value when only one resource is injected.
- **Streaming:** Default to `run_stream()` when output is displayed to a user. Use `run()` for background/batch processing.
- **Testing:** Default to `TestModel` for unit tests. Use `FunctionModel` when specific response sequences are needed.
- **Frontend bridge:** Default to `VercelAIAdapter` when the frontend uses `@ai-sdk/svelte` or any Vercel AI SDK client.

---

## Reference Files

| File | Contents |
|------|----------|
| `references/agents-and-tools.md` | Agent constructor details, tool registration via constructor, `prepare` functions for dynamic tool sets, result types and validators, output type patterns (unions, ToolOutput, NativeOutput, PromptedOutput), ModelRetry mechanics |
| `references/models-and-streaming.md` | Model configuration, FallbackModel, streaming (text, structured, deltas), StreamedRunResult API, VercelAIAdapter integration, TestModel and FunctionModel for testing, usage tracking with UsageLimits, capture_run_messages |
