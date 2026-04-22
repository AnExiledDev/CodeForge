# Server-Sent Events and Streaming -- Deep Dive

## 1. SSE Protocol Fundamentals

Server-Sent Events use a persistent HTTP connection with `Content-Type: text/event-stream`. The server writes UTF-8 text frames separated by double newlines. Each frame contains one or more fields:

```
event: message
id: 42
retry: 5000
data: {"text": "hello"}

```

| Field | Purpose | Default |
|-------|---------|---------|
| `data` | Event payload (required) | -- |
| `event` | Event type name | `"message"` |
| `id` | Last-event ID for reconnection | none |
| `retry` | Client reconnection interval (ms) | browser default (~3s) |

Multiple `data` lines in one frame are concatenated with newlines. A line starting with `:` is a comment -- browsers ignore it, but it serves as a keep-alive heartbeat.

---

## 2. sse-starlette API

`sse-starlette` wraps an async iterable into a compliant `EventSourceResponse`. Install with `pip install sse-starlette`.

### Basic Configuration

```python
from sse_starlette.sse import EventSourceResponse

@app.get("/events")
async def stream():
    return EventSourceResponse(
        content=event_generator(),
        media_type="text/event-stream",
        ping=30,           # heartbeat interval in seconds
        ping_message_factory=lambda: {"comment": "keep-alive"},
    )
```

### Yielding Events

The generator can yield several formats:

```python
async def event_generator():
    # Dict with SSE fields
    yield {"event": "status", "data": "connected", "id": "1"}

    # Plain string -- becomes a data-only event
    yield "simple message"

    # Dict with just data
    yield {"data": '{"count": 42}'}

    # ServerSentEvent object for full control
    from sse_starlette.sse import ServerSentEvent
    yield ServerSentEvent(data="precise", event="custom", id="2", retry=10000)
```

---

## 3. Reconnection with Last-Event-ID

Browsers automatically reconnect when an SSE connection drops. They send the last received `id` in the `Last-Event-ID` header. Use this to resume the stream without replaying events the client already received:

```python
from fastapi import Request

async def resumable_stream(request: Request):
    last_id = request.headers.get("last-event-id")
    cursor = int(last_id) + 1 if last_id else 0

    async for event in fetch_events_from(cursor):
        yield {
            "event": "update",
            "data": event.to_json(),
            "id": str(event.sequence_id),
        }
```

### Designing for Resumability

- Assign monotonically increasing IDs (database sequence, timestamp, or counter).
- Store events in a bounded buffer or persistent log so the server can replay from any recent ID.
- Set `retry` to control how quickly clients reconnect (default is ~3 seconds).
- Send an initial "snapshot" event on reconnection if the gap is too large to replay individual events.

---

## 4. Backpressure with Bounded Queues

When an event source produces faster than clients consume, unbounded buffering causes memory growth. Use `asyncio.Queue` with a maximum size to apply backpressure:

```python
import asyncio

class EventBus:
    def __init__(self):
        self.subscribers: list[asyncio.Queue] = []

    def subscribe(self, maxsize: int = 100) -> asyncio.Queue:
        queue = asyncio.Queue(maxsize=maxsize)
        self.subscribers.append(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        self.subscribers.remove(queue)

    async def publish(self, event: dict):
        for queue in self.subscribers:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                # Drop oldest event to make room
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                queue.put_nowait(event)

bus = EventBus()
```

```python
async def subscriber_generator(request: Request):
    queue = bus.subscribe(maxsize=100)
    try:
        while True:
            if await request.is_disconnected():
                break
            try:
                event = await asyncio.wait_for(queue.get(), timeout=30)
                yield {"data": json.dumps(event)}
            except asyncio.TimeoutError:
                yield {"comment": "keep-alive"}
    finally:
        bus.unsubscribe(queue)
```

The drop-oldest strategy keeps the client close to real-time. Alternative strategies: block the producer (`await queue.put()`), drop the newest event, or disconnect slow clients.

---

## 5. Heartbeats and Keep-Alive

Proxies, load balancers, and CDNs may close idle connections. Send periodic heartbeat comments to keep the connection alive:

