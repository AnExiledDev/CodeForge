# Component Patterns — Deep Dive

## 1. Props Patterns

### Basic Destructuring with Defaults

```svelte
<script>
  let { title, subtitle = 'Default subtitle', variant = 'primary' } = $props();
</script>
```

Missing required props produce a compile-time warning when using TypeScript.

### Rest Props

Collect remaining props with rest syntax for forwarding to elements:

```svelte
<script>
  let { class: className = '', children, ...rest } = $props();
</script>
<div class="wrapper {className}" {...rest}>
  {@render children?.()}
</div>
```

Note: `class` is a reserved word in JavaScript — rename it during destructuring.

### TypeScript Props

Define an interface for type safety and IDE autocompletion:

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    count?: number;
    variant?: 'primary' | 'secondary' | 'danger';
    children?: Snippet;
    header?: Snippet<[{ title: string }]>;
    onclick?: (e: MouseEvent) => void;
  }

  let { title, count = 0, variant = 'primary', children, header, onclick }: Props = $props();
</script>
```

Type snippets using `Snippet` from `svelte`. Parameterized snippets use `Snippet<[ParamType]>`.

### $bindable Props

Mark a prop as bindable to allow two-way binding from the parent:

```svelte
<!-- Input.svelte -->
<script lang="ts">
  interface Props {
    value: string;
    placeholder?: string;
  }
  let { value = $bindable(''), placeholder = '' }: Props = $props();
</script>
<input bind:value {placeholder} />
```

```svelte
<!-- Parent -->
<script>
  import Input from './Input.svelte';
  let name = $state('');
</script>
<Input bind:value={name} />
<p>Typed: {name}</p>
```

Only mark props as `$bindable` when two-way data flow is the intended API. Prefer callback props for explicit data flow.

## 2. Snippet Patterns

### Basic Children

The `children` snippet is the implicit content placed between component tags:

```svelte
<!-- Card.svelte -->
<script>
  let { children } = $props();
</script>
<div class="card">
  {@render children?.()}
</div>

<!-- Usage -->
<Card>
  <h2>Title</h2>
  <p>Content</p>
</Card>
```

Use optional chaining (`children?.()`) when the children snippet is optional.

### Named Snippets

Named snippets replace named slots:

```svelte
<!-- Layout.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  interface Props {
    header: Snippet;
    footer?: Snippet;
    children: Snippet;
  }
  let { header, footer, children }: Props = $props();
</script>

<header>{@render header()}</header>
<main>{@render children()}</main>
{#if footer}
  <footer>{@render footer()}</footer>
{/if}
```

```svelte
<!-- Usage -->
<Layout>
  {#snippet header()}
    <h1>Page Title</h1>
  {/snippet}

  <p>Main content as children</p>

  {#snippet footer()}
    <small>Footer text</small>
  {/snippet}
</Layout>
```

### Parameterized Snippets

Pass data back to the parent through snippet parameters:

```svelte
<!-- DataTable.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props<T> {
    items: T[];
    row: Snippet<[T, number]>;
    empty?: Snippet;
  }

  let { items, row, empty }: Props<any> = $props();
</script>

{#if items.length === 0}
  {@render empty?.()}
{:else}
  {#each items as item, index}
    {@render row(item, index)}
  {/each}
{/if}
```

```svelte
<!-- Usage -->
<DataTable {items}>
  {#snippet row(item, index)}
    <tr>
      <td>{index + 1}</td>
      <td>{item.name}</td>
    </tr>
  {/snippet}
  {#snippet empty()}
    <p>No items found</p>
  {/snippet}
</DataTable>
```

### Local Snippets for Reuse

Define snippets locally within a component for repeated template blocks:

```svelte
{#snippet badge(text, color)}
  <span class="badge" style:background={color}>{text}</span>
{/snippet}

{@render badge('New', 'green')}
{@render badge('Sale', 'red')}
{@render badge('Featured', 'blue')}
```

## 3. Event Patterns

### DOM Events

Svelte 5 uses standard HTML event attributes — no special directive syntax:

```svelte
<button onclick={handleClick}>Click</button>
<input oninput={(e) => (query = e.currentTarget.value)} />
<form onsubmit|preventDefault={handleSubmit}>
```

Note: Event modifiers use the pipe syntax inline. For complex modifier chains, handle in the callback instead:

```js
function handleSubmit(e) {
  e.preventDefault();
  e.stopPropagation();
  // handle submission
}
```

### Callback Props (Component Events)

Replace `createEventDispatcher` with callback props:

```svelte
<!-- Dialog.svelte -->
<script lang="ts">
  interface Props {
    title: string;
    onclose?: () => void;
    onconfirm?: (result: string) => void;
  }
  let { title, onclose, onconfirm }: Props = $props();
</script>

<dialog open>
  <h2>{title}</h2>
  <button onclick={() => onconfirm?.('yes')}>Confirm</button>
  <button onclick={() => onclose?.()}>Cancel</button>
</dialog>
```

```svelte
<!-- Parent -->
<Dialog
  title="Confirm Action"
  onclose={() => (showDialog = false)}
  onconfirm={(result) => handleResult(result)}
/>
```

### Event Forwarding

Forward DOM events from inner elements to the component's consumer by accepting and spreading handler props:

```svelte
<!-- Button.svelte -->
<script>
  let { children, ...rest } = $props();
</script>
<button {...rest}>
  {@render children?.()}
</button>
```

All `on*` attributes passed to `<Button>` forward to the underlying `<button>` element.

## 4. Composition Patterns

### Wrapper Components

Create components that enhance a base element while preserving its full API:

```svelte
<!-- Tooltip.svelte -->
<script>
  let { text, children, ...rest } = $props();
</script>
<div class="tooltip-wrapper" {...rest}>
  {@render children?.()}
  <div class="tooltip-text">{text}</div>
</div>
```

### Dynamic Components

Svelte 5 renders components directly from variables — `<svelte:component>` is no longer necessary:

```svelte
<script>
  import Home from './Home.svelte';
  import About from './About.svelte';

  const routes = { home: Home, about: About };
  let current = $state('home');
</script>

{@const Page = routes[current]}
<Page />
```

### Generic Components with TypeScript

Use generics for type-safe reusable components:

```svelte
<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';

  interface Props {
    items: T[];
    selected?: T;
    row: Snippet<[T]>;
    onselect?: (item: T) => void;
  }

  let { items, selected, row, onselect }: Props = $props();
</script>

<ul>
  {#each items as item}
    <li
      class:selected={item === selected}
      onclick={() => onselect?.(item)}
    >
      {@render row(item)}
    </li>
  {/each}
</ul>
```

The `generics` attribute on `<script>` declares type parameters available throughout the component.
