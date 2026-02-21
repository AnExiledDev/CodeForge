# Agents and Tools -- Deep Dive

## 1. Agent Constructor Details

The `Agent` class is generic: `Agent[AgentDepsT, OutputDataT]`. The full constructor accepts:

```python
from pydantic_ai import Agent, Tool

agent = Agent(
    model="anthropic:claude-sonnet-4-20250514",  # or Model instance, or None
    output_type=str,                    # BaseModel, dataclass, TypedDict, list, ToolOutput, etc.
    instructions="Be concise.",         # static str or Callable[[RunContext], str]
    system_prompt="Always respond in JSON.",  # static, preserved in history
    deps_type=type(None),               # type of the deps object
    name="my-agent",                    # optional display name
    model_settings={"temperature": 0},  # default ModelSettings
    retries=1,                          # default tool retry count
    end_strategy="early",              # "early" or "exhaustive"
    tools=[my_func, Tool(other_func, takes_ctx=False)],
    tool_timeout=30.0,                  # global tool execution timeout in seconds
)
```

### Dynamic Instructions

Instructions can be a callable that receives `RunContext` and returns a string. This enables per-run customization based on dependencies:

```python
agent = Agent(
    "openai:gpt-5",
    deps_type=UserContext,
    instructions=lambda ctx: f"The current user is {ctx.deps.username}. Respond in {ctx.deps.language}.",
)
```

The `@agent.instructions` decorator is equivalent:

```python
@agent.instructions
def build_instructions(ctx: RunContext[UserContext]) -> str:
    return f"The current user is {ctx.deps.username}."
```

Instructions differ from `system_prompt` in one critical way: instructions are re-evaluated per run and excluded when `message_history` is provided. System prompts are static and always included.

---

## 2. Tool Registration via Constructor

Tools can be registered via decorators or passed directly to the constructor. Constructor registration is useful when tools are defined in separate modules:

```python
from pydantic_ai import Agent, Tool

async def search_docs(ctx: RunContext[Deps], query: str) -> str:
    """Search the documentation."""
    return await ctx.deps.search(query)

def get_time() -> str:
    """Get the current UTC time."""
    return datetime.utcnow().isoformat()

agent = Agent(
    "openai:gpt-5",
    deps_type=Deps,
    tools=[
        search_docs,                          # auto-detects RunContext
        Tool(get_time, takes_ctx=False),       # explicit: no context
        Tool(search_docs, name="doc_search"),  # custom name
    ],
)
```

The `Tool` wrapper accepts:
- **`takes_ctx`**: Explicitly declare whether the function expects `RunContext` as its first parameter.
- **`name`** / **`description`**: Override the function name or docstring.
- **`retries`**: Override the agent-level retry count.
- **`prepare`**: Dynamic preparation function.

---

## 3. Prepare Functions for Dynamic Tool Sets

A `prepare` function runs before each model request, allowing tools to be included, excluded, or modified based on the current run state:

```python
from pydantic_ai import Agent, RunContext
from pydantic_ai.tools import ToolDefinition

async def filter_admin_tools(
    ctx: RunContext[UserDeps], tool_def: ToolDefinition
) -> ToolDefinition | None:
    """Only include this tool if the user has admin role."""
    if ctx.deps.user_role != "admin":
        return None  # exclude tool from this run
    return tool_def  # include unmodified

@agent.tool(prepare=filter_admin_tools)
async def delete_user(ctx: RunContext[UserDeps], user_id: int) -> str:
    """Delete a user account permanently."""
    await ctx.deps.db.execute("DELETE FROM users WHERE id = $1", user_id)
    return f"Deleted user {user_id}"
```

Returning `None` removes the tool. Returning a modified `ToolDefinition` changes the schema or description sent to the model. The agent-level `prepare_tools` parameter applies a prepare function to all tools.

---

## 4. Result Types and Validators

### Output Type Patterns

**Single Pydantic model** -- the most common pattern:

```python
class WeatherReport(BaseModel):
    city: str
    temperature_c: float
    conditions: str

agent = Agent("openai:gpt-5", output_type=WeatherReport)
```

**Union of types** -- the model chooses which type to return:

```python
agent = Agent("openai:gpt-5", output_type=[WeatherReport, ErrorReport])
```

