# Advanced SQLite Queries -- Deep Dive

## 1. Common Table Expressions (CTEs)

CTEs define named temporary result sets within a single query. They improve readability and allow recursive queries.

### Non-Recursive CTEs

```sql
WITH active_users AS (
    SELECT id, email, display_name
    FROM users
    WHERE last_login > date('now', '-30 days')
),
user_stats AS (
    SELECT user_id, COUNT(*) AS post_count
    FROM posts
    GROUP BY user_id
)
SELECT au.email, au.display_name, COALESCE(us.post_count, 0) AS post_count
FROM active_users au
LEFT JOIN user_stats us ON au.id = us.user_id
ORDER BY post_count DESC;
```

### Recursive CTEs

Recursive CTEs self-reference to traverse hierarchical data:

```sql
-- Organizational hierarchy
WITH RECURSIVE org_tree AS (
    -- Base case: root nodes (no manager)
    SELECT id, name, manager_id, 0 AS depth, name AS path
    FROM employees
    WHERE manager_id IS NULL

    UNION ALL

    -- Recursive case: children of already-found nodes
    SELECT e.id, e.name, e.manager_id, ot.depth + 1,
           ot.path || ' > ' || e.name
    FROM employees e
    JOIN org_tree ot ON e.manager_id = ot.id
)
SELECT * FROM org_tree ORDER BY path;
```

```sql
-- Bill of materials (tree of components)
WITH RECURSIVE bom AS (
    SELECT component_id, parent_id, quantity, 1 AS level
    FROM components
    WHERE parent_id = :root_id

    UNION ALL

    SELECT c.component_id, c.parent_id, c.quantity * bom.quantity, bom.level + 1
    FROM components c
    JOIN bom ON c.parent_id = bom.component_id
)
SELECT * FROM bom;
```

### Limit Recursion Depth

SQLite defaults to a maximum recursion depth of 1000. Override with `LIMIT` on the CTE or adjust `SQLITE_MAX_VARIABLE_NUMBER`:

```sql
WITH RECURSIVE seq(n) AS (
    SELECT 1
    UNION ALL
    SELECT n + 1 FROM seq WHERE n < 100
)
SELECT n FROM seq;
```

---

## 2. Window Functions

Window functions compute values across a set of rows related to the current row, without collapsing the result set.

### ROW_NUMBER, RANK, DENSE_RANK

```sql
-- Rank users by post count within each category
SELECT
    u.name,
    c.category_name,
    COUNT(p.id) AS post_count,
    ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY COUNT(p.id) DESC) AS row_num,
    RANK() OVER (PARTITION BY c.id ORDER BY COUNT(p.id) DESC) AS rank,
    DENSE_RANK() OVER (PARTITION BY c.id ORDER BY COUNT(p.id) DESC) AS dense_rank
FROM users u
JOIN posts p ON u.id = p.user_id
JOIN categories c ON p.category_id = c.id
GROUP BY u.id, c.id;
```

| Function | Ties | Gaps |
|----------|------|------|
| `ROW_NUMBER` | Breaks ties arbitrarily | No gaps |
| `RANK` | Same rank for ties | Gaps after ties |
| `DENSE_RANK` | Same rank for ties | No gaps |

### LAG and LEAD

Access previous or next row values without a self-join:

```sql
-- Compare each sale to the previous day
SELECT
    date,
    revenue,
    LAG(revenue, 1) OVER (ORDER BY date) AS prev_day_revenue,
    revenue - LAG(revenue, 1) OVER (ORDER BY date) AS daily_change,
    LEAD(revenue, 1) OVER (ORDER BY date) AS next_day_revenue
FROM daily_sales;
```

### Running Totals and Moving Averages

```sql
-- Running total of revenue
SELECT
    date,
    revenue,
    SUM(revenue) OVER (ORDER BY date ROWS UNBOUNDED PRECEDING) AS running_total
FROM daily_sales;

-- 7-day moving average
SELECT
    date,
    revenue,
    AVG(revenue) OVER (
        ORDER BY date
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS moving_avg_7d
FROM daily_sales;
```

### NTILE and Percentiles

```sql
-- Divide users into quartiles by score
SELECT
    name,
    score,
    NTILE(4) OVER (ORDER BY score DESC) AS quartile
FROM users;

-- First and last value in partition
SELECT
    department,
    name,
    salary,
    FIRST_VALUE(name) OVER (PARTITION BY department ORDER BY salary DESC) AS highest_paid,
    LAST_VALUE(name) OVER (
        PARTITION BY department ORDER BY salary DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS lowest_paid
FROM employees;
```

