---
name: testing
description: >-
  This skill should be used when the user asks to "write tests for a FastAPI endpoint",
  "test a Svelte component", "set up pytest fixtures for FastAPI",
  "configure Vitest for SvelteKit", "mock dependencies in FastAPI tests",
  "test SSE streaming endpoints", "write component tests with Testing Library",
  "set up database fixtures for API tests", or discusses pytest, httpx AsyncClient,
  Vitest, @testing-library/svelte, dependency overrides, or test fixtures.
version: 0.1.0
---

# Testing (FastAPI + Svelte)

## Mental Model

Testing verifies **behavior at public interfaces**, not implementation details. For a FastAPI backend, the public interface is the HTTP contract -- request in, response out. For a Svelte frontend, the public interface is what the user sees and interacts with -- rendered text, form inputs, button clicks.

Both stacks share core principles: isolate the system under test by replacing external dependencies (databases, APIs, auth) with controlled substitutes; assert on observable outcomes rather than internal state; structure tests as **arrange-act-assert** with clear boundaries between each phase.

The key difference is the isolation mechanism. FastAPI uses `app.dependency_overrides` to swap injected dependencies at the application level -- the real handler code runs with fake resources. Svelte tests use `vi.mock()` or MSW (Mock Service Worker) to intercept network calls at the fetch layer -- the real component code runs with fake responses.

Assume pytest with pytest-anyio for FastAPI, and Vitest with @testing-library/svelte for Svelte 5.

---

## FastAPI: AsyncClient Setup

The modern async testing pattern uses `httpx.AsyncClient` with `ASGITransport`:

```python
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

@pytest.mark.anyio
async def test_read_items(client: AsyncClient):
    response = await client.get("/items/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
```

`AsyncClient` does **not** trigger lifespan events. For applications that depend on startup/shutdown:

```python
from asgi_lifespan import LifespanManager

@pytest.fixture
async def client():
    async with LifespanManager(app) as manager:
        transport = ASGITransport(app=manager.app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac
```

The synchronous `TestClient` (from Starlette) is simpler but cannot be used inside `async def` tests:

```python
from fastapi.testclient import TestClient

def test_read_items():
    with TestClient(app) as client:
        response = client.get("/items/")
        assert response.status_code == 200
```

> **Deep dive:** See `references/fastapi-testing.md` for dependency override patterns, SSE stream testing with httpx-sse, WebSocket testing, background task testing, and database fixture patterns with aiosqlite.

---

## FastAPI: Dependency Overrides

Replace real dependencies with test doubles using `app.dependency_overrides`:

```python
from app.dependencies import get_db, get_current_user

async def mock_db():
    yield FakeDatabase()

async def mock_user():
    return User(id=1, email="test@example.com", role="admin")

@pytest.fixture
async def client():
    app.dependency_overrides[get_db] = mock_db
    app.dependency_overrides[get_current_user] = mock_user
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
```

The override dict maps original dependency callables to replacement callables. Generator dependencies (using `yield`) work as overrides with proper setup/teardown semantics.

### Factory Fixture for Dynamic Overrides

When different tests need different users or roles, use a factory fixture:

```python
@pytest.fixture
def override_user():
    """Return a function that sets the current user override."""
    def _override(user: User):
        app.dependency_overrides[get_current_user] = lambda: user
    return _override

@pytest.mark.anyio
async def test_admin_access(client, override_user):
    override_user(User(id=1, email="admin@test.com", role="admin"))
    response = await client.get("/admin/settings")
    assert response.status_code == 200

@pytest.mark.anyio
async def test_user_forbidden(client, override_user):
    override_user(User(id=2, email="user@test.com", role="user"))
    response = await client.get("/admin/settings")
    assert response.status_code == 403
```

---

## FastAPI: SSE Stream Testing

Test SSE endpoints using `httpx-sse` to parse server-sent events:

```python
from httpx_sse import aconnect_sse

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
```

For raw stream testing without `httpx-sse`, use `ac.stream()` and parse `data:` lines manually. The `httpx-sse` approach is preferred because it handles multi-line data fields, event types, and reconnection IDs correctly.

---

## Svelte: Vitest Configuration

### Installation

```bash
npm install -D vitest jsdom @testing-library/svelte @testing-library/jest-dom @testing-library/user-event
```

### Configuration

```javascript
// vite.config.js
import { defineConfig } from 'vitest/config'
import { sveltekit } from '@sveltejs/kit/vite'
import { svelteTesting } from '@testing-library/svelte/vite'

export default defineConfig({
  plugins: [sveltekit(), svelteTesting()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest-setup.js'],
  },
})
```

```javascript
// vitest-setup.js
import '@testing-library/jest-dom/vitest'
```

The `svelteTesting()` plugin handles automatic cleanup after each test. To use Svelte 5 runes (`$state`, `$derived`) directly in test files, name the file with `.svelte.test.ts` extension.

> **Deep dive:** See `references/svelte-testing.md` for component rendering patterns, user event simulation, async state updates, mocking fetch and SSE, mocking SvelteKit modules, and snapshot testing.

---

## Svelte: Component Testing

Render components with `render()` and query the DOM with accessible queries:

