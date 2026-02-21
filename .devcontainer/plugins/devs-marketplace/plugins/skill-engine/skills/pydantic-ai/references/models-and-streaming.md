# Models and Streaming -- Deep Dive

## 1. Model Configuration

### Model Identifiers

PydanticAI uses string identifiers in the format `provider:model-name`:

```python
from pydantic_ai import Agent

# Anthropic
agent = Agent("anthropic:claude-sonnet-4-20250514")

# OpenAI
agent = Agent("openai:gpt-5")

# Google Gemini
agent = Agent("google-gla:gemini-2.0-flash")

# Groq
agent = Agent("groq:llama-3.3-70b-versatile")

# OpenAI-compatible endpoints (Ollama, vLLM, etc.)
from pydantic_ai.models.openai import OpenAIChatModel
model = OpenAIChatModel("llama3", base_url="http://localhost:11434/v1")
agent = Agent(model)
```

Override the model at run time without changing the agent definition:

```python
result = await agent.run("prompt", model="openai:gpt-5")
```

### ModelSettings

`ModelSettings` is a `TypedDict` controlling generation parameters. All fields are optional:

```python
from pydantic_ai import Agent, ModelSettings

agent = Agent(
    "openai:gpt-5",
    model_settings=ModelSettings(
        temperature=0.0,
        max_tokens=2000,
        top_p=0.95,
        seed=42,
        timeout=30.0,
        parallel_tool_calls=True,
    ),
)
```

Precedence (lowest to highest):
1. Model defaults
2. `Agent(model_settings=...)` -- agent-level
3. `agent.run(model_settings=...)` -- per-run

Available fields: `temperature`, `max_tokens`, `top_p`, `timeout`, `seed`, `parallel_tool_calls`, `presence_penalty`, `frequency_penalty`, `logit_bias`, `stop_sequences`, `extra_headers`, `extra_body`.

---

## 2. FallbackModel

Sequence multiple models for resilience. The framework tries each model in order and switches on API errors:

```python
from pydantic_ai.models.fallback import FallbackModel

fallback = FallbackModel(
    "anthropic:claude-sonnet-4-20250514",
    "openai:gpt-5",
    "google-gla:gemini-2.0-flash",
)
agent = Agent(fallback)
```

Behavior:
- Only `ModelHTTPError` and `ModelAPIError` trigger fallback by default.
- Validation errors (bad tool arguments, output schema mismatch) use the retry mechanism, not fallback.
- If all models fail, raises `FallbackExceptionGroup` containing all individual exceptions.
- Custom trigger: pass `fallback_on` to specify which exception types trigger fallback.

```python
from pydantic_ai.exceptions import ModelHTTPError

fallback = FallbackModel(
    "anthropic:claude-sonnet-4-20250514",
    "openai:gpt-5",
    fallback_on=(ModelHTTPError, TimeoutError),
)
```

---

## 3. Streaming

### Text Streaming

```python
async with agent.run_stream("Tell me a story") as result:
    # Cumulative text (each iteration includes all previous text)
    async for text in result.stream_text():
        print(text)

    # Delta mode (each iteration is only the new chunk)
    async for delta in result.stream_text(delta=True):
        print(delta, end="", flush=True)
```

### Structured Output Streaming

When the agent has a Pydantic output type, stream partially-validated objects:

```python
from pydantic import BaseModel

class Story(BaseModel):
    title: str
    chapters: list[str]

agent = Agent("openai:gpt-5", output_type=Story)

async with agent.run_stream("Write a story") as result:
    async for partial_story in result.stream_output(debounce_by=0.1):
        # partial_story is a Story instance with whatever fields have been parsed
        print(partial_story.title if hasattr(partial_story, 'title') else "...")
```

The `debounce_by` parameter (default `0.1` seconds) batches rapid chunks to reduce Pydantic validation overhead. Set to `None` for maximum responsiveness.

### Sync Streaming

```python
with agent.run_stream_sync("Tell me a story") as result:
    for delta in result.stream_text(delta=True):
        print(delta, end="", flush=True)
```

### StreamedRunResult API

```python
class StreamedRunResult:
    # Streaming iterators
    async def stream_text(delta: bool = False, debounce_by: float | None = 0.1) -> AsyncIterator[str]
    async def stream_output(debounce_by: float | None = 0.1) -> AsyncIterator[OutputDataT]
    async def get_output() -> OutputDataT          # consume stream, return final result

    # State
    is_complete: bool

    # Messages and usage
    def all_messages() -> list[ModelMessage]
    def new_messages() -> list[ModelMessage]
    def usage() -> RunUsage
```

---

## 4. VercelAIAdapter

`VercelAIAdapter` bridges PydanticAI agents to Vercel AI SDK frontends. It translates PydanticAI's streaming events into the Vercel AI Data Stream Protocol.

### FastAPI Integration

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

`dispatch_request` handles the full lifecycle:
1. Parses the Vercel AI SDK request body (messages, model settings).
2. Converts frontend messages to PydanticAI's `ModelMessage` format.
3. Runs the agent in streaming mode.
4. Encodes PydanticAI events as Vercel AI Data Stream Protocol SSE.
5. Returns a `StreamingResponse`.

### With Dependencies

```python
@app.post("/chat")
async def chat(request: Request, db: DB) -> Response:
    return await VercelAIAdapter.dispatch_request(
        request,
        agent=agent,
        deps=AppDeps(db=db),
    )
```

### Manual Usage (Non-Starlette)

```python
adapter = VercelAIAdapter(agent=agent, run_input=request_data, accept="text/event-stream")
event_stream = adapter.run_stream()          # AsyncIterator[VercelAIEvent]
sse_stream = adapter.encode_stream(event_stream)  # AsyncIterator[str] (SSE-formatted)
```

