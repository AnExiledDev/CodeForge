# Python SQLite Patterns -- Deep Dive

## 1. Connection Management for Multi-Threaded Apps

SQLite connections are not thread-safe by default. For multi-threaded applications, create one connection per thread or use a connection pool:

```python
import sqlite3
import threading
from contextlib import contextmanager

class ConnectionPool:
    def __init__(self, db_path: str, max_connections: int = 5):
        self.db_path = db_path
        self.semaphore = threading.Semaphore(max_connections)
        self.local = threading.local()

    @contextmanager
    def get_connection(self):
        self.semaphore.acquire()
        try:
            if not hasattr(self.local, "conn"):
                self.local.conn = self._create_connection()
            yield self.local.conn
        finally:
            self.semaphore.release()

    def _create_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA busy_timeout=5000")
        return conn
```

Thread-local storage ensures each thread reuses its own connection. The semaphore limits total concurrent connections, preventing resource exhaustion.

For `check_same_thread=False` (sharing a connection across threads), external locking is required:

```python
conn = sqlite3.connect("app.db", check_same_thread=False)
lock = threading.Lock()

def execute_safely(sql, params=()):
    with lock:
        return conn.execute(sql, params).fetchall()
```

This pattern is simpler but serializes all database access. Prefer per-thread connections for concurrent workloads.

---

## 2. Custom Aggregates and Collations

### Custom Aggregate Functions

Register Python functions as SQL aggregate functions:

```python
class MedianAggregate:
    def __init__(self):
        self.values = []

    def step(self, value):
        if value is not None:
            self.values.append(value)

    def finalize(self):
        if not self.values:
            return None
        self.values.sort()
        n = len(self.values)
        mid = n // 2
        if n % 2 == 0:
            return (self.values[mid - 1] + self.values[mid]) / 2
        return self.values[mid]

conn.create_aggregate("median", 1, MedianAggregate)
# SELECT median(price) FROM products;
```

### Custom Collations

Define custom sorting logic for text comparisons:

```python
import unicodedata

def collate_normalized(a: str, b: str) -> int:
    na = unicodedata.normalize("NFKD", a).casefold()
    nb = unicodedata.normalize("NFKD", b).casefold()
    return (na > nb) - (na < nb)

conn.create_collation("NORMALIZED", collate_normalized)
# SELECT * FROM users ORDER BY name COLLATE NORMALIZED;
```

### Scalar Functions

```python
import json

def json_array_length(value):
    if value is None:
        return 0
    return len(json.loads(value))

conn.create_function("json_arr_len", 1, json_array_length)
# SELECT json_arr_len(tags) FROM posts;
```

---

## 3. Backup API

Copy a live database without locking writes:

```python
import sqlite3

def backup_database(source_path: str, backup_path: str):
    source = sqlite3.connect(source_path)
    dest = sqlite3.connect(backup_path)
    with dest:
        source.backup(dest, pages=100, progress=backup_progress)
    dest.close()
    source.close()

def backup_progress(status, remaining, total):
    print(f"Backup: {total - remaining}/{total} pages copied")
```

The `pages` parameter controls how many pages are copied per step. Between steps, other connections can write. This makes `backup()` suitable for hot backups of production databases.

### In-Memory to Disk (and Vice Versa)

```python
# Load disk database into memory for fast operations
disk_db = sqlite3.connect("app.db")
mem_db = sqlite3.connect(":memory:")
disk_db.backup(mem_db)

# Save in-memory database to disk
mem_db.backup(disk_db)
```

---

## 4. Datetime Adapters

SQLite has no native datetime type. Store timestamps as ISO 8601 text and register adapters for automatic conversion:

```python
import sqlite3
from datetime import datetime, timezone

def adapt_datetime(dt: datetime) -> str:
    return dt.isoformat()

def convert_datetime(value: bytes) -> datetime:
    return datetime.fromisoformat(value.decode())

sqlite3.register_adapter(datetime, adapt_datetime)
sqlite3.register_converter("TIMESTAMP", convert_datetime)

conn = sqlite3.connect("app.db", detect_types=sqlite3.PARSE_DECLTYPES)
```

With `PARSE_DECLTYPES`, a column declared as `TIMESTAMP` automatically uses the registered converter. This keeps datetime handling transparent to application code.

---

## 5. Blob I/O

For large binary data, use incremental blob I/O instead of loading the entire value into memory:

