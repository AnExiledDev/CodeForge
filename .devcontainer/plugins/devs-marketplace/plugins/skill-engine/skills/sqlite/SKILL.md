---
name: sqlite
description: >-
  This skill should be used when the user asks to "set up a SQLite database",
  "use WAL mode in SQLite", "query SQLite with Python", "use better-sqlite3",
  "add full-text search with FTS5", "store JSON in SQLite",
  "use SQLite with Cloudflare D1", "write CTEs or window functions in SQLite",
  or discusses SQLite pragmas, schema design, JSON1 extension, FTS5,
  aiosqlite, or embedded database patterns.
version: 0.1.0
---

# SQLite Development

## Mental Model

SQLite is an **embedded database engine**, not a client-server system. The entire database lives in a single file (or `:memory:`), linked directly into the application process. There is no network protocol, no connection pooling daemon, and no separate service to manage.

This architecture gives SQLite properties that eliminate external infrastructure: ACID transactions without a database server, full-text search without Elasticsearch, JSON querying without a document store, and concurrent reads without connection pool tuning. The tradeoff is a single-writer model -- only one connection can write at a time, though WAL mode allows concurrent reads during writes.

SQLite supports these built-in extensions that replace external services:
- **JSON1** -- query and index JSON columns without a document database
- **FTS5** -- full-text search with ranking without a search engine
- **R-Tree** -- spatial indexing without PostGIS

Assume SQLite 3.35+ (2021) for all new code, which includes `RETURNING`, `INSERT ... ON CONFLICT`, and `STRICT` tables.

---

## Core Configuration

Apply these PRAGMAs at connection startup. They control durability, concurrency, and correctness:

```sql
PRAGMA journal_mode = WAL;          -- concurrent readers, non-blocking writes
PRAGMA foreign_keys = ON;           -- enforce foreign key constraints
PRAGMA busy_timeout = 5000;         -- wait 5s on lock instead of failing immediately
PRAGMA synchronous = NORMAL;        -- safe with WAL, faster than FULL
PRAGMA cache_size = -64000;         -- 64MB page cache (negative = KB)
PRAGMA temp_store = MEMORY;         -- temp tables in RAM
```

**WAL (Write-Ahead Log)** replaces the default rollback journal with an append-only log. Readers see a consistent snapshot while a writer appends to the log. This eliminates read-write contention for most workloads. WAL persists across connections -- set it once per database, not per connection.

`foreign_keys` must be enabled per connection; it does not persist in the database file.

> **Deep dive:** See `references/schema-and-pragmas.md` for all recommended PRAGMAs with rationale, WAL internals, checkpointing, and FTS5 tokenizer configuration.

---

## Schema Design

### Tables and Types

Use `STRICT` tables for new schemas to enforce type checking at the engine level. Without `STRICT`, SQLite uses type affinity -- a column declared `INTEGER` happily stores text:

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,          -- alias for rowid, auto-increment
    email TEXT NOT NULL UNIQUE,
    display_name TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    metadata TEXT                     -- JSON stored as text
) STRICT;
```

`INTEGER PRIMARY KEY` is an alias for SQLite's internal `rowid`, giving maximum performance for lookups by primary key.

### WITHOUT ROWID

For tables where the primary key is not a single integer (composite keys, text keys), `WITHOUT ROWID` stores rows in primary-key order, eliminating the separate rowid lookup:

```sql
CREATE TABLE user_roles (
    user_id INTEGER NOT NULL REFERENCES users(id),
    role TEXT NOT NULL,
    PRIMARY KEY (user_id, role)
) WITHOUT ROWID, STRICT;
```

### CHECK Constraints

```sql
CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    price REAL NOT NULL CHECK (price > 0),
    status TEXT NOT NULL CHECK (status IN ('active', 'archived', 'draft'))
) STRICT;
```

---

## Parameterized Queries

Always use parameter binding. Never interpolate values into SQL strings -- this prevents SQL injection and allows SQLite to cache prepared statements.

**Python:**
```python
cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
cursor.execute("INSERT INTO users (email, name) VALUES (:email, :name)",
               {"email": email, "name": name})
