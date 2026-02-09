# REST Conventions Reference

## HTTP Method Semantics

### GET — Read Resources

- Retrieves a resource or collection. Never modifies state.
- **Cacheable** by default. Use `Cache-Control` and `ETag` headers.
- Collection: `GET /users` → `200 OK` with array
- Single: `GET /users/123` → `200 OK` with object, or `404 Not Found`

### POST — Create Resources

- Creates a new resource. The server assigns the ID.
- **Not idempotent** — repeating the request creates duplicate resources.
- Response: `201 Created` with `Location` header pointing to the new resource.
- Include the created resource in the response body.

### PUT — Full Replace

- Replaces the entire resource. Client sends the complete representation.
- **Idempotent** — repeating the request produces the same state.
- If the resource doesn't exist: return `404` (don't auto-create unless designed for upsert).
- Response: `200 OK` with the updated resource.

### PATCH — Partial Update

- Modifies specific fields without replacing the entire resource.
- Use JSON Merge Patch (`Content-Type: application/merge-patch+json`) for simplicity.
- Response: `200 OK` with the complete updated resource.
- Omitted fields remain unchanged.

### DELETE — Remove Resources

- Removes a resource.
- **Idempotent** — deleting an already-deleted resource returns `204` or `404` (both are valid, be consistent).
- Response: `204 No Content` (no body).

### HEAD — Headers Only

- Identical to GET but returns no body. Used for checking existence, content length, or cache validity.

### OPTIONS — Capabilities

- Returns allowed methods and CORS headers. Response: `204 No Content` with `Allow` header.

---

## Status Code Reference

### 2xx — Success

| Code | Name | When to Use |
|------|------|------------|
| `200` | OK | GET, PUT, PATCH succeeded. General success. |
| `201` | Created | POST created a resource. Include `Location` header. |
| `202` | Accepted | Request accepted for async processing. Include status URL. |
| `204` | No Content | DELETE succeeded. OPTIONS response. No body. |

### 3xx — Redirection

| Code | Name | When to Use |
|------|------|------------|
| `301` | Moved Permanently | Resource URL changed permanently. Clients should update. |
| `302` | Found | Temporary redirect. Original URL still valid. |
| `304` | Not Modified | Cache is still valid. Response to conditional GET. |

### 4xx — Client Errors

| Code | Name | When to Use |
|------|------|------------|
| `400` | Bad Request | Malformed syntax, invalid JSON, missing required fields. |
| `401` | Unauthorized | No credentials or invalid/expired credentials. |
| `403` | Forbidden | Valid credentials but insufficient permissions. |
| `404` | Not Found | Resource doesn't exist. |
| `405` | Method Not Allowed | HTTP method not supported for this URL. Include `Allow` header. |
| `409` | Conflict | State conflict (duplicate, version mismatch, concurrent modification). |
| `410` | Gone | Resource existed but was permanently deleted. |
| `415` | Unsupported Media Type | Content-Type not supported. |
| `422` | Unprocessable Entity | Valid syntax but semantic errors (validation failures). |
| `429` | Too Many Requests | Rate limit exceeded. Include `Retry-After` header. |

### 5xx — Server Errors

| Code | Name | When to Use |
|------|------|------------|
| `500` | Internal Server Error | Unhandled exception. Log the error, return generic message. |
| `502` | Bad Gateway | Upstream service returned invalid response. |
| `503` | Service Unavailable | Server overloaded or in maintenance. Include `Retry-After`. |
| `504` | Gateway Timeout | Upstream service did not respond in time. |

---

## Resource Naming Conventions

### Collection Patterns

```
/users                    → User collection
/users/{id}               → Specific user
/users/{id}/orders        → Orders belonging to a user
/users/{id}/orders/{oid}  → Specific order of a user
```

### Naming Rules

- **Plural nouns** for collections: `/users`, not `/user`
- **Lowercase with hyphens** for multi-word: `/order-items`, not `/orderItems` or `/order_items`
- **No trailing slashes**: `/users`, not `/users/`
- **No file extensions**: `/users/123`, not `/users/123.json`
- **No verbs**: `/users/{id}/activate` is acceptable as an action endpoint (RPC-style), but prefer state changes via PATCH when possible

### Action Endpoints (RPC-Style)

When a RESTful mapping is awkward, use action sub-resources:

```
POST /users/{id}/activate     → Activate a user
POST /orders/{id}/cancel      → Cancel an order
POST /emails/{id}/resend      → Resend an email
```

Action endpoints are always POST (they change state and are not idempotent).

---

## Query Parameter Patterns

### Filtering

```
GET /users?status=active
GET /users?role=admin&status=active
GET /orders?created_after=2024-01-01&created_before=2024-12-31
```

Use `snake_case` for parameter names. Support multiple values with comma separation or repeated params:
```
GET /users?role=admin,editor       (comma-separated)
GET /users?role=admin&role=editor  (repeated)
```

### Sorting

```
GET /users?sort_by=created_at&sort_order=desc
GET /users?sort=-created_at,name   (prefix - for descending)
```

### Field Selection

```
GET /users?fields=id,name,email
GET /users/{id}?fields=id,name,email,orders
```

Reduces payload size. Particularly valuable for mobile clients or list views.

### Search

```
GET /users?q=john                     (full-text search)
GET /users?name_contains=john         (field-specific search)
```

---

## Content Negotiation

### Request Headers

```
Content-Type: application/json        → Request body format
Accept: application/json              → Desired response format
Accept-Language: en-US                → Preferred language
```

### Response Headers

```
Content-Type: application/json; charset=utf-8
Content-Length: 1234
ETag: "abc123"
Cache-Control: max-age=3600
```

### Versioned Media Types

```
Accept: application/vnd.myapi.v2+json
```

An alternative to URL path versioning. The server reads the Accept header to determine which version to serve.

---

## HATEOAS (Hypermedia)

Include links to related resources and actions in responses:

```json
{
  "id": 123,
  "name": "Jane Doe",
  "links": {
    "self": "/users/123",
    "orders": "/users/123/orders",
    "activate": "/users/123/activate"
  }
}
```

**When it is worth it**: Public APIs consumed by many third-party clients. The links enable discoverability without hardcoding URL patterns.

**When it is over-engineering**: Internal APIs where clients are maintained by the same team. The added payload and complexity rarely justify the benefit.
