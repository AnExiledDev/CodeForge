---
name: svelte5
description: >-
  This skill should be used when the user asks to "build a Svelte component",
  "create a Svelte app", "use Svelte runes", "set up a SvelteKit SPA",
  "migrate from Svelte 4 to Svelte 5", "manage state with runes",
  "add reactivity in Svelte", "use AI SDK with Svelte",
  "add drag and drop to Svelte", "build charts with LayerCake",
  or discusses Svelte 5 component patterns, snippets, $state, $derived,
  $effect, $props, or SvelteKit routing.
version: 0.1.0
---

# Svelte 5 Development

## Mental Model

Svelte 5 replaces the implicit reactivity compiler with explicit **runes** — function-like signals that declare reactive intent at the call site. Every `$state`, `$derived`, and `$effect` call is a contract: the developer states _what_ is reactive; the compiler handles _how_. This shift eliminates the ambiguity of Svelte 4's `$:` labels where the same syntax could mean derivation, side effect, or conditional execution depending on context.

Components communicate through three mechanisms: typed props via `$props()`, callback props replacing `createEventDispatcher`, and snippets replacing slots. Each mechanism is explicit — there is no hidden event bus, no implicit slot projection, and no magic `export let` overloading.

SvelteKit provides file-based routing with optional SSR. SPA mode disables server rendering entirely, producing a static shell that handles all routing on the client.

Assume Svelte 5 syntax for all new code unless the user explicitly references Svelte 4 or legacy patterns. When modifying an existing codebase that uses Svelte 4 patterns, ask whether to migrate or preserve the existing style. Never mix Svelte 4 and Svelte 5 patterns within the same component — a file should use runes throughout or not at all.

---

## Reactivity with Runes

The runes system provides four core primitives: `$state` for mutable values, `$derived` for computed values, `$effect` for side effects, and `$props` for component inputs. A fifth rune, `$inspect`, exists for development-only debugging. Each rune has a specific purpose — choosing the wrong one is the most common source of bugs in Svelte 5 code.

### $state — Mutable Reactive State

Declare reactive variables with `$state`. The compiler wraps objects and arrays in a proxy for deep tracking — property access registers fine-grained dependencies, and mutations trigger targeted updates.

```svelte
<script>
  let count = $state(0);
  let items = $state([{ name: 'Apple', done: false }]);
</script>

<button onclick={() => count++}>{count}</button>
```

Primitive values (numbers, strings, booleans) do not use proxies — they track via the signal wrapper itself. Only reassignment triggers reactivity for primitives.

Use `$state.raw()` when deep reactivity causes performance issues on large, frequently replaced structures. Raw state tracks only reassignment, not property mutation. This is appropriate for API response caches, immutable datasets, and structures that are always replaced wholesale rather than mutated in place.

```js
let rows = $state.raw(fetchLargeDataset());
rows = rows.filter(r => r.active); // reassignment triggers update
```

Use `$state.snapshot()` to produce a plain, non-reactive copy for logging, JSON serialization, `structuredClone`, or passing to external libraries that cannot handle proxies. Without a snapshot, proxy objects may cause unexpected behavior in libraries that iterate or clone objects.

### $derived — Computed Values

Derived values recalculate synchronously whenever their dependencies change. The synchronous guarantee means derived values are never stale — after updating a `$state`, all `$derived` values reflect the new state immediately with no intermediate inconsistent reads.

Prefer `$derived` for any value computable from existing state. Duplicating state that can be derived introduces synchronization bugs and unnecessary complexity.

```svelte
<script>
  let items = $state([{ done: false }, { done: true }]);
  let remaining = $derived(items.filter(i => !i.done).length);
</script>
```

For multi-statement computations that require intermediate variables, use `$derived.by()` with a function body. This maintains the synchronous consistency guarantee while allowing complex logic:

```js
let summary = $derived.by(() => {
  const active = items.filter(i => !i.done);
  return `${active.length} of ${items.length} remaining`;
});
```

Derived values can depend on other derived values. The compiler resolves the dependency graph at compile time, so cascading derivations are both safe and efficient. Never use `$effect` to compute a value and assign it to a variable — that pattern loses the synchronous guarantee and creates unnecessary render cycles.