---

## 3. Upsert (INSERT ... ON CONFLICT)

Insert a row or update it if a unique constraint would be violated:

```sql
-- Update on conflict with specific columns
INSERT INTO settings (key, value, updated_at)
VALUES ('theme', 'dark', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT (key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at;

-- Ignore duplicates silently
INSERT INTO tags (name) VALUES ('sqlite')
ON CONFLICT (name) DO NOTHING;

-- Conditional upsert
INSERT INTO counters (key, count) VALUES ('visits', 1)
ON CONFLICT (key) DO UPDATE SET count = count + 1
WHERE count < 1000000;
```

`excluded` refers to the row that would have been inserted. Use it to reference the new values in the `DO UPDATE` clause.

---

## 4. RETURNING

`RETURNING` retrieves the affected rows from `INSERT`, `UPDATE`, or `DELETE` without a separate query:

```sql
-- Get the inserted row with auto-generated id
INSERT INTO users (email, name) VALUES ('alice@example.com', 'Alice')
RETURNING id, email, name, created_at;

-- Get old values during update
UPDATE products SET price = price * 1.1
WHERE category = 'electronics'
RETURNING id, name, price AS new_price;

-- Confirm what was deleted
DELETE FROM sessions WHERE expires_at < datetime('now')
RETURNING id, user_id;
```

`RETURNING` is particularly useful with `INSERT` to avoid a round-trip `SELECT` for the auto-generated `rowid`.

---

## 5. EXPLAIN QUERY PLAN

Analyze how SQLite executes a query to identify missing indexes or inefficient scans:

```sql
EXPLAIN QUERY PLAN
SELECT u.name, COUNT(p.id)
FROM users u
JOIN posts p ON u.id = p.user_id
WHERE u.created_at > '2024-01-01'
GROUP BY u.id;
```

Output interpretation:

| Term | Meaning |
|------|---------|
| `SCAN` | Full table scan -- no index used |
| `SEARCH` | Index lookup -- efficient |
| `USING INDEX` | Specifies which index |
| `USING COVERING INDEX` | Index contains all needed columns, no table access |
| `TEMP B-TREE` | Temporary sort/group structure |

### Optimization Workflow

1. Run `EXPLAIN QUERY PLAN` on slow queries.
2. Look for `SCAN` on large tables -- this indicates a missing index.
3. Add an index on the filtered/joined column.
4. Re-run `EXPLAIN QUERY PLAN` to verify `SEARCH USING INDEX`.
5. Run `ANALYZE` after adding indexes to update the query planner's statistics.

```sql
-- Before: SCAN users
EXPLAIN QUERY PLAN SELECT * FROM users WHERE email = 'alice@example.com';

-- Add index
CREATE INDEX idx_users_email ON users(email);

-- After: SEARCH users USING INDEX idx_users_email
EXPLAIN QUERY PLAN SELECT * FROM users WHERE email = 'alice@example.com';
```

---

## 6. Covering Indexes

A covering index includes all columns referenced by a query, eliminating the need to read the main table:

```sql
-- This query needs id, email, and display_name
SELECT id, email, display_name FROM users WHERE email LIKE 'a%';

-- Covering index for this query
CREATE INDEX idx_users_email_covering ON users(email, id, display_name);
```

After adding the covering index, `EXPLAIN QUERY PLAN` shows `USING COVERING INDEX` instead of `USING INDEX` followed by a table lookup.

### When to Use Covering Indexes

- High-frequency read queries with a known column set.
- Queries where the table is wide (many columns) but only a few are needed.
- The tradeoff is increased write overhead and storage for the index.

---

## 7. Partial and Expression Indexes

### Partial Indexes

Index only rows matching a condition, reducing index size and write overhead:

```sql
-- Index only active users (smaller, faster)
CREATE INDEX idx_active_users ON users(email) WHERE status = 'active';

-- Index only non-null values
CREATE INDEX idx_users_display_name ON users(display_name)
    WHERE display_name IS NOT NULL;
```

The query planner uses a partial index only when the `WHERE` clause of the query matches the index condition.

### Expression Indexes

Index computed values:

```sql
-- Case-insensitive email lookup
CREATE INDEX idx_users_email_lower ON users(lower(email));
-- SELECT * FROM users WHERE lower(email) = 'alice@example.com';

-- Date extraction from ISO timestamp
CREATE INDEX idx_posts_date ON posts(date(created_at));
-- SELECT * FROM posts WHERE date(created_at) = '2024-06-15';
```

Expression indexes work with any deterministic SQL expression. The query must use the exact same expression for the planner to select the index.
