---
name: security-checklist
description: >-
  This skill should be used when the user asks to "check for security issues",
  "audit this code for vulnerabilities", "scan for secrets", "review for
  injection attacks", "check OWASP compliance", "find security bugs",
  "detect hardcoded credentials", "review authentication logic",
  "check for XSS", "audit dependencies for vulnerabilities",
  or discusses security review, vulnerability scanning, OWASP Top 10,
  secrets detection, SQL injection, command injection, or dependency auditing.
version: 0.1.0
---

# Security Checklist

## Mental Model

Security is **defense in depth** -- no single layer protects you. Assume every input is hostile, every dependency is compromised, every network boundary is breached. Then build layers so that when (not if) one fails, the next catches the attack.

The practical consequence: validate at every boundary, not just the outermost one. A function that accepts user input should validate it even if the caller "should have" validated it. Database queries should use parameterized statements even if the application layer "should have" sanitized the input. This redundancy is not waste -- it's the safety net.

Security review has three phases:
1. **Input boundaries** -- Where does external data enter the system? (HTTP requests, file uploads, CLI args, environment variables, database reads, message queues)
2. **Trust transitions** -- Where does data cross from untrusted to trusted? (Deserialization, template rendering, shell execution, SQL queries)
3. **Output boundaries** -- Where does data leave the system? (Logs, error messages, API responses, HTML rendering)

Every vulnerability exists at a boundary where untrusted data is treated as trusted.

---

## OWASP Top 10 Quick Reference (2021)

### A01: Broken Access Control
Users act outside their intended permissions. Check: Can user A access user B's resources by changing an ID in the URL? Are admin endpoints protected by role checks, not just authentication?

### A02: Cryptographic Failures
Sensitive data transmitted or stored without proper encryption. Check: Is TLS enforced? Are passwords hashed with bcrypt/argon2 (not MD5/SHA1)? Are API keys in environment variables (not source code)?

### A03: Injection
Untrusted data sent to an interpreter as part of a command or query. Covers SQL injection, NoSQL injection, OS command injection, LDAP injection. Check: Are all database queries parameterized? Is user input ever passed to `eval()`, `exec()`, or shell commands?

### A04: Insecure Design
Missing or ineffective security controls at the design level. Check: Is there rate limiting on authentication endpoints? Are business logic constraints enforced server-side?

### A05: Security Misconfiguration
Default credentials, unnecessary features enabled, overly permissive CORS, verbose error messages in production. Check: Are stack traces hidden in production? Is directory listing disabled? Are default accounts removed?

### A06: Vulnerable and Outdated Components
Using libraries with known vulnerabilities. Check: When were dependencies last updated? Are there known CVEs in the dependency tree?

### A07: Identification and Authentication Failures
Weak passwords allowed, missing brute-force protection, session tokens in URLs. Check: Is there account lockout or rate limiting? Are session tokens regenerated after login?

### A08: Software and Data Integrity Failures
Code or data from untrusted sources without verification. Check: Are CI/CD pipelines protected? Are dependencies verified by checksum or signature?

### A09: Security Logging and Monitoring Failures
Insufficient logging of security events. Check: Are login failures logged? Are access control failures logged? Is there alerting on anomalous patterns?

### A10: Server-Side Request Forgery (SSRF)
Application fetches a URL from user input without validation. Check: Are user-supplied URLs validated against an allowlist? Is the application prevented from accessing internal services?

> **Deep dive:** See `references/owasp-patterns.md` for detailed OWASP patterns with vulnerable and fixed code examples.

---

## Language-Specific Vulnerability Patterns

### Python

**Dangerous deserialization:**
```python
# VULNERABLE: pickle executes arbitrary code on load
import pickle
data = pickle.loads(user_input)  # Remote code execution

# SAFE: use JSON or a schema-validated format
import json
data = json.loads(user_input)
```

**Code execution:**
```python
import ast
from typing import Any

# VULNERABLE: eval/exec on user input
result = eval(user_expression)

# SAFE: use ast.literal_eval for data, or a parser for expressions
def safe_eval(expression: str) -> Any:
    return ast.literal_eval(expression)  # only literals: strings, numbers, tuples, lists, dicts, bools, None
```

**Command injection:**
```python
# VULNERABLE: shell=True with user input
import subprocess
subprocess.run(f"grep {user_query} /var/log/app.log", shell=True)

# SAFE: pass args as list, never use shell=True with user input
subprocess.run(["grep", user_query, "/var/log/app.log"])
```

**SQL injection:**
```python
# VULNERABLE: string formatting in queries
cursor.execute(f"SELECT * FROM users WHERE email = '{email}'")

# SAFE: parameterized queries
cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
```

### JavaScript / TypeScript

**Prototype pollution:**
```javascript
// VULNERABLE: deep merge from user input
function merge(target, source) {
    for (const key in source) {
        target[key] = source[key]; // __proto__ can be overwritten
    }
}

// SAFE: validate keys, use Object.create(null), or use structuredClone
function safeMerge(target, source) {
    for (const key of Object.keys(source)) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
        target[key] = source[key];
    }
}
```

