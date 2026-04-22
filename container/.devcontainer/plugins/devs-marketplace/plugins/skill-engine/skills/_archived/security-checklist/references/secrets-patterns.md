# Secrets Detection Patterns

Comprehensive regex patterns and strategies for detecting accidentally committed secrets.

## Contents

- [Cloud Provider Keys](#cloud-provider-keys)
- [Version Control Platform Tokens](#version-control-platform-tokens)
- [API Keys and Tokens](#api-keys-and-tokens)
- [Database Connection Strings](#database-connection-strings)
- [Certificates and Private Keys](#certificates-and-private-keys)
- [High-Entropy String Detection](#high-entropy-string-detection)
- [Prevention Strategies](#prevention-strategies)

---

## Cloud Provider Keys

### AWS

```regex
# AWS Access Key ID (starts with AKIA)
AKIA[0-9A-Z]{16}

# AWS Secret Access Key (40-char base64 near "aws" keyword)
(?i)aws(.{0,20})?(?-i)['\"][0-9a-zA-Z/+]{40}['\"]

# AWS Session Token
(?i)aws(.{0,10})?session(.{0,10})?token(.{0,5})?['\"][A-Za-z0-9/+=]{100,}['\"]

# AWS Account ID (12 digits, context-dependent)
(?i)(aws.?account.?id|account.?id)[\s:=]*['\"]?\d{12}['\"]?
```

### Google Cloud

```regex
# GCP Service Account Key (JSON key file identifier)
\"type\":\s*\"service_account\"

# GCP API Key
AIza[0-9A-Za-z\\-_]{35}

# GCP OAuth Client Secret
(?i)(client_secret|client.secret)[\s:=]*['\"][a-zA-Z0-9_-]{24,}['\"]
```

### Azure

```regex
# Azure Storage Account Key
(?i)(AccountKey|account_key|azure.storage.key)[\s:=]*['\"][A-Za-z0-9+/=]{86,88}['\"]

# Azure Connection String
(?i)(DefaultEndpointsProtocol=https?;AccountName=)[^\s;]+;AccountKey=[A-Za-z0-9+/=]+
```

---

## Version Control Platform Tokens

```regex
# GitHub Personal Access Token (classic)
ghp_[A-Za-z0-9_]{36}

# GitHub OAuth Access Token
gho_[A-Za-z0-9_]{36}

# GitHub User-to-Server Token
ghu_[A-Za-z0-9_]{36}

# GitHub Server-to-Server Token
ghs_[A-Za-z0-9_]{36}

# GitHub Refresh Token
ghr_[A-Za-z0-9_]{36}

# GitLab Personal/Project/Group Access Token
glpat-[A-Za-z0-9_\-]{20,}

# Bitbucket App Password
(?i)(bitbucket.{0,20})(password|secret|token)[\s:=]*['\"][A-Za-z0-9]{20,}['\"]
```

---

## API Keys and Tokens

```regex
# Generic API Key pattern (key=value or key:value)
(?i)(api[_-]?key|apikey|api[_-]?secret|api[_-]?token)[\s]*[=:]\s*['\"][a-zA-Z0-9_\-]{16,}['\"]

# Bearer Token in code
(?i)(bearer|authorization)[\s:=]*['\"]Bearer\s+[A-Za-z0-9\-._~+/]+=*['\"]

# Slack Token
xox[bpors]-[0-9a-zA-Z]{10,250}

# Slack Webhook URL
https://hooks\.slack\.com/services/T[a-zA-Z0-9_]+/B[a-zA-Z0-9_]+/[a-zA-Z0-9_]+

# Stripe API Key
(?:sk|pk)_(test|live)_[0-9a-zA-Z]{24,}

# Twilio Account SID and Auth Token
AC[a-f0-9]{32}
(?i)(twilio.{0,20})(auth.?token|secret)[\s:=]*['\"][a-f0-9]{32}['\"]

# SendGrid API Key
SG\.[A-Za-z0-9_\-]{22}\.[A-Za-z0-9_\-]{43}
```

---

## Database Connection Strings

```regex
# PostgreSQL
(?i)postgres(ql)?://[^:]+:[^@]+@[^\s]+

# MySQL
(?i)mysql://[^:]+:[^@]+@[^\s]+

# MongoDB
(?i)mongodb(\+srv)?://[^:]+:[^@]+@[^\s]+

# Redis with password
(?i)redis://:[^@]+@[^\s]+

# JDBC with password
(?i)jdbc:[a-z]+://[^?]+\?.*password=[^\s&]+
```

---

## Certificates and Private Keys

```regex
# PEM-encoded private keys
-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----

# PEM-encoded certificates (less sensitive but may indicate bundled keys)
-----BEGIN CERTIFICATE-----

# PKCS#12 / PFX files (binary, detect by extension)
\.(p12|pfx)$

# SSH private key (not PEM format)
-----BEGIN OPENSSH PRIVATE KEY-----
```

---

## High-Entropy String Detection

For secrets that don't match known patterns, detect high-entropy strings:

```python
import math
import re
from collections import Counter

def shannon_entropy(s: str) -> float:
    """Calculate Shannon entropy of a string."""
    if not s:
        return 0.0
    length = len(s)
    freq = Counter(s)
    return -sum((count / length) * math.log2(count / length) for count in freq.values())

def is_potential_secret(value: str) -> bool:
    """Heuristic: long, high-entropy strings in assignment contexts."""
    if len(value) < 16:
        return False
    entropy = shannon_entropy(value)
    # Base64 strings: entropy > 4.5, hex strings: entropy > 3.5
    if entropy > 4.5 and len(value) >= 20:
        return True
    if entropy > 3.5 and len(value) >= 32 and re.match(r'^[0-9a-fA-F]+$', value):
        return True
    return False
```

**Entropy thresholds:**
- Random hex (32+ chars): entropy > 3.5
- Random base64 (20+ chars): entropy > 4.5
- English text: entropy ~ 3.5-4.0
- Code identifiers: entropy ~ 2.5-3.5

---

## Prevention Strategies

### Pre-commit Hook with gitleaks

```bash
# Install gitleaks
brew install gitleaks  # macOS
# or download from https://github.com/gitleaks/gitleaks/releases

# Run manually
gitleaks detect --source . --verbose

# Pre-commit hook (.pre-commit-config.yaml)
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
```

### .gitignore Patterns

```gitignore
# Environment files
.env
.env.*
!.env.example

# Private keys and certificates
*.pem
*.key
*.p12
*.pfx
*.jks

# Credential files
credentials.json
service-account*.json
*-credentials.*
*.keystore

# IDE and tool secrets
.idea/dataSources.xml
.vscode/settings.json  # may contain tokens
```

### Emergency Response

If a secret is committed:

1. **Rotate the secret immediately** -- this is the priority, not git history cleanup
2. **Revoke the old secret** in the provider's console
3. **Remove from git history** (optional, for hygiene):
   ```bash
   # Using git-filter-repo (preferred over filter-branch)
   pip install git-filter-repo
   git filter-repo --invert-paths --path secrets.json
   ```
4. **Force push** the cleaned history (coordinate with team)
5. **Audit access logs** for the compromised secret's usage during exposure window

**Critical:** Removing a secret from git history does NOT make it safe. If the repo was ever pushed to a remote (GitHub, GitLab), the secret was cached by the platform and potentially scraped by bots within minutes. Always rotate first.
