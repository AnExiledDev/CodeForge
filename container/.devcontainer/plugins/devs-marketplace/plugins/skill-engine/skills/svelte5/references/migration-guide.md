# Svelte 4 → Svelte 5 Migration Guide

Ten migration patterns with complete before/after code. Each pattern includes rationale and edge cases to handle during conversion.

---

## 1. Reactive State Declaration

### Svelte 4
```svelte
<script>
  let count = 0;
  let user = { name: 'Alice', age: 30 };
</script>
<button on:click={() => count++}>{count}</button>
```

### Svelte 5
```svelte
<script>
  let count = $state(0);
  let user = $state({ name: 'Alice', age: 30 });
</script>
<button onclick={() => count++}>{count}</button>
```

### Rationale
Svelte 4 relied on compile-time analysis of top-level `let` declarations to infer reactivity. This was implicit and fragile — reassigning inside callbacks, passing to functions, or destructuring could silently break reactivity. `$state` makes the reactive intent explicit.

### Edge Cases
- Variables that are assigned once and never change do not need `$state`. Plain `const` or `let` works for non-reactive values.
- Objects and arrays become deeply reactive proxies. If a variable holds large, frequently replaced data (API responses), consider `$state.raw()` instead.
- Module-level variables in `.js` files are not reactive. Rename the file to `.svelte.js` to enable runes.

---

## 2. Reactive Derivations

### Svelte 4
```svelte
<script>
  let items = [];
  $: remaining = items.filter(i => !i.done).length;
  $: summary = `${remaining} of ${items.length} left`;
</script>
```

### Svelte 5
```svelte
<script>
  let items = $state([]);
  let remaining = $derived(items.filter(i => !i.done).length);
  let summary = $derived(`${remaining} of ${items.length} left`);
</script>
```

### Rationale
`$:` reactive declarations had confusing semantics — they could be statements or expressions, ran in topological order that was hard to predict, and failed silently when dependencies were indirect. `$derived` is always an expression with synchronous consistency.

### Edge Cases
- Multi-statement computations need `$derived.by(() => { ... })`.
- `$derived` cannot have side effects. Move side effects to `$effect`.
- Circular derivations are compile-time errors in Svelte 5 (previously they caused infinite loops silently).

---

## 3. Reactive Side Effects

### Svelte 4
```svelte
<script>
  let query = '';
  $: {
    console.log('Query changed:', query);
    document.title = `Search: ${query}`;
  }
</script>
```

### Svelte 5
```svelte
<script>
  let query = $state('');

  $effect(() => {
    console.log('Query changed:', query);
    document.title = `Search: ${query}`;
  });
</script>
```

### Rationale
`$:` blocks for side effects looked identical to derivations, making intent unclear. `$effect` clearly signals "this code runs for side effects, not to produce a value." It also provides a cleanup function mechanism that `$:` lacked.

### Edge Cases
- `$effect` runs asynchronously after DOM updates. Code that previously ran synchronously in `$:` may behave differently.
- `$effect` tracks dependencies automatically — variables read during execution are tracked. Variables read only inside callbacks (e.g., `setTimeout`) are not tracked.
- Return a cleanup function for teardown: `$effect(() => { ... return () => cleanup(); });`

---

## 4. Component Props

### Svelte 4
```svelte
<script>
  export let title;
  export let variant = 'primary';
  export let items = [];
</script>
```

### Svelte 5
```svelte
<script>
  let { title, variant = 'primary', items = [] } = $props();
</script>
```

### Rationale
`export let` overloaded the `export` keyword — props were not actual exports. `$props()` uses standard JavaScript destructuring, making defaults and rest patterns natural.

### Edge Cases
- `$$props` and `$$restProps` are replaced by rest syntax: `let { known, ...rest } = $props();`
- TypeScript: define an interface and apply it to the destructuring — `let { title }: Props = $props();`
- Props are read-only by default. Attempting to reassign a prop causes a warning. Use `$bindable()` for two-way binding.

---

## 5. DOM Event Handlers

### Svelte 4
```svelte
<button on:click={handleClick}>Click</button>
<button on:click|preventDefault={handleSubmit}>Submit</button>
<input on:input={(e) => query = e.target.value} />
```

### Svelte 5
```svelte
<button onclick={handleClick}>Click</button>
<button onclick={(e) => { e.preventDefault(); handleSubmit(e); }}>Submit</button>
<input oninput={(e) => query = e.currentTarget.value} />
```

### Rationale
Svelte 5 uses standard HTML event attributes, aligning with the DOM API and removing the need for a custom directive syntax. This improves interoperability with tools and editors that understand standard HTML.

### Edge Cases
- Event modifiers (`|preventDefault`, `|stopPropagation`) are removed. Call the methods directly in the handler.
- `e.target` is replaced by `e.currentTarget` for TypeScript correctness (the element the handler is attached to, not the event origin).
- Multiple handlers on the same event: use a single handler that calls multiple functions, or compose with a helper.

---

## 6. Callback Props (Replacing createEventDispatcher)

