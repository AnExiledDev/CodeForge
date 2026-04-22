# API Error Handling Reference

## RFC 7807 Problem Details

The standard format for HTTP API error responses. Use `application/problem+json` as the content type.

### Format

```json
{
  "type": "https://api.example.com/errors/validation-error",
  "title": "Validation Error",
  "status": 422,
  "detail": "The 'email' field must be a valid email address.",
  "instance": "/users/signup",
  "errors": [
    {
      "field": "email",
      "message": "Must be a valid email address",
      "value": "not-an-email"
    }
  ]
}
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | URI reference identifying the error type. Use a stable URL (can be a documentation page). |
| `title` | Yes | Short human-readable summary. Same for all instances of this error type. |
| `status` | Yes | HTTP status code (repeated from response for convenience). |
| `detail` | Yes | Human-readable explanation specific to this occurrence. |
| `instance` | No | URI identifying the specific occurrence (request path or trace ID). |

Extension fields (like `errors` for validation) are allowed and encouraged for structured detail.

---

## Error Code Taxonomy

Organize errors into categories with consistent type URIs:

### Validation Errors (400 / 422)

```json
{
  "type": "https://api.example.com/errors/validation-error",
  "title": "Validation Error",
  "status": 422,
  "detail": "Request body contains invalid fields.",
  "errors": [
    { "field": "email", "message": "Required field is missing" },
    { "field": "age", "message": "Must be a positive integer", "value": -5 }
  ]
}
```

Use `422` for semantic validation failures (valid JSON but invalid data). Use `400` for malformed requests (invalid JSON, wrong content type).

### Authentication Errors (401)

```json
{
  "type": "https://api.example.com/errors/authentication-required",
  "title": "Authentication Required",
  "status": 401,
  "detail": "The access token has expired. Request a new token."
}
```

Always include `WWW-Authenticate` header with 401 responses.

### Authorization Errors (403)

```json
{
  "type": "https://api.example.com/errors/insufficient-permissions",
  "title": "Insufficient Permissions",
  "status": 403,
  "detail": "Your API key does not have access to the 'admin' scope."
}
```

### Not Found (404)

```json
{
  "type": "https://api.example.com/errors/resource-not-found",
  "title": "Resource Not Found",
  "status": 404,
  "detail": "No user found with ID '999'."
}
```

### Conflict (409)

```json
{
  "type": "https://api.example.com/errors/resource-conflict",
  "title": "Resource Conflict",
  "status": 409,
  "detail": "A user with email 'jane@example.com' already exists."
}
```

### Rate Limit (429)

```json
{
  "type": "https://api.example.com/errors/rate-limit-exceeded",
  "title": "Rate Limit Exceeded",
  "status": 429,
  "detail": "You have exceeded 100 requests per minute. Try again in 30 seconds."
}
```

Always include `Retry-After` header (seconds or HTTP-date).

### Internal Error (500)

```json
{
  "type": "https://api.example.com/errors/internal-error",
  "title": "Internal Server Error",
  "status": 500,
  "detail": "An unexpected error occurred. Reference: trace-abc123."
}
```

---

## Error Response Consistency Rules

1. **Same shape, always.** Every error response uses the same top-level structure. Consumers should never need to handle different error formats.
2. **Match status code to error.** The `status` field in the body matches the HTTP status code. Never return `200 OK` with an error body.
3. **Human-readable details.** The `detail` field should help the consumer fix the problem. "Invalid request" is useless. "The 'email' field must be a valid email address" is actionable.
4. **Machine-readable type.** The `type` URI enables programmatic error handling. Consumers can switch on the type without parsing the detail string.
5. **No stack traces in production.** Internal error details (stack traces, database errors, internal paths) are logged server-side. Clients receive a reference ID to correlate with server logs.

---

## Error Logging vs. Error Exposure

| Information | Log Server-Side | Return to Client |
|-------------|----------------|-----------------|
| Stack trace | Yes | No |
| Database error messages | Yes | No |
| Internal file paths | Yes | No |
| Request ID / trace ID | Yes | Yes (in `instance` or `detail`) |
| Validation errors | Yes | Yes (specific field-level errors) |
| Rate limit status | Yes | Yes (via headers + body) |
| Business rule violations | Yes | Yes (as actionable `detail`) |

---

## Retry Guidance Headers

| Header | Purpose | Format |
|--------|---------|--------|
| `Retry-After` | When to retry after 429 or 503 | Seconds (`30`) or HTTP-date (`Wed, 21 Oct 2025 07:28:00 GMT`) |
| `X-RateLimit-Limit` | Maximum requests allowed in window | Integer (`100`) |
| `X-RateLimit-Remaining` | Requests remaining in current window | Integer (`42`) |
| `X-RateLimit-Reset` | Unix timestamp when window resets | Integer (`1640000000`) |

Include all rate limit headers on **every response** (not just 429s) so clients can proactively manage their request rate.
