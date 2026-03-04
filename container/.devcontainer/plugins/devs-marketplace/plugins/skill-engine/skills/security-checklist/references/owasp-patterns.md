# OWASP Top 10 Patterns with Code Examples

Detailed vulnerability patterns with vulnerable and fixed code for each OWASP category.

## Contents

- [A01: Broken Access Control](#a01-broken-access-control)
- [A02: Cryptographic Failures](#a02-cryptographic-failures)
- [A03: Injection](#a03-injection)
- [A05: Security Misconfiguration](#a05-security-misconfiguration)
- [A07: Authentication Failures](#a07-authentication-failures)
- [A10: Server-Side Request Forgery (SSRF)](#a10-server-side-request-forgery-ssrf)
- [Cross-Cutting Patterns](#cross-cutting-patterns)

---

## A01: Broken Access Control

### Insecure Direct Object Reference (IDOR)

```python
# VULNERABLE: No authorization check — any user can access any order
@app.get("/api/orders/{order_id}")
async def get_order(order_id: int):
    return db.get_order(order_id)

# FIXED: Verify the requesting user owns the resource
@app.get("/api/orders/{order_id}")
async def get_order(order_id: int, current_user: User = Depends(get_current_user)):
    order = db.get_order(order_id)
    if order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return order
```

### Missing Function-Level Access Control

```python
# VULNERABLE: Admin endpoint with no role check
@app.delete("/api/users/{user_id}")
async def delete_user(user_id: int, current_user: User = Depends(get_current_user)):
    db.delete_user(user_id)

# FIXED: Enforce role-based access
@app.delete("/api/users/{user_id}")
async def delete_user(user_id: int, current_user: User = Depends(require_admin)):
    db.delete_user(user_id)

def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    return current_user
```

---

## A02: Cryptographic Failures

### Weak Password Hashing

```python
# VULNERABLE: MD5 is not a password hash — it's fast and rainbow-table-vulnerable
import hashlib
hashed = hashlib.md5(password.encode()).hexdigest()

# FIXED: Use bcrypt with automatic salting
import bcrypt
hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))

# Verification
if bcrypt.checkpw(password.encode(), stored_hash):
    grant_access()
```

### Sensitive Data in Logs

```python
# VULNERABLE: Logging sensitive data
logger.info(f"User login: email={email}, password={password}")
logger.debug(f"API response: {response.json()}")  # may contain tokens

# FIXED: Redact sensitive fields
logger.info(f"User login: email={email}")
logger.debug(f"API response: status={response.status_code}")
```

---

## A03: Injection

### SQL Injection

```python
# VULNERABLE: String interpolation in SQL
query = f"SELECT * FROM users WHERE email = '{email}' AND password = '{password}'"
cursor.execute(query)
# Attack: email = "' OR '1'='1' --"

# FIXED: Parameterized query
cursor.execute("SELECT * FROM users WHERE email = ? AND password = ?", (email, password_hash))
```

### Command Injection

```javascript
// VULNERABLE: User input in shell command
const { exec } = require("child_process");
exec(`convert ${req.body.filename} output.png`);
// Attack: filename = "input.jpg; rm -rf /"

// FIXED: Use execFile with argument array (no shell)
const { execFile } = require("child_process");
execFile("convert", [req.body.filename, "output.png"]);
```

### Template Injection (SSTI)

```python
# VULNERABLE: User input in template string
from jinja2 import Template
template = Template(f"Hello {user_input}")
# Attack: user_input = "{{ config.items() }}"

# FIXED: Pass user input as a variable, not template content
from jinja2 import Environment, select_autoescape
env = Environment(autoescape=select_autoescape())
template = env.from_string("Hello {{ name }}")
result = template.render(name=user_input)
```

---

## A05: Security Misconfiguration

### CORS Misconfiguration

```python
# VULNERABLE: Allow all origins
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True)

# FIXED: Explicit origin allowlist
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://myapp.com", "https://staging.myapp.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

### Debug Mode in Production

```python
# VULNERABLE: Debug mode exposes stack traces and internal state
app = Flask(__name__)
app.run(debug=True)  # NEVER in production

# FIXED: Environment-driven configuration
import os
app.run(debug=os.getenv("FLASK_ENV") == "development")
```

---

## A07: Authentication Failures

### No Rate Limiting on Login

```python
# VULNERABLE: No limit on login attempts
@app.post("/login")
async def login(email: str, password: str):
    user = db.get_user_by_email(email)
    if user and verify_password(password, user.password_hash):
        return create_token(user)
    raise HTTPException(status_code=401)

# FIXED: Rate limiting with exponential backoff
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)

@app.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, email: str, password: str):
    user = db.get_user_by_email(email)
    if user and verify_password(password, user.password_hash):
        return create_token(user)
    await asyncio.sleep(random.uniform(0.1, 0.5))  # timing attack mitigation
    raise HTTPException(status_code=401)
```

---

## A10: Server-Side Request Forgery (SSRF)

```python
# VULNERABLE: User-supplied URL fetched without validation
@app.post("/fetch-url")
async def fetch_url(url: str):
    response = httpx.get(url)  # can access internal services
    return response.text
# Attack: url = "http://169.254.169.254/latest/meta-data/"  (AWS metadata)

# FIXED: Validate URL against allowlist and block internal ranges
import ipaddress
from urllib.parse import urlparse

BLOCKED_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
]

def is_safe_url(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False
    try:
        ip = ipaddress.ip_address(parsed.hostname)
        return not any(ip in net for net in BLOCKED_NETWORKS)
    except ValueError:
        # Hostname, not IP — resolve and check
        import socket
        ip = ipaddress.ip_address(socket.gethostbyname(parsed.hostname))
        return not any(ip in net for net in BLOCKED_NETWORKS)
```

---

## Cross-Cutting Patterns

### Security Headers (All Frameworks)

```python
# FastAPI middleware for security headers
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "0"  # disabled in favor of CSP
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response
```

### Input Validation Pattern

```python
from pydantic import BaseModel, Field, field_validator

class CreateUserRequest(BaseModel):
    email: str = Field(..., max_length=254)
    name: str = Field(..., min_length=1, max_length=100)
    age: int = Field(..., ge=0, le=150)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if "@" not in v or ".." in v:
            raise ValueError("Invalid email format")
        return v.lower().strip()
```

Always validate at the boundary — even if the frontend validates, the backend must validate independently.
