# Svelte Testing -- Deep Dive

## 1. Vitest Configuration for SvelteKit

### Full Setup

```bash
npm install -D vitest jsdom @testing-library/svelte @testing-library/jest-dom @testing-library/user-event
```

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
    include: ['tests/**/*.test.ts', 'tests/**/*.svelte.test.ts'],
  },
})
```

```javascript
// vitest-setup.js
import '@testing-library/jest-dom/vitest'
```

### TypeScript Support

Add to `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["@testing-library/jest-dom"]
  }
}
```

### Runes in Test Files

Svelte 5 runes (`$state`, `$derived`, `$effect`) are only available inside `.svelte` files. To use them directly in tests, name the file with `.svelte.test.ts`:

```
tests/
  counter.svelte.test.ts    # Can use $state, $derived
  api.test.ts               # Standard test file (no runes)
```

---

## 2. @testing-library/svelte Render API

### render() Signature

```javascript
import { render, screen } from '@testing-library/svelte'

// Short form: props directly
const result = render(MyComponent, { name: 'World', count: 0 })

// Long form: with additional options
const result = render(MyComponent, {
  props: { name: 'World', count: 0 },
  context: new Map([['theme', 'dark']]),
  target: document.getElementById('custom-root'),
})
```

### Render Result

```javascript
const {
  container,     // wrapping DOM element
  baseElement,   // base element for queries (document.body)
  component,     // Svelte component instance
  debug,         // pretty-print DOM: debug() or debug(element)
  rerender,      // update props: await rerender({ newProp: 'value' })
  unmount,       // destroy component

  // All query functions bound to baseElement:
  getByRole, getByText, getByLabelText,
  queryByRole, queryByText,
  findByRole, findByText,
  // ... and all other query variants
} = render(MyComponent, { name: 'World' })
```

### Updating Props

```javascript
const { rerender } = render(Counter, { count: 0 })
expect(screen.getByText('0')).toBeInTheDocument()

await rerender({ count: 5 })
expect(screen.getByText('5')).toBeInTheDocument()
```

### Debug Output

```javascript
screen.debug()                              // logs entire document.body
screen.debug(screen.getByRole('button'))    // logs specific element
```

---

## 3. User Event Simulation

### Setup

Always call `.setup()` before using userEvent:

```javascript
import userEvent from '@testing-library/user-event'

const user = userEvent.setup()
```

### Click Events

```javascript
test('handles click', async () => {
  const user = userEvent.setup()
  render(Button, { label: 'Submit' })

  await user.click(screen.getByRole('button', { name: 'Submit' }))
  expect(screen.getByText('Submitted')).toBeInTheDocument()
})
```

### Typing

```javascript
test('handles text input', async () => {
  const user = userEvent.setup()
  render(SearchForm)

  const input = screen.getByRole('textbox')
  await user.type(input, 'hello world')
  expect(input).toHaveValue('hello world')

  await user.clear(input)
  expect(input).toHaveValue('')
})
```

### Special Keys

```javascript
await user.type(input, '{Enter}')
await user.type(input, '{Backspace}')
await user.keyboard('{Shift>}A{/Shift}')  // hold Shift, press A
await user.tab()
await user.tab({ shift: true })
```

### Select and Hover

```javascript
await user.selectOptions(screen.getByRole('combobox'), ['option1'])
await user.hover(screen.getByRole('button'))
await user.unhover(screen.getByRole('button'))
```

### userEvent vs fireEvent

`userEvent` simulates full browser interaction sequences (focus, keydown, keypress, input, keyup). `fireEvent` dispatches a single event. Prefer `userEvent` -- it catches bugs that `fireEvent` misses (e.g., event handlers that depend on focus state).

```javascript
import { fireEvent } from '@testing-library/svelte'

