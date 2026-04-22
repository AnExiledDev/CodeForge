# Routing and Dependencies -- Deep Dive

## 1. APIRouter Organization

Structure routers by domain, one per module. Each router declares its own prefix, tags, and shared dependencies:

```python
# app/routers/users.py
from fastapi import APIRouter, Depends
from app.dependencies import get_current_user

router = APIRouter(
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(get_current_user)],
)

@router.get("/me")
async def read_current_user(user: User = Depends(get_current_user)):
    return user

@router.get("/{user_id}")
async def read_user(user_id: int):
    return await fetch_user(user_id)
```

```python
# app/main.py
from fastapi import FastAPI
from app.routers import users, items, orders

app = FastAPI()
app.include_router(users.router)
app.include_router(items.router)
app.include_router(orders.router)
```

### Router-Level Dependencies

Dependencies declared at the router level apply to every endpoint in that router. This is ideal for authentication guards -- every endpoint in the router requires a valid user without repeating the dependency:

```python
router = APIRouter(
    prefix="/admin",
    dependencies=[Depends(require_admin_role)],
)
```

Override a router-level dependency at the endpoint level by re-declaring the same parameter type with a different `Depends()`:

```python
@router.get("/public", dependencies=[])
async def public_endpoint():
    return {"message": "no auth required"}
```

---

## 2. Path Operation Configuration

### Response Model Filtering

Use `response_model_exclude_unset` to omit fields the client did not send, useful for PATCH-style partial updates:

```python
@router.patch("/{item_id}", response_model=ItemResponse)
async def update_item(
    item_id: int,
    updates: ItemUpdate,
    response_model_exclude_unset=True,
):
    return await apply_updates(item_id, updates)
```

### Multiple Response Models

Declare alternative responses for documentation and client generation:

```python
from fastapi import status

@router.post(
    "/",
    response_model=ItemResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        409: {"model": ErrorResponse, "description": "Item already exists"},
        422: {"model": ValidationErrorResponse},
    },
)
async def create_item(item: ItemCreate):
    ...
```

### Tags and Deprecation

```python
@router.get("/legacy", deprecated=True, tags=["legacy"])
async def legacy_endpoint():
    ...
```

---

## 3. Nested and Overridden Dependencies

### Nested Dependencies

Dependencies can depend on other dependencies. FastAPI resolves the full graph, caching each dependency once per request:

```python
async def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        await db.close()

async def get_user_repo(db: AsyncSession = Depends(get_db)):
    return UserRepository(db)

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    repo: UserRepository = Depends(get_user_repo),
):
    user = await repo.find_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user
```

The dependency graph resolves as: `oauth2_scheme` + `get_db` -> `get_user_repo` -> `get_current_user`. Each node executes once per request regardless of how many endpoints declare it.

### Disabling Cache

Force a dependency to re-execute per injection point by setting `use_cache=False`:

```python
async def get_timestamp():
    return datetime.utcnow()

@router.get("/")
async def handler(
    start: datetime = Depends(get_timestamp),
    end: datetime = Depends(get_timestamp, use_cache=False),
):
    # start and end are different timestamps
    ...
```

---

## 4. WebSocket Endpoints

WebSocket routes use `@app.websocket()` and receive a `WebSocket` object for bidirectional communication:

```python
from fastapi import WebSocket, WebSocketDisconnect

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"Echo: {data}")
    except WebSocketDisconnect:
        pass
```

Dependencies work with WebSocket endpoints. Inject shared resources the same way as HTTP handlers:

```python
@app.websocket("/ws")
async def ws_with_deps(websocket: WebSocket, db: DB):
    await websocket.accept()
    ...
```

### Connection Management

Track active connections for broadcasting:

```python
class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)

    async def broadcast(self, message: str):
        for ws in self.active:
            await ws.send_text(message)

manager = ConnectionManager()
```

---

## 5. Testing Endpoints

Use `httpx.AsyncClient` with FastAPI's built-in test support. Override dependencies to inject test doubles:

```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.dependencies import get_db

async def mock_db():
    yield FakeDatabase()

app.dependency_overrides[get_db] = mock_db

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

@pytest.mark.anyio
async def test_create_item(client: AsyncClient):
    response = await client.post("/items/", json={"name": "Test", "price": 9.99})
    assert response.status_code == 201
    assert response.json()["name"] == "Test"
```

### Testing with Real Dependencies

For integration tests, use the actual dependency graph but point to a test database:

```python
@pytest.fixture(autouse=True)
async def setup_test_db():
    await create_test_tables()
    yield
    await drop_test_tables()
    app.dependency_overrides.clear()
```

### Testing Authentication

Override the auth dependency to bypass token validation in tests:

```python
async def mock_current_user():
    return User(id=1, email="test@example.com", role="admin")

app.dependency_overrides[get_current_user] = mock_current_user
```
