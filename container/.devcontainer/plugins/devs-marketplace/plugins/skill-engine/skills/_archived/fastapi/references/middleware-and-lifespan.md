# Middleware and Lifespan -- Deep Dive

## 1. Custom Middleware Patterns

### Function-Based Middleware

The simplest middleware form intercepts every request and response:

```python
import time
from fastapi import Request

@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration = time.perf_counter() - start
    response.headers["X-Process-Time"] = f"{duration:.4f}"
    return response
```

### Class-Based Middleware

For middleware with configuration or shared state, subclass `BaseHTTPMiddleware`:

```python
from starlette.middleware.base import BaseHTTPMiddleware

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

app.add_middleware(RequestIDMiddleware)
```

### Pure ASGI Middleware

For performance-critical middleware or when `BaseHTTPMiddleware` limitations apply (streaming response issues), write raw ASGI middleware:

```python
class RawTimingMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start = time.perf_counter()

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = dict(message.get("headers", []))
                duration = time.perf_counter() - start
                headers[b"x-process-time"] = str(duration).encode()
                message["headers"] = list(headers.items())
            await send(message)

        await self.app(scope, receive, send_wrapper)

app.add_middleware(RawTimingMiddleware)
```

Raw ASGI middleware avoids the `BaseHTTPMiddleware` limitation where the entire response body is consumed before the middleware can modify headers. This matters for streaming responses.

---

## 2. CORS Configuration

### Development Setup

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Production Setup

Restrict origins to known domains. Avoid `allow_origins=["*"]` when `allow_credentials=True` -- the CORS specification forbids this combination:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://app.example.com", "https://admin.example.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["X-Request-ID", "X-Process-Time"],
    max_age=600,  # preflight cache duration in seconds
)
```

### CORS with SSE

SSE connections use `GET` requests with `text/event-stream` accept headers. CORS applies normally. Ensure the SSE endpoint's origin is in `allow_origins` and that `expose_headers` includes any custom headers the client needs to read.

---

## 3. GZip Compression

```python
from fastapi.middleware.gzip import GZipMiddleware

app.add_middleware(GZipMiddleware, minimum_size=1000)
```

The `minimum_size` parameter (in bytes) prevents compressing small responses where the overhead exceeds the benefit. Default to 500-1000 bytes.

GZip middleware does not compress streaming responses (`StreamingResponse`, `EventSourceResponse`). SSE connections are already efficient for small, frequent messages.

---

## 4. Trusted Host Middleware

Prevent host header attacks by restricting accepted hostnames:

```python
from starlette.middleware.trustedhost import TrustedHostMiddleware

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["example.com", "*.example.com"],
)
```

Requests with unrecognized `Host` headers receive a 400 response. Include `localhost` during development or use a separate middleware configuration per environment.

---

## 5. Middleware Ordering

Middleware executes in reverse registration order (last registered runs first, closest to the application). Register in this order for typical applications:

```python
# Outermost (runs first on request, last on response)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["example.com"])
app.add_middleware(CORSMiddleware, allow_origins=["https://app.example.com"])
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(RequestIDMiddleware)
# Innermost (runs last on request, first on response)
```

The CORS middleware must run before any middleware that might reject the request, so it can handle preflight `OPTIONS` requests. GZip should run after CORS to compress all responses including CORS headers.

---

## 6. Lifespan Resource Management

The lifespan context manager replaces deprecated `on_startup` and `on_shutdown` events. Resources created during startup are shared across all requests:

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create shared resources
    app.state.db_pool = await create_pool(DATABASE_URL)
    app.state.redis = await aioredis.from_url(REDIS_URL)
    app.state.http_client = httpx.AsyncClient()

    yield  # Application runs

    # Shutdown: clean up resources
    await app.state.http_client.aclose()
    await app.state.redis.close()
    await app.state.db_pool.close()

app = FastAPI(lifespan=lifespan)
```

### Accessing Lifespan Resources

Access shared resources through `request.app.state` in handlers or dependencies:

```python
async def get_db_pool(request: Request):
    return request.app.state.db_pool

@app.get("/items")
async def list_items(pool = Depends(get_db_pool)):
    async with pool.acquire() as conn:
        return await conn.fetch("SELECT * FROM items")
```

### Multiple Resource Groups

For complex applications, compose lifespan from multiple context managers:

```python
from contextlib import asynccontextmanager, AsyncExitStack

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncExitStack() as stack:
        app.state.db = await stack.enter_async_context(create_db_pool())
        app.state.cache = await stack.enter_async_context(create_cache())
        app.state.bus = await stack.enter_async_context(create_event_bus())
        yield
```

`AsyncExitStack` ensures all resources are cleaned up in reverse order, even if one cleanup raises an exception.

---

## 7. Exception Handling in Middleware

### Catching Exceptions in Middleware

Middleware can catch and transform exceptions before they reach the default handler:

```python
@app.middleware("http")
async def error_handling_middleware(request: Request, call_next):
    try:
        response = await call_next(request)
        return response
    except Exception as exc:
        logger.exception("Unhandled error", extra={"path": request.url.path})
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )
```

### Exception Handlers vs Middleware

Use exception handlers (`@app.exception_handler`) for converting known exception types to HTTP responses. Use middleware for cross-cutting concerns (logging, timing, request modification) that apply to all requests regardless of outcome.

```python
class RateLimitExceeded(Exception):
    def __init__(self, retry_after: int):
        self.retry_after = retry_after

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded"},
        headers={"Retry-After": str(exc.retry_after)},
    )
```