// fireEvent is async in svelte-testing-library
await fireEvent.click(button)
```

---

## 4. Async State Updates

### findBy Queries (Wait for Elements)

```javascript
test('loads data asynchronously', async () => {
  render(AsyncList)

  // findByText polls until the element appears (default timeout: 1000ms)
  const item = await screen.findByText('Loaded Item', {}, { timeout: 3000 })
  expect(item).toBeInTheDocument()
})
```

### waitFor (Wait for Assertions)

```javascript
import { waitFor } from '@testing-library/svelte'

test('counter updates after delay', async () => {
  render(DelayedCounter)

  await waitFor(() => {
    expect(screen.getByText('Updated: 42')).toBeInTheDocument()
  }, { timeout: 2000 })
})
```

### act() -- Flush Pending Updates

```javascript
import { act } from '@testing-library/svelte'

test('programmatic state change', async () => {
  const { component } = render(Counter)

  await act(() => {
    component.increment()
  })

  expect(screen.getByText('1')).toBeInTheDocument()
})
```

### flushSync -- Synchronous Flush (Svelte Native)

```javascript
import { flushSync, mount, unmount } from 'svelte'

test('counter with flushSync', () => {
  const component = mount(Counter, {
    target: document.body,
    props: { initial: 0 },
  })

  document.body.querySelector('button').click()
  flushSync()

  expect(document.body.innerHTML).toContain('1')
  unmount(component)
})
```

### Testing $effect with $effect.root

In `.svelte.test.ts` files:

```javascript
import { flushSync } from 'svelte'

test('derived state tracks changes', () => {
  const cleanup = $effect.root(() => {
    let count = $state(0)
    let doubled = $derived(count * 2)

    flushSync()
    expect(doubled).toBe(0)

    count = 5
    flushSync()
    expect(doubled).toBe(10)
  })
  cleanup()
})
```

---

## 5. Mocking Fetch and SSE

### Simple Fetch Mock with vi.fn()

```javascript
import { vi, beforeEach, afterEach } from 'vitest'

beforeEach(() => {
  globalThis.fetch = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('fetches and displays data', async () => {
  globalThis.fetch.mockResolvedValueOnce(
    new Response(JSON.stringify({ items: ['Apple', 'Banana'] }), {
      headers: { 'Content-Type': 'application/json' },
    })
  )

  render(ItemList)

  expect(await screen.findByText('Apple')).toBeInTheDocument()
  expect(screen.getByText('Banana')).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/api/items', expect.any(Object))
})
```

### MSW (Mock Service Worker) -- Recommended

MSW intercepts requests at the network level, keeping test code decoupled from implementation:

```bash
npm install -D msw
```

```javascript
// tests/mocks/handlers.js
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('/api/items', () => {
    return HttpResponse.json({ items: ['Apple', 'Banana'] })
  }),

  http.post('/api/items', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ id: 1, ...body }, { status: 201 })
  }),
]
```

```javascript
// tests/mocks/server.js
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
```

```javascript
// vitest-setup.js
import '@testing-library/jest-dom/vitest'
import { server } from './tests/mocks/server'
import { beforeAll, afterAll, afterEach } from 'vitest'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

```javascript
test('displays fetched items', async () => {
  render(ItemList)
  expect(await screen.findByText('Apple')).toBeInTheDocument()
})

test('handles server error', async () => {
  server.use(
    http.get('/api/items', () => {
      return new HttpResponse(null, { status: 500 })
    })
  )
  render(ItemList)
  expect(await screen.findByText('Error loading items')).toBeInTheDocument()
})
```

### MSW for SSE Streams

```javascript
import { http, HttpResponse } from 'msw'

const handlers = [
  http.get('/api/stream', () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"token": "Hello"}\n\n'))
        controller.enqueue(encoder.encode('data: {"token": " World"}\n\n'))
        controller.enqueue(encoder.encode('event: done\ndata: \n\n'))
        controller.close()
      },
    })
    return new HttpResponse(stream, {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }),
]
```

### Mocking EventSource Directly