```python
async def heartbeat_generator():
    event_iter = aiter(fetch_events())
    while True:
        try:
            event = await asyncio.wait_for(anext(event_iter), timeout=15)
            yield {"data": event.json(), "id": str(event.id)}
        except asyncio.TimeoutError:
            yield {"comment": "heartbeat"}
        except StopAsyncIteration:
            break
```

`sse-starlette` provides built-in ping support via the `ping` parameter (interval in seconds). Use the built-in ping for simple cases; implement custom heartbeats when the heartbeat needs to carry data (e.g., server timestamp, queue depth).

---

## 6. Disconnect Detection

Detect client disconnection to stop generating events and release resources:

```python
from fastapi import Request

async def safe_generator(request: Request):
    try:
        async for chunk in data_source():
            if await request.is_disconnected():
                break
            yield {"data": chunk}
    finally:
        await cleanup_resources()
```

`request.is_disconnected()` is an async check -- call it between yields, not inside tight loops. For generators driven by a queue, the `finally` block handles cleanup when the client disconnects and `EventSourceResponse` cancels the generator.

---

## 7. LLM Streaming with Tool Calls

Stream LLM responses that may include interleaved text and tool-use events. Structure events by type so the client can render text incrementally while handling tool calls separately:

```python
import json

async def stream_with_tools(messages: list[dict]):
    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        messages=messages,
        tools=tool_definitions,
        stream=True,
    )

    async for event in response:
        if event.type == "content_block_start":
            if event.content_block.type == "text":
                yield {"event": "text_start", "data": ""}
            elif event.content_block.type == "tool_use":
                yield {
                    "event": "tool_start",
                    "data": json.dumps({
                        "id": event.content_block.id,
                        "name": event.content_block.name,
                    }),
                }
        elif event.type == "content_block_delta":
            if event.delta.type == "text_delta":
                yield {"event": "text_delta", "data": event.delta.text}
            elif event.delta.type == "input_json_delta":
                yield {"event": "tool_delta", "data": event.delta.partial_json}
        elif event.type == "message_stop":
            yield {"event": "done", "data": ""}
```

### Client-Side Handling (JavaScript)

```javascript
const source = new EventSource("/chat");

source.addEventListener("text_delta", (e) => {
  appendToOutput(e.data);
});

source.addEventListener("tool_start", (e) => {
  const { id, name } = JSON.parse(e.data);
  startToolIndicator(id, name);
});

source.addEventListener("done", () => {
  source.close();
});
```

---

## 8. Testing SSE Endpoints

### Unit Testing with httpx

```python
import pytest
from httpx import AsyncClient, ASGITransport

@pytest.mark.anyio
async def test_sse_stream():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        async with client.stream("GET", "/events") as response:
            assert response.headers["content-type"] == "text/event-stream"
            events = []
            async for line in response.aiter_lines():
                if line.startswith("data:"):
                    events.append(line[5:].strip())
                if len(events) >= 3:
                    break
            assert len(events) == 3
```

### Parsing SSE Lines

```python
def parse_sse_events(raw_lines: list[str]) -> list[dict]:
    events = []
    current = {}
    for line in raw_lines:
        if line == "":
            if current:
                events.append(current)
                current = {}
        elif line.startswith("event:"):
            current["event"] = line[6:].strip()
        elif line.startswith("data:"):
            data = line[5:].strip()
            current["data"] = current.get("data", "") + data
        elif line.startswith("id:"):
            current["id"] = line[3:].strip()
    if current:
        events.append(current)
    return events
```

### Testing Reconnection

```python
@pytest.mark.anyio
async def test_sse_reconnection():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # First connection -- collect some events
        headers = {}
        async with client.stream("GET", "/events", headers=headers) as resp:
            last_id = None
            async for line in resp.aiter_lines():
                if line.startswith("id:"):
                    last_id = line[3:].strip()
                    break

        # Reconnect with Last-Event-ID
        headers = {"Last-Event-ID": last_id}
        async with client.stream("GET", "/events", headers=headers) as resp:
            async for line in resp.aiter_lines():
                if line.startswith("data:"):
                    event = json.loads(line[5:].strip())
                    assert event["sequence"] > int(last_id)
                    break
```