### $effect — Side Effects

Effects run after the DOM updates whenever their tracked dependencies change. Limit effects to three categories: DOM manipulation, logging/analytics, and synchronization with external systems (APIs, localStorage, WebSockets). If an effect computes a value, it belongs in `$derived` instead.

```svelte
<script>
  let query = $state('');

  $effect(() => {
    const controller = new AbortController();
    fetch(`/api/search?q=${query}`, { signal: controller.signal });
    return () => controller.abort();
  });
</script>
```

Return a cleanup function for teardown logic. The cleanup runs before the next effect execution and when the component is destroyed. Effects cannot be `async` — start async work inside the effect body and use an AbortController or a boolean flag for cancellation.

`$effect` also works well for EventSource (SSE) connections — construct in the body, close in cleanup. See `references/runes-and-reactivity.md` for patterns.

Use `$effect.pre()` for effects that must run before DOM updates. This is rarely needed — scrolling restoration and DOM measurement before layout changes are the primary use cases.

### $inspect — Development-Only Debugging

```js
$inspect(count);                    // logs on change
$inspect(items).with(console.trace); // custom handler
```

`$inspect` is stripped from production builds automatically. Never rely on it for application logic. It exists solely to observe reactive value changes during development without adding `console.log` statements that would need removal.

> **Deep dive:** See `references/runes-and-reactivity.md` for proxy tracking semantics, class field patterns, `$state` in classes, destructuring pitfalls, `$effect.root`, and closure tracking rules.

---

## Component Architecture

Svelte 5 components have three communication channels: props flow data downward, callback props flow events upward, and snippets allow parents to inject template content into children. Understanding when to use each channel prevents over-engineering and keeps component APIs clean.

### Props with $props

Declare component inputs using `$props()`. Standard JavaScript destructuring provides defaults, rest collection, and renaming:

```svelte
<script>
  let { title, variant = 'primary', children, ...rest } = $props();
</script>

<div class={variant} {...rest}>
  {@render children()}
</div>
```

Rest props (`...rest`) collect all unrecognized attributes for forwarding to DOM elements. This is essential for wrapper components that must preserve the full API of their inner element.

Type props with a TypeScript interface for compile-time safety and IDE autocompletion:

```svelte
<script lang="ts">
  interface Props {
    title: string;
    variant?: 'primary' | 'secondary';
    onclick?: (e: MouseEvent) => void;
  }
  let { title, variant = 'primary', onclick }: Props = $props();
</script>
```

Mark props as bindable with `$bindable()` when the component API intentionally supports two-way data flow. Only use `$bindable` for form-like components where the parent needs to both read and write a value (inputs, selectors, toggles). Prefer callback props for all other parent-child communication.

```svelte
<script>
  let { value = $bindable('') } = $props();
</script>
```

### Snippets (Replacing Slots)

Snippets replace Svelte 4 slots with explicit, typed template blocks. Unlike slots, snippets are first-class values — they can be stored in variables, passed through multiple layers, and conditionally rendered with standard `{#if}` logic.

**Basic children snippet** — content between component tags becomes the `children` prop:
```svelte
<!-- Card.svelte -->
<script>
  let { children } = $props();
</script>
<div class="card">
  {@render children()}
</div>
```

**Parameterized snippets** replace slot props (`let:item`). The parent defines how to render each item; the child controls the iteration and layout:
```svelte
<!-- Parent -->
<List {items}>
  {#snippet row(item)}
    <span>{item.name}</span>
  {/snippet}
</List>

<!-- List.svelte -->
<script>
  let { items, row } = $props();
</script>
{#each items as item}
  {@render row(item)}
{/each}
```

Use optional chaining (`{@render footer?.()}`) when a snippet is not required. For default content when a snippet is absent, use an `{#if}` block with a fallback.

### Event Handling

Svelte 5 uses standard DOM event attributes — no directive syntax. Component-to-parent communication uses callback props following the `on` prefix convention:

```svelte
<!-- DOM events -->
<button onclick={(e) => handleClick(e)}>Click</button>

<!-- Component callback props -->
<script>
  let { onsubmit } = $props();
</script>
<form onsubmit={(e) => { e.preventDefault(); onsubmit(formData); }}>
```