```

**JavaScript (better-sqlite3):**
```javascript
const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
const insert = db.prepare("INSERT INTO users (email, name) VALUES (@email, @name)");
insert.run({ email, name });
```

`?` placeholders bind by position. Named placeholders (`:name` in Python, `@name` or `$name` in better-sqlite3) bind by key from a dict/object. Named placeholders are clearer for queries with many parameters.

---

## JSON Support (JSON1)

SQLite stores JSON as text but provides functions to query, extract, and index JSON values without parsing in application code.

### Extraction and Querying

```sql
-- Extract a scalar value
SELECT json_extract(metadata, '$.theme') FROM users;

-- Arrow operators (SQLite 3.38+)
SELECT metadata->>'$.theme' FROM users;

-- Iterate over a JSON array
SELECT u.email, tag.value
FROM users u, json_each(u.metadata, '$.tags') AS tag;

-- Aggregate into a JSON array
SELECT json_group_array(json_object('id', id, 'email', email))
FROM users;
```

### Indexing JSON Fields

Create a generated column to index a JSON path, enabling indexed lookups on JSON values:

```sql
ALTER TABLE users ADD COLUMN theme TEXT
    GENERATED ALWAYS AS (json_extract(metadata, '$.theme')) STORED;

CREATE INDEX idx_users_theme ON users(theme);
```

Expression indexes provide the same result without a physical column:

```sql
CREATE INDEX idx_users_theme ON users(json_extract(metadata, '$.theme'));
```

---

## Full-Text Search (FTS5)

FTS5 provides full-text indexing with BM25 ranking. Create a virtual table backed by the source data:

```sql
CREATE VIRTUAL TABLE posts_fts USING fts5(
    title, body,
    content='posts',
    content_rowid='id',
    tokenize='porter unicode61'
);
```

### Querying

```sql
-- Basic search with ranking
SELECT p.*, rank
FROM posts_fts
JOIN posts p ON posts_fts.rowid = p.id
WHERE posts_fts MATCH 'sqlite AND full-text'
ORDER BY rank;

-- Highlighted results
SELECT highlight(posts_fts, 0, '<b>', '</b>') AS title,
       snippet(posts_fts, 1, '<b>', '</b>', '...', 32) AS body_snippet
FROM posts_fts WHERE posts_fts MATCH 'search query';
```

### Keeping FTS in Sync

Maintain the FTS index with triggers on the source table:

```sql
CREATE TRIGGER posts_ai AFTER INSERT ON posts BEGIN
    INSERT INTO posts_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
END;
CREATE TRIGGER posts_ad AFTER DELETE ON posts BEGIN
    INSERT INTO posts_fts(posts_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body);
END;
CREATE TRIGGER posts_au AFTER UPDATE ON posts BEGIN
    INSERT INTO posts_fts(posts_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body);
    INSERT INTO posts_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
END;
```

> **Deep dive:** See `references/schema-and-pragmas.md` for FTS5 tokenizer options, external content tables, prefix indexes, and FTS5 configuration.

---

## Python: sqlite3 and aiosqlite

### Synchronous with sqlite3

```python
import sqlite3

