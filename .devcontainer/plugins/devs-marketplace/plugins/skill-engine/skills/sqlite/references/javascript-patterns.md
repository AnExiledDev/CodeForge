# JavaScript SQLite Patterns -- Deep Dive

## 1. better-sqlite3 User-Defined Functions

### Scalar Functions

```javascript
const Database = require("better-sqlite3");
const db = new Database("app.db");

db.function("reverse", (str) => str.split("").reverse().join(""));
// SELECT reverse(name) FROM users;

db.function("json_arr_len", (json) => {
  if (json === null) return 0;
  return JSON.parse(json).length;
});
// SELECT json_arr_len(tags) FROM posts;
```

### Aggregate Functions

```javascript
db.aggregate("median", {
  start: () => [],
  step: (arr, value) => {
    if (value !== null) arr.push(value);
    return arr;
  },
  result: (arr) => {
    if (arr.length === 0) return null;
    arr.sort((a, b) => a - b);
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 === 0
      ? (arr[mid - 1] + arr[mid]) / 2
      : arr[mid];
  },
});
// SELECT median(price) FROM products;
```

### Table-Valued Functions

```javascript
db.table("generate_series", {
  columns: ["value"],
  parameters: ["start", "stop", "step"],
  *rows(start, stop, step = 1) {
    for (let i = start; i <= stop; i += step) {
      yield { value: i };
    }
  },
});
// SELECT value FROM generate_series(1, 10, 2);
```

---

## 2. WAL Checkpoints

WAL files grow until checkpointed. better-sqlite3 enables automatic checkpointing by default, but manual control is available:

```javascript
// Check WAL size
const walInfo = db.pragma("wal_checkpoint(PASSIVE)");
// Returns: { busy: 0, checkpointed: N, log: N }

// Force a full checkpoint (waits for readers)
db.pragma("wal_checkpoint(TRUNCATE)");
```

### Checkpoint Strategies

| Mode | Behavior | Use Case |
|------|----------|----------|
| `PASSIVE` | Checkpoint pages not locked by readers | Background maintenance |
| `FULL` | Wait for readers, then checkpoint all pages | Before backup |
| `TRUNCATE` | Like FULL, then truncate WAL to zero | Reduce disk usage |
| `RESTART` | Like FULL, then reset WAL to beginning | Reclaim WAL file space |

Schedule periodic `PASSIVE` checkpoints in long-running applications. Use `TRUNCATE` before backup or deployment.

---

## 3. Prepared Statement Patterns

### Caching Prepared Statements

better-sqlite3 `prepare()` compiles the SQL once. Store references for reuse:

```javascript
class UserRepository {
  constructor(db) {
    this.db = db;
    this.stmts = {
      getById: db.prepare("SELECT * FROM users WHERE id = ?"),
      getByEmail: db.prepare("SELECT * FROM users WHERE email = ?"),
      insert: db.prepare(
        "INSERT INTO users (email, name) VALUES (@email, @name) RETURNING *"
      ),
      update: db.prepare(
        "UPDATE users SET name = @name WHERE id = @id RETURNING *"
      ),
      delete: db.prepare("DELETE FROM users WHERE id = ?"),
    };
  }

  getById(id) {
    return this.stmts.getById.get(id);
  }

  getByEmail(email) {
    return this.stmts.getByEmail.get(email);
  }

  create(data) {
    return this.stmts.insert.get(data);
  }

  update(id, data) {
    return this.stmts.update.get({ ...data, id });
  }

  delete(id) {
    return this.stmts.delete.run(id);
  }
}
```

### Iterate vs All

Use `.iterate()` for large result sets to avoid loading everything into memory:

```javascript
const stmt = db.prepare("SELECT * FROM logs WHERE date > ?");

// All at once (small result sets)
const rows = stmt.all("2024-01-01");

// Iterator (large result sets)
for (const row of stmt.iterate("2024-01-01")) {
  processRow(row);
}
```

---

## 4. Transaction Patterns

### Basic Transactions

```javascript
const transferFunds = db.transaction((fromId, toId, amount) => {
  const from = db.prepare("SELECT balance FROM accounts WHERE id = ?").get(fromId);
  if (from.balance < amount) {
    throw new Error("Insufficient funds");
  }
  db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").run(amount, fromId);
  db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(amount, toId);
});

transferFunds(1, 2, 100);
```