Convention: prefix callback props with `on` (e.g., `onchange`, `onselect`, `ondelete`). This aligns with DOM event naming and makes the component API predictable. Always use optional chaining when calling callbacks (`onselect?.()`) to handle cases where the parent omits the handler.

### Lifecycle

`$effect()` replaces `onMount` for most reactive use cases. For non-reactive cleanup (removing global listeners, clearing non-tracked intervals), import `onDestroy` from `svelte`. Import `tick` from `svelte` to await pending DOM updates before reading layout measurements. For imperative component creation outside SvelteKit, import `mount` and `unmount` from `svelte`.

> **Deep dive:** See `references/component-patterns.md` for wrapper components, generic typed components, named snippet composition, event forwarding via rest props, and dynamic component rendering.

---

## State Management

State scope should match the smallest boundary that satisfies the requirement. Over-sharing state (making everything global) creates coupling; under-sharing (passing through many prop layers) creates prop drilling. Apply the decision table below to choose the right pattern for each piece of state.

### Decision Table

| Scope | Pattern | When to Use |
|-------|---------|-------------|
| Single component | `$state` in `<script>` | Local UI state — toggles, form fields, loading flags |
| Parent → children | Props + callback props | Data flows down one or two levels |
| Subtree (no prop drilling) | `setContext` / `getContext` | Theme, locale, authenticated user, feature flags within a section |
| Cross-component / global | `.svelte.js` module | Shopping cart, notifications, app-wide settings |

### Shared State with .svelte.js Modules

Export reactive state from `.svelte.js` files. The Svelte compiler processes runes in these files, enabling `$state` and `$derived` at the module level. Regular `.js` files do not support runes.

```js
// lib/stores/cart.svelte.js
let items = $state([]);
let total = $derived(items.reduce((sum, i) => sum + i.price * i.qty, 0));

export function addItem(product) {
  items.push({ ...product, qty: 1 });
}

export function getCart() {
  return { get items() { return items; }, get total() { return total; } };
}
```

```svelte
<script>
  import { getCart, addItem } from '$lib/stores/cart.svelte.js';
  const cart = getCart();
</script>
<p>Total: {cart.total}</p>
```

Expose state through getter functions or objects with getter properties. Direct export of `$state` variables loses reactivity because the importing module receives the current value, not the reactive signal. This is the most common mistake when building shared state in Svelte 5 — always wrap in a getter.

### Context API

Context scopes state to a component subtree without prop drilling. Context values set with `setContext` during component initialization are available to all descendants via `getContext`. Context is ideal for dependency injection patterns — a layout component provides a theme, and any descendant reads it without explicit prop passing.

```js
// Parent
import { setContext } from 'svelte';
let theme = $state('light');
setContext('theme', () => theme);

// Descendant
import { getContext } from 'svelte';
const getTheme = getContext('theme');
// Access: getTheme()
```

Pass a getter function (not the raw value) to preserve reactivity through context. Passing the value directly captures a snapshot at initialization time and never updates.

> **Deep dive:** See `references/runes-and-reactivity.md` for class-based reactive stores and `$effect.root` for advanced teardown patterns.

---

## SvelteKit SPA Configuration

Three changes convert a SvelteKit project to a client-only single-page application: install `adapter-static`, configure a fallback page, and disable SSR at the root layout. This produces a static shell that handles all routing on the client.

```js
// svelte.config.js
import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({ fallback: '200.html' }),
    prerender: { entries: [] }
  }
};
```

```js
// src/routes/+layout.js
export const ssr = false;
```

The fallback page name depends on the hosting platform — `200.html` for Surge and most static hosts, `index.html` for Netlify with a `_redirects` file, or `404.html` for GitHub Pages. The fallback serves the SPA shell for all routes not matched by a prerendered static file.

Set `prerender.entries` to an empty array to disable automatic prerendering. For selective prerendering, export `prerender = true` from individual `+page.js` files — useful for marketing pages or SEO-critical content that benefits from static HTML.

