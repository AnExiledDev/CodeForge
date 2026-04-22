# Runes and Reactivity — Deep Dive

## 1. Reactivity Model

Svelte 5 reactivity is signal-based. Each `$state` call creates a signal — a getter/setter pair tracked by the compiler. When a signal is read inside `$derived` or `$effect`, the compiler registers a dependency. When the signal changes, dependents re-execute.

Objects and arrays wrapped in `$state` are converted to deeply reactive proxies. Property access on the proxy registers fine-grained dependencies — reading `obj.name` tracks only `name`, not the entire object.

### Proxy Tracking Semantics

```js
let user = $state({ name: 'Alice', age: 30 });

// Reading user.name inside $derived tracks only the name property.
let greeting = $derived(`Hello, ${user.name}`);

// Mutating user.age does NOT cause greeting to recalculate.
user.age = 31;

// Mutating user.name DOES cause greeting to recalculate.
user.name = 'Bob';
```

Array mutations (`push`, `splice`, `pop`, etc.) are intercepted by the proxy and trigger reactive updates for any dependent that reads the array's length or iterates over it.

### When Proxies Break

Proxies do not survive structured clone, `JSON.parse(JSON.stringify())`, or transfer to web workers. Use `$state.snapshot()` before any of these operations:

```js
let data = $state({ items: [1, 2, 3] });
const plain = $state.snapshot(data);
postMessage(plain); // safe — plain object, no proxy
```

## 2. $state Deep Dive

### Basic Usage

```js
let count = $state(0);        // primitive
let user = $state({ name: 'Alice' }); // deep proxy
let tags = $state(['svelte', 'runes']); // deep proxy array
```

### $state.raw — Opt Out of Deep Tracking

Use `$state.raw()` for large data structures that are always replaced, never mutated. Only reassignment triggers reactivity.

```js
let rows = $state.raw(initialData);

// Does NOT trigger updates (mutation on raw state):
rows.push(newRow);

// Triggers updates (reassignment):
rows = [...rows, newRow];
```

Appropriate for: API response caches, immutable data from external sources, performance-critical large lists.

### $state.snapshot — Plain Copy

Returns a non-reactive, structurally cloned copy of the reactive value.

```js
let form = $state({ name: '', email: '' });

function submit() {
  const payload = $state.snapshot(form);
  fetch('/api/submit', { method: 'POST', body: JSON.stringify(payload) });
}
```

### Class Fields

`$state` works in class fields, enabling reactive class-based stores:

```js
// lib/stores/counter.svelte.js
export class Counter {
  count = $state(0);
  doubled = $derived(this.count * 2);

  increment() {
    this.count++;
  }

  reset() {
    this.count = 0;
  }
}
```

```svelte
<script>
  import { Counter } from '$lib/stores/counter.svelte.js';
  const counter = new Counter();
</script>
<button onclick={() => counter.increment()}>{counter.count} (doubled: {counter.doubled})</button>
```

Class-based stores are ideal when a piece of state has associated behaviors (methods) and derived values. The class encapsulates the reactive graph.

## 3. $derived Deep Dive

### Sync Guarantee

`$derived` values are always synchronous and consistent. After updating a `$state` value, any `$derived` that depends on it reflects the new value immediately — there is no "stale read" window.

```js
let count = $state(0);
let doubled = $derived(count * 2);

count = 5;
console.log(doubled); // 10 — immediately consistent
```

### Cascading Derivations

Derived values can depend on other derived values. The compiler resolves the dependency graph at compile time:

```js
let price = $state(100);
let taxRate = $state(0.08);
let tax = $derived(price * taxRate);
let total = $derived(price + tax);
```

### $derived.by — Multi-Statement Derivation

When derivation requires intermediate steps, use `$derived.by()` with a function body:

```js
let items = $state([
  { name: 'A', price: 10, qty: 2 },
  { name: 'B', price: 5, qty: 3 }
]);

let orderSummary = $derived.by(() => {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const tax = subtotal * 0.08;
  return { subtotal, tax, total: subtotal + tax };
});
```

Avoid `$effect` for computations that produce values. `$derived.by()` handles complex computations while maintaining the synchronous consistency guarantee.

## 4. $effect Deep Dive

### Execution Timing

Effects run **after** the DOM has been updated. This means the DOM reflects the latest state when the effect body executes.

