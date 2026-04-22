# Schema and PRAGMAs -- Deep Dive

## 1. Recommended PRAGMAs

Apply these at connection startup for production workloads. Each PRAGMA has a specific purpose and tradeoff:

| PRAGMA | Value | Rationale |
|--------|-------|-----------|
| `journal_mode` | `WAL` | Concurrent reads during writes, better performance for mixed workloads |
| `foreign_keys` | `ON` | Enforce referential integrity (off by default for backward compatibility) |
| `busy_timeout` | `5000` | Wait 5 seconds for locks instead of failing immediately with SQLITE_BUSY |
| `synchronous` | `NORMAL` | Safe with WAL -- fsync on checkpoint only. `FULL` fsyncs every commit |
| `cache_size` | `-64000` | 64MB page cache in memory. Negative value = kilobytes. Default is ~2MB |
| `temp_store` | `MEMORY` | Temp tables and indexes in RAM instead of disk |
| `mmap_size` | `268435456` | Memory-map up to 256MB of the database file for faster reads |
| `page_size` | `4096` | Match filesystem block size (set before creating the database) |

### Persistence Rules

| PRAGMA | Persists in DB file? | Set per connection? |
|--------|---------------------|-------------------|
| `journal_mode` | Yes (WAL persists) | Set once, all connections inherit |
| `foreign_keys` | No | Must set every connection |
| `busy_timeout` | No | Must set every connection |
| `synchronous` | No | Must set every connection |
| `cache_size` | No | Must set every connection |
| `page_size` | Yes | Set before first table creation |

### Connection Initialization Template

```sql
-- Apply in this order at connection startup
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456;
```

---

## 2. WAL Internals

### How WAL Works

In WAL mode, writes append to a separate WAL file (`database.db-wal`) instead of modifying the main database file. Readers see a consistent snapshot of the database as of the start of their transaction, even while a writer is appending new data.

The WAL file grows until a **checkpoint** transfers committed pages back to the main database file. Checkpointing is automatic by default (after 1000 pages, ~4MB with 4KB page size).

### WAL File Lifecycle

```
database.db       -- main database file (read by readers via mmap)
database.db-wal   -- write-ahead log (appended by writers)
database.db-shm   -- shared memory for WAL index (mmap'd by all connections)
```

The `-shm` file is a shared-memory index that allows readers to find pages in the WAL file efficiently. Both `-wal` and `-shm` files are automatically created and managed.

### Checkpoint Modes

```sql
-- Passive: checkpoint pages not currently locked by readers
PRAGMA wal_checkpoint(PASSIVE);

-- Full: wait for readers to finish, then checkpoint all pages
PRAGMA wal_checkpoint(FULL);

-- Truncate: like FULL, then truncate WAL file to zero bytes
PRAGMA wal_checkpoint(TRUNCATE);
```

Use `PASSIVE` for regular maintenance (non-blocking). Use `TRUNCATE` before backups or when disk space is a concern.

### WAL Limitations

- Only one writer at a time (multiple concurrent readers are fine).
- WAL does not work on network filesystems (NFS, SMB) -- the shared memory file requires POSIX locking.
- The WAL file can grow large under sustained write pressure without checkpointing.

---

## 3. FTS5 Tokenizers

### Built-In Tokenizers

| Tokenizer | Behavior | Best For |
|-----------|----------|----------|
| `unicode61` | Unicode-aware, folds diacritics, lowercases | General text in any language |
| `porter unicode61` | Unicode61 + Porter stemming | English-language search |
| `ascii` | ASCII-only tokenization | ASCII-only data, slightly faster |
| `trigram` | 3-character substrings | Substring matching, autocomplete |

### Configuring Tokenizers

```sql
-- Porter stemming with Unicode folding (default for English)
CREATE VIRTUAL TABLE docs_fts USING fts5(
    title, body,
    tokenize='porter unicode61'
);

-- Trigram for substring search
CREATE VIRTUAL TABLE names_fts USING fts5(
    name,
    tokenize='trigram'
);

-- Case-sensitive trigram
CREATE VIRTUAL TABLE code_fts USING fts5(
    source,
    tokenize='trigram case_sensitive 1'
);
```

### Prefix Indexes

Enable prefix search (autocomplete) by configuring `prefix`:

```sql
CREATE VIRTUAL TABLE search_fts USING fts5(
    title, body,
    tokenize='porter unicode61',
    prefix='2,3'     -- index 2- and 3-character prefixes
);

-- Query with prefix
SELECT * FROM search_fts WHERE search_fts MATCH 'sqli*';
```

Prefix indexes increase FTS index size but make prefix queries instant instead of scanning all tokens.

---

## 4. External Content Tables

An external-content FTS table stores no content of its own -- it reads from a regular table. This avoids data duplication:

```sql
CREATE TABLE posts (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE VIRTUAL TABLE posts_fts USING fts5(
    title, body,
    content='posts',
    content_rowid='id'
);
```

### Keeping External Content in Sync

External-content tables do not update automatically. Use triggers to maintain synchronization:

