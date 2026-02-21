---
name: fastapi
description: >-
  This skill should be used when the user asks to "build a FastAPI app",
  "create a REST API with FastAPI", "add SSE streaming to FastAPI",
  "use dependency injection in FastAPI", "define Pydantic models for an API",
  "stream LLM responses with FastAPI", "add middleware to FastAPI",
  "handle background tasks in FastAPI", or discusses FastAPI routing,
  Pydantic v2 models, dependency injection, server-sent events,
  or ASGI middleware.
version: 0.1.0
---

# FastAPI Development

## Mental Model

FastAPI is a type-driven API framework where **path function signatures define the entire contract**. The function's parameters declare what the endpoint accepts (path params, query params, request body, dependencies); the return type annotation and `response_model` declare what it produces. Pydantic validates all input and output automatically -- there is no separate validation layer to configure.

Dependency injection wires shared resources (database sessions, auth checks, config) into handlers without global state. Dependencies compose and nest, forming a directed graph resolved at request time.

FastAPI runs on ASGI (Starlette), making every handler natively async-capable. This matters most for streaming -- SSE and chunked responses use async generators that yield data as it becomes available, keeping connections open without blocking worker threads.

Assume FastAPI 0.100+ with Pydantic v2 for all new code. When modifying an existing codebase using Pydantic v1 patterns, ask whether to migrate or preserve the existing style.

---

## Routing and Path Operations

Declare endpoints with HTTP method decorators on a FastAPI app or APIRouter. The decorator configures the operation; the function signature defines the contract:

```python
from fastapi import FastAPI, APIRouter, status
from pydantic import BaseModel

app = FastAPI()
router = APIRouter(prefix="/items", tags=["items"])

class ItemCreate(BaseModel):
    name: str
    price: float

class ItemResponse(BaseModel):
    id: int
    name: str
    price: float

@router.post("/", status_code=status.HTTP_201_CREATED, response_model=ItemResponse)
async def create_item(item: ItemCreate):
    record = await save_to_db(item)
    return record

@router.get("/{item_id}")
async def get_item(item_id: int, include_deleted: bool = False):
    return await fetch_item(item_id, include_deleted)

app.include_router(router)
```

Path parameters are extracted from the URL pattern and validated against the type annotation. Query parameters are any function parameters not found in the path. A parameter typed as a Pydantic model is parsed from the request body.

Use `APIRouter` to organize endpoints by domain. Each router gets its own prefix and tags, then mounts onto the app with `include_router`. Keep one router per domain module.

> **Deep dive:** See `references/routing-and-dependencies.md` for APIRouter organization, path operation configuration, WebSocket endpoints, nested/overridden dependencies, and testing patterns.

---

## Dependency Injection

Dependencies are callables (functions or classes) declared with `Depends()`. FastAPI resolves them per-request, injecting the result into the handler parameter:

```python
from typing import Annotated
from fastapi import Depends

async def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        await db.close()

DB = Annotated[AsyncSession, Depends(get_db)]

@router.get("/items/{item_id}")
async def get_item(item_id: int, db: DB):
    return await db.get(Item, item_id)
```

Generator dependencies (using `yield`) provide setup/teardown semantics -- the code before `yield` runs at request start, after `yield` at request end. This replaces middleware for resource lifecycle management.

Dependencies can depend on other dependencies, forming a graph. FastAPI resolves each unique dependency once per request (cached by default). Use `Annotated` type aliases to avoid repeating `Depends()` declarations across handlers.

---

## Request and Response Models

Pydantic v2 models define the shape of request bodies, response payloads, and query parameter groups. Separate input and output schemas to control what clients send versus what they receive:

```python
from pydantic import BaseModel, Field, field_validator
from datetime import datetime

class UserCreate(BaseModel):
    email: str
    password: str = Field(min_length=8)
    display_name: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if "@" not in v:
            raise ValueError("invalid email format")
        return v.lower()

class UserResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    email: str
    display_name: str | None
    created_at: datetime
```