```javascript
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import Counter from './Counter.svelte'

test('increments count on click', async () => {
  const user = userEvent.setup()
  render(Counter, { initial: 0 })

  const button = screen.getByRole('button')
  expect(button).toHaveTextContent('0')

  await user.click(button)
  expect(button).toHaveTextContent('1')
})
```

### Query Priority

Prefer queries that reflect how users find elements:

1. `getByRole` -- accessible role (`button`, `heading`, `textbox`)
2. `getByLabelText` -- form elements by label
3. `getByText` -- visible text content
4. `getByPlaceholderText` -- input placeholders
5. `getByTestId` -- last resort, `data-testid` attribute

### Query Types

| Prefix | 0 matches | 1 match | >1 matches | Async |
|--------|-----------|---------|------------|-------|
| `getBy` | throws | returns | throws | No |
| `queryBy` | `null` | returns | throws | No |
| `findBy` | throws | returns | throws | Yes |

Use `getBy` for elements that must exist, `queryBy` to assert absence, `findBy` to wait for async rendering.

---

## Svelte: Async State and Waiting

Svelte 5 components update asynchronously. Testing Library provides several mechanisms to handle this:

### findBy Queries

`findBy` queries poll until the element appears (default timeout: 1000ms). Use them for components that load data asynchronously:

```javascript
test('loads and displays items', async () => {
  render(ItemList)

  // Waits for the element to appear in the DOM
  const item = await screen.findByText('Loaded Item', {}, { timeout: 3000 })
  expect(item).toBeInTheDocument()
})
```

### waitFor

`waitFor` repeatedly runs an assertion until it passes or times out. Use it when no single element query captures the expected state:

```javascript
import { waitFor } from '@testing-library/svelte'

test('counter reaches target', async () => {
  render(AnimatedCounter, { target: 10 })

  await waitFor(() => {
    expect(screen.getByTestId('count')).toHaveTextContent('10')
  }, { timeout: 2000 })
})
```

### Mocking Fetch with MSW

MSW (Mock Service Worker) intercepts requests at the network level. Configure it in `vitest-setup.js` for global availability:

```javascript
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  http.get('/api/items', () => HttpResponse.json({ items: ['Apple'] })),
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

Override handlers per test for error scenarios:

```javascript
test('handles server error', async () => {
  server.use(http.get('/api/items', () => new HttpResponse(null, { status: 500 })))
  render(ItemList)
  expect(await screen.findByText('Error loading items')).toBeInTheDocument()
})
```

---

## Shared Patterns

### Test Organization

Mirror the source directory structure:

```
src/
  routes/
    items/
      +page.svelte
  lib/
    api.ts
tests/
  routes/
    items/
      page.test.ts
  lib/
    api.test.ts
```

For FastAPI:

```
app/
  routers/
    items.py
  services/
    item_service.py
tests/
  routers/
    test_items.py
  services/
    test_item_service.py
```

### Arrange-Act-Assert

```python
@pytest.mark.anyio
async def test_create_item(client: AsyncClient):
    # Arrange
    payload = {"name": "Widget", "price": 9.99}

    # Act
    response = await client.post("/items/", json=payload)

    # Assert
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Widget"
    assert data["price"] == 9.99
```

```javascript
test('displays item name', async () => {
  // Arrange
  const item = { name: 'Widget', price: 9.99 }

  // Act
  render(ItemCard, { item })

  // Assert
  expect(screen.getByText('Widget')).toBeInTheDocument()
  expect(screen.getByText('$9.99')).toBeInTheDocument()
})
```

### Fixture Composition

Compose small, focused fixtures rather than building monolithic setup functions:

```python
@pytest.fixture
async def db_session(engine):
    async with async_sessionmaker(engine)() as session:
        async with session.begin():
            yield session
            await session.rollback()

@pytest.fixture
async def seeded_db(db_session):
    db_session.add(Item(name="Existing", price=5.00))
    await db_session.flush()
    return db_session

@pytest.fixture
async def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
```

---

## Ambiguity Policy

These defaults apply when the user does not specify a preference. State the assumption when making a choice so the user can override:

- **Test runner:** Default to pytest with pytest-anyio for FastAPI. Default to Vitest for Svelte.
- **Async test style:** Default to `@pytest.mark.anyio` with `AsyncClient`. Use sync `TestClient` only when async is not needed.
- **HTTP mocking (Svelte):** Default to MSW for fetch mocking. Use `vi.fn()` on `globalThis.fetch` for simple cases without many endpoints.
- **Component queries:** Default to `screen.getByRole()`. Use `getByTestId` only when no accessible role or text is available.
- **Database isolation:** Default to per-test transaction rollback. Use per-test database creation only when testing migrations or schema changes.
- **User events:** Default to `userEvent.setup()` over `fireEvent`. `userEvent` simulates realistic browser interaction sequences.

---

## Reference Files

| File | Contents |
|------|----------|
| `references/fastapi-testing.md` | AsyncClient setup details, dependency override patterns, SSE stream testing with httpx-sse, WebSocket testing, background task testing, database fixtures with aiosqlite, pytest configuration |
| `references/svelte-testing.md` | Vitest configuration for SvelteKit, @testing-library/svelte render API, user event simulation, async state updates (act, flushSync, waitFor, findBy), mocking fetch and SSE with MSW, mocking SvelteKit modules ($app/*), snapshot testing |
