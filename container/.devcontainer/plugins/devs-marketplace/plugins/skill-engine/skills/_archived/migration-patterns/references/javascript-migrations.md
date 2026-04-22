# JavaScript / TypeScript Migration Patterns

## Express → Fastify

### Route Mapping

| Express | Fastify | Notes |
|---------|---------|-------|
| `app.get('/path', handler)` | `fastify.get('/path', handler)` | Similar signature |
| `app.post('/path', handler)` | `fastify.post('/path', handler)` | Similar signature |
| `app.use(middleware)` | `fastify.register(plugin)` | Middleware → plugin model |
| `app.use('/prefix', router)` | `fastify.register(plugin, { prefix: '/prefix' })` | Router → registered plugin |

### Request / Response API

| Express | Fastify | Notes |
|---------|---------|-------|
| `req.body` | `request.body` | Same concept, different naming convention |
| `req.params.id` | `request.params.id` | Same |
| `req.query.page` | `request.query.page` | Same |
| `req.headers` | `request.headers` | Same |
| `res.status(200).json(data)` | `reply.code(200).send(data)` | `status` → `code`, `json` → `send` |
| `res.send('text')` | `reply.send('text')` | Same |
| `res.redirect('/url')` | `reply.redirect('/url')` | Same |
| `res.set('header', 'value')` | `reply.header('header', 'value')` | `set` → `header` |

### Middleware → Plugin Conversion

```javascript
// Express middleware
app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// Fastify equivalent (using hooks)
fastify.addHook('onRequest', async (request, reply) => {
  request.startTime = Date.now();
});
```

### Error Handling

```javascript
// Express error handler
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message });
});

// Fastify error handler
fastify.setErrorHandler((error, request, reply) => {
  reply.code(error.statusCode || 500).send({ error: error.message });
});
```

### Migration Steps

1. Install Fastify: `npm install fastify`
2. Create Fastify app instance to replace Express app
3. Convert middleware to Fastify plugins/hooks
4. Convert route handlers (update request/response API calls)
5. Convert error handling
6. Update tests to use `fastify.inject()` instead of `supertest`
7. Remove Express: `npm uninstall express`

---

## React Version Upgrades

### React 17 → 18

| Change | Action |
|--------|--------|
| `ReactDOM.render()` | Replace with `createRoot().render()` |
| `ReactDOM.hydrate()` | Replace with `hydrateRoot()` |
| Automatic batching | No code change — now batches all state updates by default |
| `useId()` hook | New — use for accessible server/client IDs |
| Strict Mode double-rendering | Now also double-invokes effects in dev mode |

```javascript
// React 17
import ReactDOM from 'react-dom';
ReactDOM.render(<App />, document.getElementById('root'));

// React 18
import { createRoot } from 'react-dom/client';
const root = createRoot(document.getElementById('root'));
root.render(<App />);
```

### React 18 → 19

| Change | Action |
|--------|--------|
| `forwardRef` | No longer needed — `ref` is a regular prop |
| `React.lazy` | Now supports server components |
| Context | `<Context>` replaces `<Context.Provider>` |
| `use()` hook | New — reads resources (promises, context) during render |
| `ref` callbacks | Now support cleanup functions (return from callback) |
| Metadata tags | `<title>`, `<meta>`, `<link>` in components hoist to `<head>` |

---

## TypeScript Version Upgrades

### Key Changes by Version

| Version | Notable Changes |
|---------|----------------|
| 4.7 → 4.8 | Stricter type narrowing in `in` operator |
| 4.8 → 4.9 | `satisfies` operator |
| 4.9 → 5.0 | Decorators (TC39 standard), `bundler` module resolution |
| 5.0 → 5.1 | Easier implicit returns for `undefined`, linked cursors |
| 5.1 → 5.2 | `using` declarations (explicit resource management) |
| 5.2 → 5.3 | Import attributes, narrowing in `switch(true)` |
| 5.3 → 5.4 | `NoInfer<T>` utility type, improved narrowing in closures |
| 5.4 → 5.5 | Inferred type predicates, regex syntax checking |

### tsconfig Changes

| Old Option | New Option | Version |
|-----------|-----------|---------|
| `moduleResolution: "node"` | `moduleResolution: "bundler"` | 5.0+ (for bundled apps) |
| `target: "es2020"` | `target: "es2022"` | 5.0+ (enables native decorators) |
| `importsNotUsedAsValues` | `verbatimModuleSyntax` | 5.0 (consolidates 3 flags into 1) |

---

## CommonJS → ESM Migration

### Step-by-Step

1. **Update `package.json`**: Add `"type": "module"`
2. **Rename if needed**: `.js` files become ESM by default; use `.cjs` for files that must stay CommonJS
3. **Convert imports**:

| CommonJS | ESM |
|----------|-----|
| `const x = require('pkg')` | `import x from 'pkg'` |
| `const { a, b } = require('pkg')` | `import { a, b } from 'pkg'` |
| `module.exports = x` | `export default x` |
| `module.exports = { a, b }` | `export { a, b }` |
| `exports.a = x` | `export const a = x` |

4. **Fix path imports**: ESM requires file extensions in relative imports: `import x from './utils.js'` (not `'./utils'`)
5. **Replace `__dirname` / `__filename`**:

```javascript
// CommonJS
const dir = __dirname;
const file = __filename;

// ESM
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

6. **Replace `require.resolve`**:

```javascript
// CommonJS
const resolved = require.resolve('pkg');

// ESM
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const resolved = require.resolve('pkg');
```

7. **Update tooling configs**: Jest, ESLint, and other tools may need config changes for ESM support.

### Common Gotchas

- JSON imports require import assertions: `import data from './data.json' with { type: 'json' }`
- Dynamic imports (`import()`) return a module namespace object with a `.default` property
- Top-level `await` is available in ESM (not in CommonJS)
- Some packages only export CommonJS — use `import pkg from 'pkg'` (default import) or dynamic `import()`
