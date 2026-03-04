# SPA and Routing — Deep Dive

## 1. SPA Configuration

### Core Setup

Three changes convert a SvelteKit project to a single-page application:

**1. Install adapter-static:**

```bash
npm install -D @sveltejs/adapter-static
```

**2. Configure svelte.config.js:**

```js
import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({
      fallback: '200.html'   // Serves the SPA shell for all unmatched routes
    }),
    prerender: {
      entries: []             // Disable automatic prerendering
    }
  }
};
```

**3. Disable SSR globally:**

```js
// src/routes/+layout.js
export const ssr = false;
```

The `fallback` page name depends on the hosting platform:
- `200.html` — Surge, many static hosts
- `index.html` — GitHub Pages, Netlify (with `_redirects` file)
- `404.html` — GitHub Pages alternative (handles as custom 404)

### Why ssr = false in +layout.js

Setting `ssr = false` at the root layout propagates to all routes. Every page renders exclusively on the client. This means:

- No server-side rendering step
- No `+page.server.js` or `+layout.server.js` files (server load functions are unavailable)
- All data fetching occurs in `+page.js` load functions or in component effects
- `$app/environment` reports `browser` as always `true`

## 2. File-Based Routing

SvelteKit uses the filesystem for routing. Each directory under `src/routes/` maps to a URL path:

```
src/routes/
├── +layout.svelte          → root layout (wraps all pages)
├── +page.svelte            → /
├── about/
│   └── +page.svelte        → /about
├── blog/
│   ├── +page.svelte        → /blog
│   └── [slug]/
│       └── +page.svelte    → /blog/:slug
└── (app)/
    ├── +layout.svelte      → shared layout for grouped routes
    ├── dashboard/
    │   └── +page.svelte    → /dashboard
    └── settings/
        └── +page.svelte    → /settings
```

### Dynamic Parameters

Square brackets define dynamic route segments:

```
[slug]        → single parameter (required)
[...rest]     → catch-all (zero or more segments)
[[optional]]  → optional parameter
```

Access parameters in load functions or via the `$page` store:

```js
// src/routes/blog/[slug]/+page.js
export function load({ params }) {
  return { slug: params.slug };
}
```

### Route Groups

Parenthesized directories like `(app)` create layout groups without affecting the URL. Routes inside `(app)/` share a layout but the URL does not include `(app)`.

Use route groups to:
- Apply different layouts to different sections
- Separate authenticated and public routes
- Share a sidebar or navigation across a subset of pages

## 3. Load Functions in SPA Mode

In SPA mode, only `+page.js` and `+layout.js` load functions are available (no `.server.js` variants).

### Client-Only Load Function

```js
// src/routes/dashboard/+page.js
export async function load({ fetch, params, url }) {
  const res = await fetch('/api/dashboard');
  const data = await res.json();
  return { dashboard: data };
}
```

The `fetch` provided by SvelteKit adds relative URL resolution and cookie forwarding. Prefer it over the global `fetch`.

### Accessing Load Data

Load function return values are available as `data` in the corresponding `+page.svelte`:

```svelte
<!-- src/routes/dashboard/+page.svelte -->
<script>
  let { data } = $props();
</script>
<h1>Dashboard</h1>
<pre>{JSON.stringify(data.dashboard, null, 2)}</pre>
```

### Invalidation and Re-running Loads

Force a load function to re-run using `invalidate` or `invalidateAll`:

```js
import { invalidate, invalidateAll } from '$app/navigation';

// Re-run load functions that depend on a specific URL
invalidate('/api/dashboard');

// Re-run all active load functions
invalidateAll();
```

Load functions re-run when their dependencies change (URL parameters, `fetch` URLs, or `depends` keys).

Register custom dependency keys with `depends`:

```js
export async function load({ fetch, depends }) {
  depends('app:dashboard');
  const res = await fetch('/api/dashboard');
  return { dashboard: await res.json() };
}

// Later: invalidate('app:dashboard');
```

## 4. Prerendering in SPA Mode

Even with `ssr = false`, specific routes can be prerendered as static HTML:

```js
// src/routes/about/+page.js
export const prerender = true;
```

This generates a static `about/index.html` at build time. Useful for:
- Marketing pages that benefit from instant load
- SEO-critical pages (search engines see full HTML)
- Pages with no dynamic data

The rest of the application still uses the SPA fallback for client-side routing.

### Prerender Configuration

Control prerender behavior in `svelte.config.js`:

```js
export default {
  kit: {
    prerender: {
      entries: ['/about', '/pricing'], // Explicitly list pages to prerender
      handleHttpError: 'warn'          // Warn instead of fail on broken links
    }
  }
};
```

## 5. Navigation

### Programmatic Navigation

```js
import { goto } from '$app/navigation';

// Navigate to a route
goto('/dashboard');

// Replace history entry (no back button)
goto('/login', { replaceState: true });

// Keep current scroll position
goto('/page', { noScroll: true });
```

### Navigation Lifecycle

```js
import { beforeNavigate, afterNavigate, onNavigate } from '$app/navigation';

// Runs before leaving current page — can cancel navigation
beforeNavigate(({ cancel, to }) => {
  if (hasUnsavedChanges && !confirm('Leave without saving?')) {
    cancel();
  }
});

// Runs after navigation completes — useful for analytics
afterNavigate(({ from, to }) => {
  trackPageView(to?.url.pathname);
});

// Runs when navigation starts — returns a promise for view transitions
onNavigate((navigation) => {
  // Optionally return a promise to delay navigation
});
```

### Page Store

Access the current URL, params, and route info via the `$page` store:

```svelte
<script>
  import { page } from '$app/stores';
</script>
<nav>
  <a href="/" class:active={$page.url.pathname === '/'}>Home</a>
  <a href="/about" class:active={$page.url.pathname === '/about'}>About</a>
</nav>
```

### Link Options

Control SvelteKit link behavior with `data-sveltekit-*` attributes:

```html
<!-- Preload on hover (default behavior) -->
<a href="/about">About</a>

<!-- Preload immediately when link enters viewport -->
<a href="/about" data-sveltekit-preload-data="eager">About</a>

<!-- Disable SvelteKit handling (full page navigation) -->
<a href="/external" data-sveltekit-reload>External</a>

<!-- Replace history entry -->
<a href="/step2" data-sveltekit-replacestate>Next Step</a>
```