Set `from_attributes = True` in model config to enable construction from ORM objects (replaces Pydantic v1's `orm_mode`). Use `Field()` for constraints (min/max length, regex, ge/le). Use `field_validator` for custom validation logic.

For polymorphic responses, use discriminated unions with a literal type field:

```python
from typing import Literal, Union
from pydantic import BaseModel

class TextMessage(BaseModel):
    type: Literal["text"] = "text"
    content: str

class ImageMessage(BaseModel):
    type: Literal["image"] = "image"
    url: str

Message = Union[TextMessage, ImageMessage]
```

> **Deep dive:** See `references/pydantic-models.md` for computed fields, model inheritance, custom JSON encoders, discriminated union patterns, and BaseSettings for configuration.

---

## Error Handling

Raise `HTTPException` for expected error conditions. FastAPI converts it to a JSON response with the specified status code:

```python
from fastapi import HTTPException, status

@router.get("/items/{item_id}")
async def get_item(item_id: int):
    item = await fetch_item(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )
    return item
```

Register custom exception handlers for domain exceptions and validation errors:

```python
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_handler(request, exc):
    return JSONResponse(status_code=422, content={"errors": exc.errors()})
```

---

## Server-Sent Events

SSE provides a persistent HTTP connection for server-to-client streaming. FastAPI handles SSE through `sse-starlette`, which wraps an async generator into a compliant event stream with proper `text/event-stream` headers, keep-alive, and reconnection support.

### Basic SSE Pattern

```python
from sse_starlette.sse import EventSourceResponse

async def event_generator():
    while True:
        event = await get_next_event()
        if event is None:
            break
        yield {"event": "update", "data": event.json(), "id": str(event.id)}

@app.get("/events")
async def stream_events():
    return EventSourceResponse(event_generator())
```

Each yielded dict maps to SSE fields: `data` (required), `event` (event type), `id` (last-event ID for reconnection), and `retry` (reconnection interval in ms). Yield a plain string to send a data-only event.

### LLM Streaming Pattern

Stream token-by-token responses from an LLM, forwarding chunks as they arrive:

```python
import json

async def stream_llm_response(prompt: str):
    response = await llm_client.chat.completions.create(
        model="claude-sonnet-4-20250514",
        messages=[{"role": "user", "content": prompt}],
        stream=True,
    )
    async for chunk in response:
        delta = chunk.choices[0].delta
        if delta.content:
            yield {"event": "token", "data": delta.content}
    yield {"event": "done", "data": ""}

@app.post("/chat")
async def chat(prompt: str):
    return EventSourceResponse(stream_llm_response(prompt))
```

### Reconnection and Backpressure

Clients reconnect automatically using the `Last-Event-ID` header. Accept this header in the generator to resume from the correct position:

```python
from fastapi import Request

async def resumable_generator(request: Request):
    last_id = request.headers.get("last-event-id")
    offset = int(last_id) + 1 if last_id else 0
    async for event in fetch_events_from(offset):
        if await request.is_disconnected():
            break
        yield {"data": event.json(), "id": str(event.id)}

@app.get("/events")
async def stream(request: Request):
    return EventSourceResponse(resumable_generator(request))
```

Check `request.is_disconnected()` periodically to detect dropped clients and stop generating events. For high-throughput scenarios, use a bounded `asyncio.Queue` to apply backpressure -- producers block when the queue is full rather than accumulating unbounded memory.

> **Deep dive:** See `references/sse-and-streaming.md` for the full SSE protocol, sse-starlette configuration, heartbeat keep-alive, disconnect detection patterns, bounded queue backpressure, LLM streaming with tool calls, and testing SSE endpoints.

---

## Middleware and Lifespan

### HTTP Middleware

Middleware wraps the entire request/response cycle. Use `@app.middleware("http")` for simple cases or subclass `BaseHTTPMiddleware` for complex logic:

```python
import time

@app.middleware("http")
async def add_timing_header(request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Process-Time"] = str(time.perf_counter() - start)
    return response
```

Add CORS support with the built-in middleware:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://example.com"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Lifespan

The lifespan context manager replaces `on_startup`/`on_shutdown` events. Resources created during startup are available to all handlers through the `app.state` object:

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    pool = await create_db_pool()
    app.state.db_pool = pool
    yield
    await pool.close()

app = FastAPI(lifespan=lifespan)
```

> **Deep dive:** See `references/middleware-and-lifespan.md` for custom middleware patterns, GZip compression, trusted host middleware, lifespan resource sharing, and exception handling in middleware.

---

## Background Tasks

Declare a `BackgroundTasks` parameter to schedule work that runs after the response is sent. Background tasks share the same process -- they are not distributed workers:

```python
from fastapi import BackgroundTasks

async def send_notification(email: str, message: str):
    await email_service.send(email, message)

@router.post("/orders")
async def create_order(order: OrderCreate, tasks: BackgroundTasks):
    record = await save_order(order)
    tasks.add_task(send_notification, order.email, "Order confirmed")
    return record
```

Background tasks are fire-and-forget. For work requiring reliability guarantees (retries, dead-letter queues), use a task queue like Celery or arq instead.

---

## Ambiguity Policy

These defaults apply when the user does not specify a preference. State the assumption when making a choice so the user can override:

- **Async vs sync handlers:** Default to `async def`. Use plain `def` only when calling blocking libraries that lack async support.
- **Pydantic version:** Default to Pydantic v2. Do not use v1 field definitions (`Field(...)` with `schema_extra`) or v1 validators (`@validator`).
- **Server:** Default to uvicorn for development, uvicorn with `--workers` for production.
- **SSE library:** Default to `sse-starlette` over raw `StreamingResponse` for SSE. Use `StreamingResponse` only for non-SSE streaming (file downloads, binary data).
- **Dependency style:** Default to `Annotated[Type, Depends()]` over bare `Depends()` in function signatures.
- **Project structure:** Default to one router per domain module with a central `app.include_router()` registration.

---

## Reference Files

| File | Contents |
|------|----------|
| `references/routing-and-dependencies.md` | APIRouter organization, path operation config, nested/overridden dependencies, WebSocket basics, testing endpoints |
| `references/pydantic-models.md` | Computed fields, model inheritance, custom encoders, discriminated unions, BaseSettings configuration |
| `references/sse-and-streaming.md` | Full SSE protocol, sse-starlette API, reconnection with Last-Event-ID, backpressure with bounded queues, heartbeats, disconnect detection, LLM streaming with tool calls, testing SSE |
| `references/middleware-and-lifespan.md` | Custom middleware patterns, CORS configuration, GZip, trusted hosts, lifespan resource management, exception handling in middleware |