**ReDoS (Regular Expression Denial of Service):**
```javascript
// VULNERABLE: catastrophic backtracking
const emailRegex = /^([a-zA-Z0-9]+\.)*[a-zA-Z0-9]+@([a-zA-Z0-9]+\.)+[a-zA-Z]{2,}$/;

// SAFE: use linear-time regex or a dedicated validation library
const { z } = require("zod");
const email = z.string().email();
```

**Path traversal:**
```javascript
// VULNERABLE: user controls file path
const filePath = path.join("/uploads", req.params.filename);

// SAFE: resolve and verify the path stays within the allowed directory
const safePath = path.resolve("/uploads", req.params.filename);
if (!safePath.startsWith("/uploads/")) {
    throw new Error("Path traversal detected");
}
```

### Go

**Integer overflow:**
```go
// VULNERABLE: unchecked conversion
length := int32(userProvidedInt64) // silent truncation

// SAFE: bounds check before conversion
if userProvidedInt64 > math.MaxInt32 || userProvidedInt64 < math.MinInt32 {
    return fmt.Errorf("value out of range")
}
length := int32(userProvidedInt64)
```

**Race conditions:**
```go
// VULNERABLE: unsynchronized map access
var cache = make(map[string]string) // data race in concurrent use

// SAFE: use sync.Map or mutex
var cache sync.Map
cache.Store("key", "value")
val, ok := cache.Load("key")
```

---

## Secrets Detection

Scan code for accidentally committed secrets using these regex patterns:

```bash
# AWS Access Key
AKIA[0-9A-Z]{16}

# AWS Secret Key
(?i)aws(.{0,20})?(?-i)['\"][0-9a-zA-Z/+]{40}['\"]

# Generic API Key patterns
(?i)(api[_-]?key|apikey|api[_-]?secret)[\s]*[=:]\s*['\"][a-zA-Z0-9]{16,}['\"]

# GitHub Token
gh[pousr]_[A-Za-z0-9_]{36,}

# Generic high-entropy strings (base64, 32+ chars)
['\"][A-Za-z0-9+/]{32,}={0,2}['\"]

# Private keys
-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----

# Connection strings with passwords
(?i)(postgres|mysql|mongodb)://[^:]+:[^@]+@
```

**Prevention:**
- Use `.gitignore` to exclude `.env`, `*.pem`, `credentials.*`
- Add a pre-commit hook with tools like `gitleaks` or `detect-secrets`
- Store secrets in environment variables or a secrets manager, never in code
- If a secret is committed, rotate it immediately -- removing it from git history is not sufficient

> **Deep dive:** See `references/secrets-patterns.md` for comprehensive regex patterns and detection strategies.

---

## Dependency Audit Commands

Run these commands regularly and in CI/CD pipelines:

```bash
# JavaScript/TypeScript (npm)
npm audit
npm audit --audit-level=high    # fail only on high+ severity
npx audit-ci --high             # CI-friendly wrapper

# Python
pip-audit                       # PyPI advisory database
pip-audit --fix                 # auto-fix where possible
safety check                   # alternative scanner

# Rust
cargo audit                    # RustSec advisory database
cargo deny check advisories    # stricter policy engine

# Go
govulncheck ./...              # official Go vulnerability checker

# Container images
trivy image myapp:latest       # scan container for OS + app vulns
grype myapp:latest             # alternative container scanner

# Multi-language / CI
trivy fs .                     # scan filesystem for all languages
snyk test                      # commercial scanner with free tier
```

**Best practices:**
- Run audits in CI -- fail the build on high/critical findings
- Pin dependency versions in lock files (`package-lock.json`, `poetry.lock`, `Cargo.lock`)
- Update dependencies weekly, not quarterly -- smaller updates are easier to review
- Subscribe to security advisories for critical dependencies

---

## Ambiguity Policy

These defaults apply when the user does not specify a preference. State the assumption when making a choice:

- **Scan scope:** Default to the current project directory. Do not scan `node_modules`, `venv`, or other dependency directories directly -- use audit tools for those.
- **Severity threshold:** Flag all findings but prioritize high and critical. Informational findings are reported but not treated as blockers.
- **Secrets in tests:** Flag hardcoded credentials in test files as warnings, not errors -- but recommend using fixtures or environment variables instead.
- **Dependency updates:** Recommend updating vulnerable dependencies to the latest patch version, not the latest major version, to minimize breaking changes.
- **False positives:** When a finding is a false positive, explain why and suggest adding it to an ignore list rather than silently skipping it.
- **Framework:** Default to the security patterns of the framework in use (Django ORM over raw SQL, Express middleware over manual checks).

---

## Reference Files

| File | Contents |
|------|----------|
| `references/owasp-patterns.md` | Detailed OWASP Top 10 patterns with vulnerable and fixed code examples for Python, JavaScript, and Go |
| `references/secrets-patterns.md` | Comprehensive regex patterns for detecting API keys, tokens, certificates, and connection strings, plus prevention strategies |
