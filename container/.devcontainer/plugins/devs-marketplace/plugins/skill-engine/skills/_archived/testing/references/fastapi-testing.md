# FastAPI Testing -- Deep Dive

## 1. AsyncClient Setup

### Basic Fixture

```python
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
```

### With Lifespan Events

`AsyncClient` does not trigger ASGI lifespan events. Install `asgi-lifespan` to handle startup/shutdown:

```python
from asgi_lifespan import LifespanManager

@pytest.fixture
async def client():
    async with LifespanManager(app) as manager:
        transport = ASGITransport(app=manager.app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac
```

### pytest Configuration

```toml
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

With pytest-anyio (alternative to pytest-asyncio):

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
```

Mark async tests explicitly when not using `asyncio_mode = "auto"`:

```python
@pytest.mark.anyio
async def test_endpoint(client: AsyncClient):
    response = await client.get("/")
    assert response.status_code == 200
```

---

## 2. Dependency Override Patterns

### Basic Override

```python
from app.dependencies import get_db

async def mock_db():
    yield FakeDatabase()

@pytest.fixture
async def client():
    app.dependency_overrides[get_db] = mock_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
```

### Authentication Bypass

```python
from app.dependencies import get_current_user
from app.models import User

async def mock_admin():
    return User(id=1, email="admin@test.com", role="admin")

async def mock_regular_user():
    return User(id=2, email="user@test.com", role="user")

@pytest.fixture
async def admin_client():
    app.dependency_overrides[get_current_user] = mock_admin
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()

@pytest.fixture
async def user_client():
    app.dependency_overrides[get_current_user] = mock_regular_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
```

### Parameterized Override Fixture

```python
@pytest.fixture
def override_user():
    """Factory fixture for custom user overrides."""
    def _override(user: User):
        app.dependency_overrides[get_current_user] = lambda: user
    return _override

@pytest.mark.anyio
async def test_owner_access(client, override_user):
    override_user(User(id=5, email="owner@test.com", role="owner"))
    response = await client.get("/admin/settings")
    assert response.status_code == 200
```

---

## 3. SSE Stream Testing

### With httpx-sse

```bash
pip install httpx-sse
```

```python
import pytest
from httpx import ASGITransport, AsyncClient
from httpx_sse import aconnect_sse
from app.main import app

@pytest.mark.anyio
async def test_sse_stream():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        async with aconnect_sse(ac, "GET", "/events") as event_source:
            events = []
            async for sse in event_source.aiter_sse():
                events.append(sse)
                if len(events) >= 3:
                    break

            assert len(events) == 3
            assert events[0].event == "update"
            assert events[0].data  # non-empty data
```

### Asserting Event Structure

```python
@pytest.mark.anyio
async def test_sse_event_types():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        async with aconnect_sse(ac, "POST", "/chat", json={"prompt": "Hello"}) as event_source:
            events = []
            async for sse in event_source.aiter_sse():
                events.append({"event": sse.event, "data": sse.data})

            # Verify event sequence
            event_types = [e["event"] for e in events]
            assert "token" in event_types
            assert event_types[-1] == "done"
```

### Raw Stream Testing (Without httpx-sse)

```python
@pytest.mark.anyio
async def test_sse_raw_stream():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        async with ac.stream("GET", "/events") as response:
            assert response.status_code == 200
            assert "text/event-stream" in response.headers["content-type"]

            lines = []
            async for line in response.aiter_lines():
                if line.startswith("data:"):
                    lines.append(line.removeprefix("data: "))
            assert len(lines) >= 1
```

---

## 4. WebSocket Testing

WebSocket testing uses the synchronous `TestClient`:

```python
from fastapi.testclient import TestClient
from app.main import app

def test_websocket_echo():
    client = TestClient(app)
    with client.websocket_connect("/ws") as ws:
        ws.send_text("hello")
        data = ws.receive_text()
        assert data == "Echo: hello"

def test_websocket_json():
    client = TestClient(app)
    with client.websocket_connect("/ws/json") as ws:
        ws.send_json({"action": "ping"})
        response = ws.receive_json()
        assert response["action"] == "pong"

def test_websocket_disconnect():
    client = TestClient(app)
    with client.websocket_connect("/ws") as ws:
        ws.send_text("hello")
        ws.receive_text()
    # Connection is closed after the context manager exits
```

