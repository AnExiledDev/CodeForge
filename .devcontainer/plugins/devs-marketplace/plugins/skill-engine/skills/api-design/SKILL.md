---
name: api-design
description: >-
  This skill should be used when the user asks to "design an API",
  "design REST endpoints", "plan API versioning", "choose pagination strategy",
  "design error responses", "API conventions", "endpoint design",
  "create API documentation", or discusses REST API design, HTTP method
  semantics, status code selection, authentication patterns, or rate limiting.
version: 0.1.0
---

# API Design

## Mental Model

APIs are **contracts**. Once published, they are promises to consumers. Design for the consumer, not the implementation. Consistency beats cleverness — a predictable API with simple conventions is easier to use than a clever API with special cases.

**Key principles:**
- **Resources, not actions.** URLs name things (`/users`, `/orders`), HTTP methods express actions (GET, POST, PUT, DELETE). Verbs in URLs signal a design problem.
- **Consistency above all.** If one endpoint uses `snake_case`, all endpoints use `snake_case`. If one endpoint paginates with `cursor`, all endpoints paginate with `cursor`.
- **Explicit over implicit.** Document every behavior. Default values, sort orders, pagination limits — if a consumer has to guess, the API is underspecified.
- **Idempotency by design.** GET, PUT, DELETE are idempotent. POST creates new resources. Design operations so repeating a request does not produce unexpected side effects.

---

## Resource Naming

Use plural nouns for collections, singular identifiers for individual resources:

```
GET    /users          → List users
POST   /users          → Create a user
GET    /users/{id}     → Get a specific user
PUT    /users/{id}     → Replace a user
PATCH  /users/{id}     → Partially update a user
DELETE /users/{id}     → Delete a user
```

**Nested resources** for clear ownership:
```
GET    /users/{id}/orders       → List orders for a user
POST   /users/{id}/orders       → Create an order for a user
GET    /users/{id}/orders/{oid} → Get a specific order
```

Limit nesting to 2 levels. Beyond that, promote the resource to a top-level endpoint with a query filter: `/orders?user_id=123`.

**Naming rules:**
- Use `kebab-case` for multi-word paths: `/order-items`, not `/orderItems`
- Use `snake_case` for query parameters: `?sort_by=created_at`
- Use `snake_case` for JSON fields (aligns with Python/Ruby; for JavaScript-heavy APIs, `camelCase` is also acceptable — pick one and be consistent)

---

## HTTP Method Semantics

| Method | Purpose | Idempotent | Request Body | Success Code |
|--------|---------|-----------|-------------|-------------|
| **GET** | Read resource(s) | Yes | No | 200 |
| **POST** | Create resource | No | Yes | 201 |
| **PUT** | Full replace | Yes | Yes | 200 |
| **PATCH** | Partial update | No* | Yes | 200 |
| **DELETE** | Remove resource | Yes | No | 204 |
| **HEAD** | Headers only (like GET) | Yes | No | 200 |
| **OPTIONS** | Describe capabilities | Yes | No | 204 |

*PATCH is idempotent if using JSON Merge Patch; not idempotent with JSON Patch operations.

---

## Pagination Patterns

### Cursor-Based (Recommended)

Best for real-time data, large datasets, and stable traversal:

```json
GET /users?cursor=eyJpZCI6MTIzfQ&limit=20

{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6MTQzfQ",
    "has_more": true
  }
}
```

Cursors are opaque tokens (base64-encoded state). Consumers pass them back unchanged.

### Offset-Based

Simpler but unstable under concurrent writes:

```json
GET /users?offset=40&limit=20

{
  "data": [...],
  "pagination": {
    "offset": 40,
    "limit": 20,
    "total": 156
  }
}
```

### Decision Framework