### Svelte 4
```svelte
<!-- Child.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
</script>
<button on:click={() => dispatch('select', { id: 1 })}>Select</button>

<!-- Parent.svelte -->
<Child on:select={(e) => handleSelect(e.detail)} />
```

### Svelte 5
```svelte
<!-- Child.svelte -->
<script>
  let { onselect } = $props();
</script>
<button onclick={() => onselect?.({ id: 1 })}>Select</button>

<!-- Parent.svelte -->
<Child onselect={(data) => handleSelect(data)} />
```

### Rationale
`createEventDispatcher` used a custom event system with `.detail` unwrapping. Callback props are plain functions — typed, composable, and requiring no special API knowledge.

### Edge Cases
- Convention: prefix with `on` (e.g., `onselect`, `onchange`, `ondelete`). This matches DOM event naming.
- Optional callbacks: use optional chaining (`onselect?.()`) to safely skip when the parent does not provide a handler.
- Data is passed directly as arguments, not wrapped in `event.detail`.

---

## 7. Snippets (Replacing Slots)

### Svelte 4
```svelte
<!-- Card.svelte -->
<div class="card">
  <slot name="header" />
  <slot />
  <slot name="footer" />
</div>

<!-- Parent -->
<Card>
  <h2 slot="header">Title</h2>
  <p>Content</p>
  <small slot="footer">Footer</small>
</Card>
```

### Svelte 5
```svelte
<!-- Card.svelte -->
<script>
  let { header, children, footer } = $props();
</script>
<div class="card">
  {@render header?.()}
  {@render children?.()}
  {@render footer?.()}
</div>

<!-- Parent -->
<Card>
  {#snippet header()}
    <h2>Title</h2>
  {/snippet}

  <p>Content</p>

  {#snippet footer()}
    <small>Footer</small>
  {/snippet}
</Card>
```

### Rationale
Slots had limited type safety and could not receive parameters without the awkward `let:` directive. Snippets are typed, parameterized, and composable — they are first-class values that can be stored, passed, and conditionally rendered.

### Edge Cases
- Default content: use the nullish check pattern — `{@render header?.() ?? fallbackSnippet()}` or `{#if header}{@render header()}{:else}Default{/if}`.
- `<slot let:item>` (slot props) → parameterized snippets: `{#snippet row(item)}...{/snippet}`.
- Snippet type in TypeScript: `import type { Snippet } from 'svelte';`

---

## 8. Bindable Props

### Svelte 4
```svelte
<!-- Input.svelte -->
<script>
  export let value = '';
</script>
<input bind:value />

<!-- Parent -->
<Input bind:value={name} />
```

### Svelte 5
```svelte
<!-- Input.svelte -->
<script>
  let { value = $bindable('') } = $props();
</script>
<input bind:value />

<!-- Parent -->
<Input bind:value={name} />
```

### Rationale
In Svelte 4, all `export let` props were implicitly bindable, creating an unclear API surface. `$bindable()` makes two-way binding an explicit opt-in — consumers know which props support `bind:`.

### Edge Cases
- The default value goes inside `$bindable()`: `$bindable('')`, not `$bindable() ?? ''`.
- Parent still uses `bind:value={variable}` syntax — the binding syntax is unchanged on the consumer side.
- Only mark props as bindable when bidirectional data flow is the intended component API.

---

## 9. Dynamic Components

### Svelte 4
```svelte
<script>
  import Home from './Home.svelte';
  import About from './About.svelte';
  let current = Home;
</script>
<svelte:component this={current} />
```

### Svelte 5
```svelte
<script>
  import Home from './Home.svelte';
  import About from './About.svelte';
  let Current = $state(Home);
</script>
<Current />
```

### Rationale
`<svelte:component>` was a workaround for a compiler limitation. Svelte 5 treats components as values — any variable holding a component constructor can be rendered directly as a tag.

### Edge Cases
- The variable name must start with an uppercase letter to distinguish from HTML elements.
- `<svelte:component>` still works for backwards compatibility but is deprecated.
- Props can be passed normally: `<Current {title} {data} />`.

---

## 10. Imperative Component API (mount / unmount)

### Svelte 4
```js
import App from './App.svelte';

const app = new App({
  target: document.getElementById('app'),
  props: { name: 'World' }
});

app.$destroy();
```

### Svelte 5
```js
import { mount, unmount } from 'svelte';
import App from './App.svelte';

const app = mount(App, {
  target: document.getElementById('app'),
  props: { name: 'World' }
});

unmount(app);
```

### Rationale
The `new Component()` pattern implied class instantiation, but Svelte 5 components are not classes. `mount` and `unmount` are explicit functions that clearly communicate lifecycle intent.

### Edge Cases
- `mount` returns an opaque reference, not a component instance with `$set` or `$on` methods. Those methods are removed.
- For hydration (SSR), use `hydrate` instead of `mount`.
- `mount` accepts an `events` option for attaching listeners, replacing the `$on` method.
- In SPA mode, the entry point in `src/main.js` does not typically need manual `mount` — SvelteKit handles it. Manual mounting is for embedding Svelte components in non-SvelteKit contexts.