Available WebSocket test methods:

| Method | Purpose |
|--------|---------|
| `ws.send_text(data)` | Send text frame |
| `ws.send_bytes(data)` | Send binary frame |
| `ws.send_json(data)` | Send JSON |
| `ws.receive_text()` | Receive text frame |
| `ws.receive_bytes()` | Receive binary frame |
| `ws.receive_json()` | Receive JSON |
| `ws.close(code=1000)` | Close connection |

---

## 5. Background Task Testing

### Assert Task Was Scheduled

```python
from unittest.mock import AsyncMock, patch

@pytest.mark.anyio
async def test_order_sends_notification(client: AsyncClient):
    with patch("app.tasks.send_notification", new_callable=AsyncMock) as mock_notify:
        response = await client.post("/orders", json={"item": "Widget", "email": "a@b.com"})
        assert response.status_code == 201

    # Background task executes before TestClient returns
    mock_notify.assert_called_once_with("a@b.com", "Order confirmed")
```

### Prevent Side Effects

```python
@pytest.mark.anyio
async def test_order_no_email(client: AsyncClient, monkeypatch):
    monkeypatch.setattr("app.tasks.send_notification", lambda *a, **kw: None)
    response = await client.post("/orders", json={"item": "Widget", "email": "a@b.com"})
    assert response.status_code == 201
```

Note: With `TestClient` (synchronous), background tasks typically execute synchronously before the response returns. With `AsyncClient`, background tasks may or may not complete before the test assertion -- use mocking to control behavior deterministically.

---

## 6. Database Fixtures with aiosqlite

### Session-Scoped Engine + Function-Scoped Transactions

```python
import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.database import get_db, Base

@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"

@pytest.fixture(scope="session")
async def engine():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()

@pytest.fixture
async def db_session(engine):
    session_factory = async_sessionmaker(engine, class_=AsyncSession)
    async with session_factory() as session:
        async with session.begin():
            yield session
            await session.rollback()

@pytest.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()
```

### Seeded Data Fixture

```python
@pytest.fixture
async def seeded_db(db_session):
    """Pre-populate the database with test data."""
    db_session.add_all([
        Item(name="Widget", price=9.99),
        Item(name="Gadget", price=19.99),
    ])
    await db_session.flush()
    return db_session

@pytest.mark.anyio
async def test_list_items(client: AsyncClient, seeded_db):
    response = await client.get("/items/")
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 2
    assert items[0]["name"] == "Widget"
```

### Raw aiosqlite (Without SQLAlchemy)

```python
import aiosqlite

@pytest.fixture
async def db():
    async with aiosqlite.connect(":memory:") as db:
        await db.execute("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT, price REAL)")
        await db.commit()
        yield db

@pytest.fixture
async def client(db):
    async def override_get_db():
        yield db
    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
```

---

## 7. Testing Patterns

### Error Response Testing

```python
@pytest.mark.anyio
async def test_item_not_found(client: AsyncClient):
    response = await client.get("/items/99999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Item not found"

@pytest.mark.anyio
async def test_validation_error(client: AsyncClient):
    response = await client.post("/items/", json={"name": ""})
    assert response.status_code == 422
```

### Header and Cookie Testing

```python
@pytest.mark.anyio
async def test_auth_header_required(client: AsyncClient):
    response = await client.get("/protected")
    assert response.status_code == 401

@pytest.mark.anyio
async def test_with_auth(client: AsyncClient):
    response = await client.get(
        "/protected",
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 200
```

### File Upload Testing

```python
@pytest.mark.anyio
async def test_file_upload(client: AsyncClient):
    response = await client.post(
        "/upload",
        files={"file": ("test.txt", b"file content", "text/plain")},
    )
    assert response.status_code == 200
    assert response.json()["filename"] == "test.txt"
```