### Message Conversion

Convert between PydanticAI and Vercel AI message formats:

```python
# Frontend messages -> PydanticAI messages
pydantic_messages = VercelAIAdapter.load_messages(ui_messages)

# PydanticAI messages -> frontend messages
ui_messages = VercelAIAdapter.dump_messages(pydantic_messages)
```

### Svelte Frontend

```svelte
<script>
  import { useChat } from '@ai-sdk/svelte';
  const { messages, input, handleSubmit, isLoading } = useChat({ api: '/chat' });
</script>

<div>
  {#each $messages as message}
    <p><strong>{message.role}:</strong> {message.content}</p>
  {/each}
</div>

<form onsubmit={handleSubmit}>
  <input bind:value={$input} placeholder="Type a message..." />
  <button type="submit" disabled={$isLoading}>Send</button>
</form>
```

The `useChat` hook manages conversation state, streaming, and message history automatically. The protocol translation is fully handled by `VercelAIAdapter` on the backend.

---

## 5. TestModel

`TestModel` is a procedural model that calls all registered tools and generates data matching output schemas without making real API calls:

```python
from pydantic_ai.models.test import TestModel

with agent.override(model=TestModel()):
    result = agent.run_sync("test prompt")
    assert isinstance(result.output, CityInfo)
```

`TestModel` behavior:
- Calls each registered tool once with generated arguments matching the tool's parameter schema.
- If the agent has a structured `output_type`, generates a response matching the output schema.
- If the output type is `str`, returns `"Final response"` (or a custom string).

Custom text output:

```python
with agent.override(model=TestModel(custom_output_text="Paris is beautiful")):
    result = agent.run_sync("Tell me about Paris")
    assert result.output == "Paris is beautiful"
```

### Override for Dependency Swapping

`agent.override()` replaces both model and dependencies:

```python
mock_deps = AppDeps(db=FakeDB(), cache=FakeCache(), api_key="test")

with agent.override(model=TestModel(), deps=mock_deps):
    result = agent.run_sync("test")
```

---

## 6. FunctionModel

Full control over model responses via a callback function:

```python
from pydantic_ai.models.function import FunctionModel, AgentInfo
from pydantic_ai.messages import ModelResponse, TextPart, ToolCallPart

def my_model(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
    # info.function_tools lists available tools with their schemas
    if info.function_tools:
        tool = info.function_tools[0]
        return ModelResponse(parts=[
            ToolCallPart(tool_name=tool.name, args={"query": "test"})
        ])
    return ModelResponse(parts=[TextPart("mock response")])

with agent.override(model=FunctionModel(my_model)):
    result = await agent.run("test")
```

The callback receives:
- **`messages`**: The full conversation history as `list[ModelMessage]`.
- **`info`**: An `AgentInfo` object with `function_tools` (list of tool definitions), `output_tools` (output schema tools), `model_settings`, and `allow_text_output`.

### Async FunctionModel

```python
async def async_model(messages, info: AgentInfo) -> ModelResponse:
    await asyncio.sleep(0.1)  # simulate latency
    return ModelResponse(parts=[TextPart("async mock")])

with agent.override(model=FunctionModel(async_model)):
    result = await agent.run("test")
```

### Streaming FunctionModel

Return a `StreamedResponse` for streaming tests:

```python
from pydantic_ai.models.function import FunctionModel, StreamedResponse

def streaming_model(messages, info):
    return StreamedResponse(
        model_name="test-model",
        timestamp=datetime.now(),
    )
```

---

## 7. Usage Tracking

### RunUsage

Every run returns usage statistics:

```python
result = await agent.run("prompt")
usage = result.usage()

print(usage.requests)       # number of API round-trips
print(usage.input_tokens)   # total input tokens across all requests
print(usage.output_tokens)  # total output tokens
print(usage.total_tokens)   # input + output
print(usage.tool_calls)     # number of tool executions
```

### UsageLimits

Enforce hard limits on resource consumption:

```python
from pydantic_ai import UsageLimits

result = await agent.run(
    "prompt",
    usage_limits=UsageLimits(
        request_limit=10,           # max API requests (default 50)
        input_tokens_limit=10000,
        output_tokens_limit=5000,
        total_tokens_limit=15000,
        tool_calls_limit=20,
    ),
)
```

Exceeding any limit raises `UsageLimitExceeded`. The default `request_limit` is 50 -- this prevents infinite tool-call loops.

### Aggregating Usage Across Runs

```python
total_usage = RunUsage()

for prompt in prompts:
    result = await agent.run(prompt)
    total_usage += result.usage()

print(f"Total tokens: {total_usage.total_tokens}")
print(f"Total requests: {total_usage.requests}")
```

---

## 8. Capturing Messages for Assertions

Use `capture_run_messages` to inspect the full message exchange in tests:

```python
from pydantic_ai import capture_run_messages

with capture_run_messages() as messages:
    result = await agent.run("What's the weather?", deps=deps)

# messages is a list of ModelMessage objects
assert any("weather" in str(m) for m in messages)
```

This captures all messages exchanged during the run, including system prompts, user messages, tool calls, tool responses, and the final output. Useful for verifying that the agent called the expected tools with the expected arguments.

---

## 9. Preventing Accidental Real Requests

In test suites, set the global guard at the module or conftest level:

```python
# conftest.py
import pydantic_ai.models
pydantic_ai.models.ALLOW_MODEL_REQUESTS = False
```

Any attempt to use a real model (not `TestModel` or `FunctionModel`) raises an error immediately. Use `agent.override()` to swap in test models:

```python
def test_agent_behavior():
    with agent.override(model=TestModel()):
        result = agent.run_sync("test")
        assert result.output is not None
```