```sql
-- After INSERT: add to FTS
CREATE TRIGGER posts_fts_insert AFTER INSERT ON posts BEGIN
    INSERT INTO posts_fts(rowid, title, body)
    VALUES (new.id, new.title, new.body);
END;

-- After DELETE: remove from FTS
CREATE TRIGGER posts_fts_delete AFTER DELETE ON posts BEGIN
    INSERT INTO posts_fts(posts_fts, rowid, title, body)
    VALUES ('delete', old.id, old.title, old.body);
END;

-- After UPDATE: remove old, add new
CREATE TRIGGER posts_fts_update AFTER UPDATE ON posts BEGIN
    INSERT INTO posts_fts(posts_fts, rowid, title, body)
    VALUES ('delete', old.id, old.title, old.body);
    INSERT INTO posts_fts(rowid, title, body)
    VALUES (new.id, new.title, new.body);
END;
```

The `INSERT INTO fts_table(fts_table, ...)` syntax with the table name as the first value is FTS5's delete command. This is not a regular insert -- it instructs FTS5 to remove the specified row from the index.

### Rebuilding the FTS Index

If the FTS index becomes out of sync with the content table, rebuild it:

```sql
INSERT INTO posts_fts(posts_fts) VALUES ('rebuild');
```

This scans the entire content table and rebuilds the FTS index from scratch.

---

## 5. FTS5 Query Syntax

### Boolean Operators

```sql
-- AND (implicit or explicit)
SELECT * FROM posts_fts WHERE posts_fts MATCH 'sqlite database';
SELECT * FROM posts_fts WHERE posts_fts MATCH 'sqlite AND database';

-- OR
SELECT * FROM posts_fts WHERE posts_fts MATCH 'sqlite OR postgres';

-- NOT
SELECT * FROM posts_fts WHERE posts_fts MATCH 'sqlite NOT tutorial';

-- Phrase search
SELECT * FROM posts_fts WHERE posts_fts MATCH '"full text search"';

-- Column filter
SELECT * FROM posts_fts WHERE posts_fts MATCH 'title:sqlite';

-- NEAR (within N tokens)
SELECT * FROM posts_fts WHERE posts_fts MATCH 'NEAR(sqlite database, 5)';
```

### Ranking with bm25()

```sql
SELECT *, bm25(posts_fts) AS relevance
FROM posts_fts
WHERE posts_fts MATCH 'search query'
ORDER BY relevance;
```

`bm25()` returns negative values where more negative means more relevant. Pass column weights to prioritize title matches over body matches:

```sql
-- Weight title 10x more than body
SELECT *, bm25(posts_fts, 10.0, 1.0) AS relevance
FROM posts_fts
WHERE posts_fts MATCH 'search query'
ORDER BY relevance;
```

### Highlight and Snippet

```sql
SELECT
    highlight(posts_fts, 0, '<mark>', '</mark>') AS title,
    snippet(posts_fts, 1, '<mark>', '</mark>', '...', 64) AS body_preview
FROM posts_fts
WHERE posts_fts MATCH 'sqlite';
```

`highlight()` wraps all matching terms in the specified markers. `snippet()` extracts a relevant fragment with context, truncated to the specified token count.

---

## 6. Partial and Expression Indexes

### Partial Indexes

Reduce index size by indexing only rows that meet a condition:

```sql
-- Index only active products
CREATE INDEX idx_products_active ON products(name, price)
    WHERE status = 'active';

-- Index only future events
CREATE INDEX idx_events_upcoming ON events(start_date)
    WHERE start_date > date('now');
```

The query planner uses a partial index only when the query's `WHERE` clause implies the index condition. Add the same condition to queries:

```sql
-- Uses idx_products_active
SELECT * FROM products WHERE status = 'active' AND name LIKE 'A%';

-- Does NOT use idx_products_active (missing status condition)
SELECT * FROM products WHERE name LIKE 'A%';
```

### Expression Indexes

```sql
-- Index on lowercase email for case-insensitive lookup
CREATE INDEX idx_users_email_lower ON users(lower(email));

-- Index on JSON field
CREATE INDEX idx_users_theme ON users(json_extract(metadata, '$.theme'));

-- Index on date extracted from timestamp
CREATE INDEX idx_orders_date ON orders(date(created_at));
```

---

## 7. ANALYZE

`ANALYZE` collects statistics about table and index contents, stored in the `sqlite_stat1` table. The query planner uses these statistics to choose optimal execution plans:

```sql
-- Analyze all tables and indexes
ANALYZE;

-- Analyze a specific table
ANALYZE users;

-- Analyze a specific index
ANALYZE idx_users_email;
```

### When to Run ANALYZE

- After bulk data loads that significantly change data distribution.
- After creating indexes on populated tables.
- Periodically in long-running applications as data distribution shifts.

Without `ANALYZE`, the query planner assumes uniform distribution and may choose suboptimal plans for skewed data.

### Inspecting Statistics

```sql
SELECT * FROM sqlite_stat1;
-- tbl: table name, idx: index name, stat: "nrow n1 n2 ..."
-- nrow = rows in table, n1 = avg rows per first index column value
```

Low selectivity values (high n1 relative to nrow) indicate the index is not selective enough for certain queries. Consider a composite index or a different query strategy.