The `db.transaction()` wrapper automatically commits on success and rolls back on error. Nested `db.transaction()` calls use savepoints.

### Deferred vs Immediate

```javascript
const immediateTransaction = db.transaction(() => {
  // Acquires write lock immediately
  db.prepare("INSERT INTO logs (msg) VALUES (?)").run("action");
});

// Force IMMEDIATE mode for write transactions
immediateTransaction.immediate();
```

Use `.immediate()` when the transaction will write, to avoid SQLITE_BUSY errors from lock promotion.

---

## 5. Cloudflare D1 Patterns

### Batch Operations

D1 batches execute all statements in a single round-trip as an implicit transaction:

```javascript
export default {
  async fetch(request, env) {
    const results = await env.DB.batch([
      env.DB.prepare("INSERT INTO users (email) VALUES (?)").bind("alice@example.com"),
      env.DB.prepare("INSERT INTO profiles (user_id, bio) VALUES (last_insert_rowid(), ?)").bind("Hello"),
      env.DB.prepare("SELECT * FROM users WHERE email = ?").bind("alice@example.com"),
    ]);

    const user = results[2].results[0];
    return Response.json(user);
  },
};
```

### D1 Query Helpers

```javascript
// .first() -- single row or null
const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
  .bind(id)
  .first();

// .all() -- all rows with metadata
const { results, meta } = await env.DB.prepare("SELECT * FROM users").all();
// meta: { duration, rows_read, rows_written, changes }

// .raw() -- array of arrays (no column names)
const rows = await env.DB.prepare("SELECT id, email FROM users").raw();
// [[1, "alice@example.com"], [2, "bob@example.com"]]

// .run() -- for INSERT/UPDATE/DELETE
const { meta } = await env.DB.prepare("DELETE FROM sessions WHERE expired < ?")
  .bind(Date.now())
  .run();
```

---

## 6. D1 Migrations

### File-Based Migrations

D1 uses numbered SQL files in a `migrations/` directory:

```
migrations/
├── 0001_create_users.sql
├── 0002_add_posts.sql
└── 0003_add_fts.sql
```

```sql
-- 0001_create_users.sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
```

Apply migrations with Wrangler:

```bash
npx wrangler d1 migrations apply my-database        # production
npx wrangler d1 migrations apply my-database --local # local dev
```

### Migration Best Practices

- Each migration file should be idempotent where possible (use `IF NOT EXISTS`).
- Never modify an already-applied migration -- create a new one.
- Test migrations locally before applying to production.
- D1 tracks applied migrations automatically; manual version tables are unnecessary.

---

## 7. Testing with Miniflare

Miniflare provides a local D1 simulator for testing Workers without deploying:

```javascript
import { Miniflare } from "miniflare";

const mf = new Miniflare({
  modules: true,
  script: `export default { async fetch(request, env) { return new Response("ok"); } }`,
  d1Databases: ["DB"],
});

const db = await mf.getD1Database("DB");

// Run migrations
await db.exec(`
  CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL);
`);

// Test queries
await db.prepare("INSERT INTO users (email) VALUES (?)").bind("test@example.com").run();
const user = await db.prepare("SELECT * FROM users WHERE email = ?")
  .bind("test@example.com")
  .first();
console.assert(user.email === "test@example.com");

await mf.dispose();
```

### Integration Test Pattern

```javascript
import { describe, it, beforeEach, afterAll } from "vitest";
import { Miniflare } from "miniflare";

describe("User API", () => {
  let mf;
  let db;

  beforeEach(async () => {
    mf = new Miniflare({ /* config */ });
    db = await mf.getD1Database("DB");
    await db.exec(SCHEMA_SQL);
  });

  afterAll(async () => {
    await mf?.dispose();
  });

  it("creates a user", async () => {
    await db.prepare("INSERT INTO users (email) VALUES (?)").bind("a@b.com").run();
    const user = await db.prepare("SELECT * FROM users").first();
    expect(user.email).toBe("a@b.com");
  });
});
```