```javascript
class MockEventSource {
  constructor(url) {
    this.url = url
    this.readyState = 0
    MockEventSource.instances.push(this)
    setTimeout(() => {
      this.readyState = 1
      this.onopen?.()
    }, 0)
  }
  close() { this.readyState = 2 }
  emitMessage(data) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }
  static instances = []
}

vi.stubGlobal('EventSource', MockEventSource)

test('receives SSE messages', async () => {
  render(StreamComponent)

  // Wait for connection
  await vi.waitFor(() => expect(MockEventSource.instances).toHaveLength(1))

  const es = MockEventSource.instances[0]
  es.emitMessage({ token: 'Hello' })

  expect(await screen.findByText('Hello')).toBeInTheDocument()
})
```

---

## 6. Mocking SvelteKit Modules

### $app/navigation

```javascript
import { vi } from 'vitest'

vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
  invalidate: vi.fn(),
  invalidateAll: vi.fn(),
  beforeNavigate: vi.fn(),
  afterNavigate: vi.fn(),
  onNavigate: vi.fn(),
}))
```

### $app/environment

```javascript
vi.mock('$app/environment', () => ({
  browser: true,
  dev: true,
  building: false,
  version: 'test',
}))
```

### $app/stores

```javascript
import { readable, writable } from 'svelte/store'

vi.mock('$app/stores', () => ({
  page: readable({
    url: new URL('http://localhost/items'),
    params: { id: '1' },
    route: { id: '/items/[id]' },
    status: 200,
    error: null,
    data: {},
    form: null,
  }),
  navigating: readable(null),
  updated: {
    check: vi.fn(),
    subscribe: readable(false).subscribe,
  },
}))
```

### Assert Navigation

```javascript
import { goto } from '$app/navigation'

test('navigates on button click', async () => {
  const user = userEvent.setup()
  render(NavButton, { href: '/dashboard' })

  await user.click(screen.getByRole('button'))
  expect(goto).toHaveBeenCalledWith('/dashboard')
})
```

---

## 7. Vitest Mocking API Reference

| Function | Purpose |
|----------|---------|
| `vi.fn()` | Create a mock function |
| `vi.fn(() => impl)` | Mock with implementation |
| `vi.mock('./module')` | Auto-mock entire module (hoisted) |
| `vi.mock('./module', () => ({...}))` | Mock with factory (hoisted) |
| `vi.spyOn(obj, 'method')` | Spy on existing method |
| `vi.stubGlobal('name', value)` | Stub a global variable |
| `vi.stubEnv('VAR', 'value')` | Stub an environment variable |
| `vi.useFakeTimers()` | Mock Date/setTimeout/setInterval |
| `vi.setSystemTime(date)` | Set mocked system time |
| `vi.advanceTimersByTime(ms)` | Advance fake timers |
| `vi.restoreAllMocks()` | Restore all mocks/spies |
| `vi.resetAllMocks()` | Reset mock call/result state |
| `vi.clearAllMocks()` | Clear mock call history |
| `vi.waitFor(callback)` | Wait for callback to not throw |

---

## 8. Snapshot Testing

### Component Snapshots

```javascript
test('matches snapshot', () => {
  const { container } = render(Badge, { label: 'New', variant: 'primary' })
  expect(container.innerHTML).toMatchSnapshot()
})
```

### Inline Snapshots

```javascript
test('renders badge HTML', () => {
  const { container } = render(Badge, { label: 'New' })
  expect(container.innerHTML).toMatchInlineSnapshot(`
    "<span class="badge badge-default">New</span>"
  `)
})
```

### When to Snapshot

Snapshots are useful for detecting unintended DOM changes in presentational components. Avoid snapshots for:
- Components with dynamic data (timestamps, random IDs).
- Complex interactive components (assertions on specific behavior are more maintainable).
- Components that change frequently (snapshots become noise).

Prefer explicit assertions (`expect(element).toHaveTextContent(...)`) over snapshots for behavioral tests.