In SPA mode, only `+page.js` and `+layout.js` load functions work. Server-side load functions (`.server.js`) are unavailable. All data fetching occurs in client-side load functions or in component `$effect` blocks.

> **Deep dive:** See `references/spa-and-routing.md` for file-based routing patterns, dynamic parameters, route groups, client-only load functions, invalidation, navigation helpers, and prerender configuration.

---

## Correct Svelte 5 Patterns

Quick-reference table for the ten most common pattern migrations. Each row shows the legacy approach and the modern replacement:

| Svelte 4 (Legacy) | Svelte 5 (Runes) |
|-|-|
| `let count = 0;` (implicit reactivity) | `let count = $state(0);` |
| `$: doubled = count * 2;` | `let doubled = $derived(count * 2);` |
| `$: { console.log(count); }` | `$effect(() => { console.log(count); });` |
| `export let title;` | `let { title } = $props();` |
| `<slot />` | `{@render children()}` |
| `<slot name="header" />` | `{#snippet header()}...{/snippet}` + `{@render header()}` |
| `createEventDispatcher()` | Callback props: `let { onclick } = $props();` |
| `on:click={handler}` | `onclick={handler}` |
| `<svelte:component this={Comp} />` | `<Comp />` (direct dynamic reference) |
| `bind:value` (implicit) | `let { value = $bindable() } = $props();` |

When encountering Svelte 4 patterns in an existing codebase, do not silently convert them. Ask whether the component should be migrated or whether the existing style should be preserved for consistency with the rest of the project.

> **Complete migration guide:** See `references/migration-guide.md` for full before/after code blocks with rationale and edge cases for each of the ten patterns.

---

## Ambiguity Policy

These defaults apply when the user does not specify a preference. State them when making an assumption so the user can override:

- **New components:** Default to Svelte 5 runes syntax. Do not use legacy reactive declarations (`$:`) or `export let`. State the assumption if the project context is unclear.
- **Existing codebase edits:** If the file contains Svelte 4 patterns (`$:`, `export let`, `<slot>`), ask whether to migrate the component or match the existing style before making changes.
- **State scope:** Default to component-local `$state`. Escalate to `.svelte.js` modules only when the user specifies cross-component sharing or the requirement clearly involves multiple unrelated components accessing the same data.
- **SPA vs SSR:** Default to SPA configuration (`ssr = false`) unless the user mentions server rendering, prerendering multiple routes, SEO requirements, or content that must be indexed by search engines.
- **TypeScript:** Default to TypeScript (`lang="ts"`) unless the project uses plain JavaScript files throughout. Check existing `.svelte` files for `lang` attributes before deciding.
- **Styling:** Default to component-scoped `<style>` blocks. Suggest Tailwind only if the project already includes a Tailwind configuration.

---

## Reference Files

| File | Contents |
|------|----------|
| `references/runes-and-reactivity.md` | Proxy tracking semantics, $state deep/raw/snapshot, $derived.by cascading, $effect timing/cleanup/async, class field patterns, destructuring pitfalls, $effect.root |
| `references/component-patterns.md` | Props patterns with TypeScript, snippet composition (basic/named/parameterized), event handling and forwarding, wrapper components, generic typed components, dynamic rendering |
| `references/spa-and-routing.md` | Full SPA config, file-based routing with dynamic params, route groups, client-only load functions, invalidation, prerendering in SPA mode, navigation helpers and lifecycle hooks |
| `references/migration-guide.md` | 10 migration patterns with complete Svelte 4 → Svelte 5 before/after code, rationale for each change, and edge cases to handle during conversion |
| `references/ai-sdk-svelte.md` | @ai-sdk/svelte class-based API (Chat, Completion, StructuredObject), createAIContext for shared state, getter syntax for reactive options, destructuring pitfalls |
| `references/svelte-dnd-action.md` | svelte-dnd-action drag-and-drop with use:dndzone, consider/finalize events, drag handles, Svelte 5 event syntax, shadow item filtering, version requirements |
| `references/layercake.md` | LayerCake headless chart framework, scale-based coordinate system, layout components (Svg/Html/Canvas/WebGl), runes incompatibility and workarounds, multi-layer composition |