Each type becomes a separate tool the model can call. The first successful tool call ends the run (with `end_strategy="early"`).

**Named tool outputs** -- control the tool names:

```python
from pydantic_ai import ToolOutput

agent = Agent(
    "openai:gpt-5",
    output_type=[
        ToolOutput(WeatherReport, name="return_weather", description="Return weather data"),
        ToolOutput(ErrorReport, name="return_error", description="Report an error"),
    ],
)
```

**NativeOutput** -- use the model's built-in structured output (JSON mode):

```python
from pydantic_ai import NativeOutput

agent = Agent("openai:gpt-5", output_type=NativeOutput(WeatherReport))
```

Not all models support native structured output. Falls back to tool-based output automatically.

**PromptedOutput** -- inject the schema into the prompt instead of using tools:

```python
from pydantic_ai import PromptedOutput

agent = Agent(
    "openai:gpt-5",
    output_type=PromptedOutput(WeatherReport, template="Respond with JSON matching: {schema}"),
)
```

**TextOutput** -- process plain text through a function:

```python
from pydantic_ai import TextOutput

def parse_csv(text: str) -> list[str]:
    return [line.strip() for line in text.split(",")]

agent = Agent("openai:gpt-5", output_type=TextOutput(parse_csv))
```

**Output functions** -- the model calls a function to produce the result:

```python
def save_report(title: str, content: str, priority: int) -> str:
    """Save a report to the database."""
    db.save(Report(title=title, content=content, priority=priority))
    return f"Saved: {title}"

agent = Agent("openai:gpt-5", output_type=[save_report])
```

### Result Validators

Validators run after the model produces output. They can transform the output or reject it:

```python
@agent.output_validator
async def validate_weather(ctx: RunContext[Deps], output: WeatherReport) -> WeatherReport:
    if output.temperature_c < -90 or output.temperature_c > 60:
        raise ModelRetry("Temperature is outside realistic range. Check the data.")
    return output
```

Raising `ModelRetry` sends the error message back to the model for self-correction. The validator reruns up to `output_retries` times (defaults to `retries`).

During streaming, `ctx.partial_output` is `True` for intermediate validations. Skip side effects when partial:

```python
@agent.output_validator
async def validate_with_side_effect(ctx: RunContext[Deps], output: Report) -> Report:
    if not ctx.partial_output:
        await ctx.deps.audit_log.record(output)
    return output
```

---

## 5. AgentRunResult

The return value of `agent.run()` and `agent.run_sync()`:

```python
result = await agent.run("prompt", deps=deps)

result.output          # typed OutputDataT
result.usage()         # RunUsage(requests=N, input_tokens=..., output_tokens=...)
result.all_messages()  # full conversation history including system prompts
result.new_messages()  # only messages from this run (for conversation continuation)
result.run_id          # unique identifier for this run
```

### Conversation Continuation

Pass `message_history` to continue a previous conversation:

```python
result1 = await agent.run("What's the weather in Paris?", deps=deps)
result2 = await agent.run(
    "What about London?",
    deps=deps,
    message_history=result1.all_messages(),
)
```

When `message_history` is provided, `instructions` are not included (they were already in the history). `system_prompt` is always included.

---

## 6. ModelRetry Mechanics

When a tool raises `ModelRetry(message)`:

1. The framework sends the error message back to the model as a tool-call error response.
2. The model generates a new tool call (presumably with corrected arguments).
3. The tool runs again with the new arguments.
4. This repeats up to `retries` times (per-tool or per-agent setting).
5. If retries are exhausted, the underlying `ValidationError` or `ModelRetry` propagates as an exception.

```python
from pydantic_ai import ModelRetry

@agent.tool(retries=3)
async def query_api(ctx: RunContext[Deps], endpoint: str, params: dict) -> str:
    """Query the external API."""
    if not endpoint.startswith("/api/"):
        raise ModelRetry("Endpoint must start with /api/. Available: /api/users, /api/orders")
    response = await ctx.deps.http.get(endpoint, params=params)
    if response.status_code == 404:
        raise ModelRetry(f"Endpoint {endpoint} returned 404. Try a different endpoint.")
    return response.text
```

`ModelRetry` is distinct from Python exceptions -- it signals a recoverable error that the model can fix by adjusting its tool-call arguments.