| Factor | Cursor | Offset |
|--------|--------|--------|
| Data stability | Handles inserts/deletes during pagination | Rows shift when data changes |
| Performance at scale | O(1) per page | O(n) for large offsets |
| "Jump to page N" | Not supported | Supported |
| Implementation complexity | Higher | Lower |

**Default**: Cursor pagination for new APIs. Offset only when consumers explicitly need page-number navigation.

---

## Versioning

### URL Path Versioning (Recommended)

```
/v1/users
/v2/users
```

Visible in every request. Easy to route, test, and document. Most widely understood.

### Header Versioning

```
Accept: application/vnd.api+json; version=2
```

Cleaner URLs but harder to test (can't bookmark/share versioned URLs) and harder to route.

### Decision Framework

| Factor | URL Path | Header |
|--------|----------|--------|
| Discoverability | High — visible in URL | Low — hidden in headers |
| Cacheability | Easy — URL-based caching | Requires Vary header |
| Testing | Easy — curl/browser | Requires setting headers |
| Aesthetics | "Ugly" URLs | Clean URLs |

**Default**: URL path versioning. It is the most pragmatic choice for most APIs.

---

## Authentication Patterns

| Pattern | Best For | Considerations |
|---------|----------|---------------|
| **API Keys** | Server-to-server, simple integrations | Easy to implement. No expiry by default — rotate regularly. Send via header (`X-API-Key` or `Authorization: Bearer`), never in URL. |
| **JWT (Bearer Tokens)** | Stateless auth, microservices | Self-contained claims. Set short expiry (15-60 min) + refresh tokens. Verify signature and expiry on every request. |
| **OAuth 2.0** | Third-party integrations, user consent | Authorization Code flow for web apps, Client Credentials for machine-to-machine. Use PKCE for public clients. |
| **Session Cookies** | Browser-based web apps | Set `HttpOnly`, `Secure`, `SameSite=Strict`. CSRF protection required. |

**Default**: JWT for APIs consumed by multiple clients. API keys for simple server-to-server integrations.

---

## Rate Limiting

### Token Bucket (Recommended)

Allows bursts up to bucket size, then enforces sustained rate:
- Bucket holds N tokens (e.g., 100)
- Tokens refill at R per second (e.g., 10/s)
- Each request costs 1 token (or more for expensive operations)

### Response Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1640000000
Retry-After: 30
```

Return `429 Too Many Requests` with `Retry-After` header when limit is exceeded.

---

## API Design Checklist

Before implementing, verify:

- [ ] Every endpoint uses a plural noun (not a verb) in the URL
- [ ] HTTP methods match their semantic purpose
- [ ] Response format is consistent across all endpoints
- [ ] Error responses follow a standard format (see reference)
- [ ] Pagination strategy is consistent across all list endpoints
- [ ] Authentication mechanism is documented
- [ ] Rate limits are defined and communicated via headers
- [ ] Versioning strategy is chosen and applied
- [ ] All parameters have documented types, constraints, and defaults
- [ ] Idempotency behavior is documented for each endpoint

---

## Ambiguity Policy

| Ambiguity | Default |
|-----------|---------|
| **API style** | REST with JSON request/response bodies |
| **Pagination** | Cursor-based with `limit` parameter (default 20, max 100) |
| **Versioning** | URL path versioning (`/v1/`) |
| **Naming convention** | `snake_case` for JSON fields, `kebab-case` for URL paths |
| **Auth pattern** | JWT Bearer tokens (unless server-to-server, then API keys) |
| **Error format** | RFC 7807 Problem Details |
| **Rate limiting** | Token bucket with standard headers |

---

## Reference Files

| File | Contents |
|------|----------|
| [REST Conventions](references/rest-conventions.md) | Complete HTTP method semantics, status code reference by category, resource naming examples, query parameter patterns, content negotiation, and HATEOAS guidance |
| [Error Handling](references/error-handling.md) | RFC 7807 Problem Details format, error code taxonomy, consistency rules, client-vs-server error exposure, and retry guidance headers |