```python
import sqlite3

# Write a blob
with open("image.png", "rb") as f:
    data = f.read()
    conn.execute("INSERT INTO files (name, data) VALUES (?, ?)", ("image.png", data))

# Read a blob incrementally
row = conn.execute("SELECT rowid, length(data) FROM files WHERE name = ?",
                   ("image.png",)).fetchone()
rowid, size = row

blob = conn.blobopen("main", "files", "data", rowid, readonly=True)
chunk_size = 65536
with open("output.png", "wb") as f:
    while True:
        chunk = blob.read(chunk_size)
        if not chunk:
            break
        f.write(chunk)
blob.close()
```

Incremental blob I/O avoids loading multi-megabyte files into Python memory. The `blobopen()` method returns a file-like object that reads directly from the database page cache.

---

## 6. aiosqlite + FastAPI Integration

### Dependency Pattern

```python
import aiosqlite
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Request

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db = await aiosqlite.connect("app.db")
    app.state.db.row_factory = aiosqlite.Row
    await app.state.db.execute("PRAGMA journal_mode=WAL")
    await app.state.db.execute("PRAGMA foreign_keys=ON")
    yield
    await app.state.db.close()

app = FastAPI(lifespan=lifespan)

async def get_db(request: Request) -> aiosqlite.Connection:
    return request.app.state.db

@app.get("/users")
async def list_users(db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute("SELECT * FROM users") as cursor:
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]
```

### Transaction Pattern

```python
async def create_user_with_profile(db: aiosqlite.Connection, user_data: dict):
    try:
        await db.execute("BEGIN")
        cursor = await db.execute(
            "INSERT INTO users (email, name) VALUES (?, ?) RETURNING id",
            (user_data["email"], user_data["name"]),
        )
        row = await cursor.fetchone()
        user_id = row[0]
        await db.execute(
            "INSERT INTO profiles (user_id, bio) VALUES (?, ?)",
            (user_id, user_data.get("bio", "")),
        )
        await db.commit()
        return user_id
    except Exception:
        await db.rollback()
        raise
```

---

## 7. Migration Patterns

### Simple Version Tracking

```python
import sqlite3

MIGRATIONS = [
    # Version 1
    """
    CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ) STRICT;
    """,
    # Version 2
    """
    ALTER TABLE users ADD COLUMN display_name TEXT;
    CREATE INDEX idx_users_email ON users(email);
    """,
    # Version 3
    """
    CREATE TABLE posts (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        body TEXT NOT NULL
    ) STRICT;
    """,
]

def migrate(conn: sqlite3.Connection):
    conn.execute("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER)")
    row = conn.execute("SELECT MAX(version) FROM schema_version").fetchone()
    current = row[0] if row[0] is not None else 0

    for i, sql in enumerate(MIGRATIONS[current:], start=current + 1):
        conn.executescript(sql)
        conn.execute("INSERT INTO schema_version (version) VALUES (?)", (i,))
        conn.commit()
```

This pattern works for small-to-medium applications.

### Reversible Migrations

Structure migrations as `(up_sql, down_sql)` tuples to support rollback during development:

```python
MIGRATIONS = [
    # Version 1
    (
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ) STRICT;
        """,
        """
        DROP TABLE users;
        """,
    ),
    # Version 2
    (
        """
        ALTER TABLE users ADD COLUMN display_name TEXT;
        CREATE INDEX idx_users_email ON users(email);
        """,
        """
        DROP INDEX idx_users_email;
        ALTER TABLE users DROP COLUMN display_name;
        """,
    ),
]

def rollback(conn: sqlite3.Connection, target_version: int):
    row = conn.execute("SELECT MAX(version) FROM schema_version").fetchone()
    current = row[0] if row[0] is not None else 0

    if target_version >= current:
        return

    for i in range(current, target_version, -1):
        _up, down_sql = MIGRATIONS[i - 1]
        conn.executescript(down_sql)
        conn.execute("DELETE FROM schema_version WHERE version = ?", (i,))
        conn.commit()
```

**Safety constraints:** `DROP COLUMN` is only available in SQLite 3.35.0+. Data-destructive operations (dropping columns, changing types, deleting rows) are not safely reversible — the down migration can undo the schema change but not restore lost data. Prefer forward-fix migrations in production; use rollback as a development convenience for iterating on schema changes.

For larger projects, use a dedicated migration tool (Alembic, yoyo-migrations) that provides migration file management and dependency tracking.