def get_connection(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row    # dict-like access
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

with get_connection("app.db") as conn:
    conn.execute("INSERT INTO users (email) VALUES (?)", ("alice@example.com",))
    users = conn.execute("SELECT * FROM users").fetchall()
    for user in users:
        print(user["email"])
```

`sqlite3.Row` enables column-name access (`row["email"]`) while remaining subscriptable by index. The `with` statement auto-commits on success or rolls back on exception.

### Async with aiosqlite

```python
import aiosqlite

async def init_db(db_path: str) -> aiosqlite.Connection:
    db = await aiosqlite.connect(db_path)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db

async def list_users(db: aiosqlite.Connection):
    async with db.execute("SELECT * FROM users") as cursor:
        return await cursor.fetchall()
```

aiosqlite wraps `sqlite3` in a background thread, providing an async interface without blocking the event loop. Each `aiosqlite.Connection` maps to one `sqlite3.Connection` in a dedicated thread.

> **Deep dive:** See `references/python-patterns.md` for connection pooling, custom aggregates, datetime adapters, blob I/O, aiosqlite + FastAPI integration, and migration patterns.

---

## JavaScript: better-sqlite3 and D1

### Node.js with better-sqlite3

```javascript
const Database = require("better-sqlite3");

const db = new Database("app.db");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Prepared statement (cached, reusable)
const getUser = db.prepare("SELECT * FROM users WHERE id = ?");
const user = getUser.get(42);

// Transaction
const insertMany = db.transaction((users) => {
  const insert = db.prepare("INSERT INTO users (email, name) VALUES (@email, @name)");
  for (const u of users) insert.run(u);
});

insertMany([
  { email: "alice@example.com", name: "Alice" },
  { email: "bob@example.com", name: "Bob" },
]);
```

better-sqlite3 is synchronous by design -- it runs in the main thread with no async overhead. This makes it the fastest SQLite binding for Node.js. For CPU-bound queries on large datasets, offload to a worker thread.

### Cloudflare D1

D1 provides SQLite at the edge in Cloudflare Workers. The API is async and batch-oriented:

```javascript
export default {
  async fetch(request, env) {
    const { results } = await env.DB.prepare(
      "SELECT * FROM users WHERE email = ?"
    ).bind(email).all();

    // Batch multiple statements in one round-trip
    const batch = await env.DB.batch([
      env.DB.prepare("INSERT INTO logs (action) VALUES (?)").bind("login"),
      env.DB.prepare("UPDATE users SET last_login = ? WHERE id = ?").bind(now, userId),
    ]);

    return Response.json(results);
  },
};
```

D1 batches execute as a single transaction. Use batching to reduce round-trip latency between the Worker and the database.

> **Deep dive:** See `references/javascript-patterns.md` for better-sqlite3 UDFs, WAL checkpoints, prepared statement caching, D1 migrations, and testing with Miniflare.

---

## Ambiguity Policy

These defaults apply when the user does not specify a preference. State the assumption when making a choice so the user can override:

- **Journal mode:** Default to WAL. Use rollback journal only when WAL is explicitly problematic (network filesystems, single-write-then-close patterns).
- **Python sync vs async:** Default to `sqlite3` for synchronous code, `aiosqlite` for async/FastAPI/ASGI applications.
- **JavaScript runtime:** Default to `better-sqlite3` for Node.js, D1 for Cloudflare Workers. Do not use `better-sqlite3` in Workers or D1 outside Workers.
- **FTS version:** Default to FTS5. Do not use FTS3/FTS4 for new code.
- **Table strictness:** Default to `STRICT` for new tables. Omit `STRICT` only when interfacing with legacy schemas that rely on type affinity.
- **Parameter style:** Default to named placeholders (`:name` / `@name`) for queries with 3+ parameters. Use positional (`?`) for simple single-parameter queries.

---

## Reference Files

| File | Contents |
|------|----------|
| `references/python-patterns.md` | Connection pooling, custom aggregates and collations, backup API, datetime adapters, blob I/O, aiosqlite + FastAPI integration, migration patterns |
| `references/javascript-patterns.md` | better-sqlite3 UDFs, WAL checkpoints, prepared statement caching, D1 batch operations, D1 migrations, testing with Miniflare |
| `references/advanced-queries.md` | CTEs (recursive), window functions (ROW_NUMBER, RANK, LAG/LEAD, running totals), upsert, RETURNING, EXPLAIN QUERY PLAN, covering indexes |
| `references/schema-and-pragmas.md` | All recommended PRAGMAs with rationale, WAL internals, FTS5 tokenizers, external content tables, FTS5 sync triggers, partial/expression indexes, ANALYZE |