```js
let count = $state(0);

$effect(() => {
  // DOM is already updated when this runs
  document.title = `Count: ${count}`;
});
```

### Cleanup Functions

Return a function from `$effect` for teardown. Cleanup runs before the next effect execution and when the component is destroyed:

```js
$effect(() => {
  const interval = setInterval(() => tick(), 1000);
  return () => clearInterval(interval);
});
```

### Async Pattern

Effects cannot be `async`. Start async work inside the effect and use an AbortController for cleanup:

```js
$effect(() => {
  const controller = new AbortController();

  async function fetchData() {
    try {
      const res = await fetch(`/api/data?q=${query}`, { signal: controller.signal });
      if (!controller.signal.aborted) {
        results = await res.json();
      }
    } catch (e) {
      if (e.name !== 'AbortError') throw e;
    }
  }

  fetchData();
  return () => controller.abort();
});
```

### $effect.pre — Before DOM Updates

`$effect.pre()` runs before the DOM is updated. Use for measuring DOM state that will change:

```js
$effect.pre(() => {
  // Read scroll position before DOM update
  previousScrollHeight = container.scrollHeight;
});
```

This is rarely needed. Default to `$effect()` unless DOM measurement before an update is required.

### $effect.root — Detached Effect Scope

`$effect.root()` creates an effect scope independent of any component. It returns a cleanup function that must be called manually:

```js
const cleanup = $effect.root(() => {
  $effect(() => {
    console.log('This runs outside any component');
  });
});

// Later, when done:
cleanup();
```

Use for effects in tests, in `.svelte.js` module-level logic, or when manually managing effect lifecycles.

## 5. Tracking Pitfalls

### Destructuring Loses Reactivity

Destructuring a `$state` object captures the current values as plain variables. Those variables are not tracked:

```js
let user = $state({ name: 'Alice', age: 30 });

// BAD: name and age are plain strings/numbers, not reactive
const { name, age } = user;

// GOOD: access properties on the proxy
$effect(() => {
  console.log(user.name); // tracked
});
```

### Closure Reads

A value read inside a closure is tracked only if the closure runs during effect or derived execution:

```js
let count = $state(0);

// Tracked: the function body runs during $derived evaluation
let doubled = $derived(count * 2);

// NOT tracked: setTimeout callback runs outside the reactive context
$effect(() => {
  setTimeout(() => {
    console.log(count); // reads the value, but this read is NOT tracked
  }, 1000);
});
```

### Passing State to Non-Svelte Code

External libraries, Web APIs, and non-`.svelte.js` modules do not understand Svelte proxies. Always pass `$state.snapshot()` or plain values:

```js
let formData = $state({ name: '', email: '' });

// External validation library
import { validate } from 'some-lib';
const errors = validate($state.snapshot(formData));
```

## 6. EventSource and SSE Streams

### Construction and Cleanup in $effect

EventSource connections follow the same `$effect` cleanup pattern as fetch and WebSocket. Construct the EventSource in the effect body and close it in the cleanup function:

```js
let messages = $state('');
let status = $state('connecting');

$effect(() => {
  const es = new EventSource(`/api/stream?topic=${topic}`);

  es.onopen = () => { status = 'connected'; };

  es.onmessage = (event) => {
    messages += event.data;
  };

  es.onerror = () => {
    status = es.readyState === EventSource.CLOSED ? 'closed' : 'reconnecting';
  };

  return () => es.close();
});
```

When `topic` changes, the effect re-runs: the previous EventSource is closed via cleanup, and a new one opens with the updated URL. The `$state` string accumulates tokens across messages, and Svelte updates the DOM after each assignment.

### Named Events

Servers can send named events (`event: delta`). Use `addEventListener` for these — `onmessage` only fires for unnamed events:

```js
$effect(() => {
  const es = new EventSource('/api/completions');

  es.addEventListener('delta', (e) => {
    tokens += e.data;
  });

  es.addEventListener('done', () => {
    es.close();
  });

  return () => es.close();
});
```

### When to Use Raw EventSource

Use `@ai-sdk/svelte` (`useChat`, `useCompletion`) for AI SDK endpoints — the SDK manages the EventSource lifecycle, parsing, and error recovery internally. Use raw EventSource for custom SSE endpoints not backed by the AI SDK, or when fine-grained control over reconnection and event handling is required.
