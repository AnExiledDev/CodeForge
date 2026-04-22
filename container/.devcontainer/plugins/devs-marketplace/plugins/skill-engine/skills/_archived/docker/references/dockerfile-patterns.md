# Dockerfile Patterns — Deep Dive

## 1. Multi-Stage Build Strategies

### Shared Base Stage

Multiple stages can inherit from a common base to avoid repeating setup:

```dockerfile
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache tini

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS dev-deps
COPY package.json package-lock.json ./
RUN npm ci --include=dev

FROM dev-deps AS builder
COPY . .
RUN npm run build

FROM dev-deps AS test
COPY . .
RUN npm run test

FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
```

Build a specific stage with `docker build --target test .` to run tests without producing the runtime image. The final stage (runtime) only includes production dependencies and build output.

### BuildKit Cache Mounts

Cache mounts persist package manager caches across builds, eliminating redundant downloads:

```dockerfile
# Node.js — cache npm
RUN --mount=type=cache,target=/root/.npm \
    npm ci --production

# Python — cache pip
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-compile -r requirements.txt

# Go — cache modules and build
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -o /app .

# Apt — cache package lists and archives
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends gcc
```

The `sharing=locked` option serializes access when parallel builds target the same cache, preventing corruption of package manager lock files.

Cache mounts are BuildKit-only. Enable with `DOCKER_BUILDKIT=1` or use `docker buildx build`. Cache mounts are performance optimizations — builds must produce correct results even when the cache is empty.

### Secret Mounts

Inject secrets at build time without baking them into image layers:

```dockerfile
# As a file mount
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci --production

# As an environment variable
RUN --mount=type=secret,id=GITHUB_TOKEN,env=GITHUB_TOKEN \
    go install private.example.com/tool@latest
```

Pass secrets at build time:

```bash
docker buildx build --secret id=npmrc,src=$HOME/.npmrc .
docker buildx build --secret id=GITHUB_TOKEN,env=GITHUB_TOKEN .
```

Secret mounts are never included in the image layer cache. The `required` option (default `false`) controls whether the build fails if the secret is not provided.

---

## 2. Layer Ordering Strategy

Order Dockerfile instructions from least-frequently-changed to most-frequently-changed. Each instruction creates a layer; Docker caches layers until it encounters a change, then rebuilds all subsequent layers.

**Optimal order:**

```dockerfile
# 1. Base image (changes rarely)
FROM python:3.13-slim

# 2. System dependencies (changes occasionally)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 3. Working directory
WORKDIR /app

# 4. Dependency manifests (changes when deps change)
COPY pyproject.toml uv.lock ./

# 5. Install dependencies (rebuilds only when manifests change)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# 6. Application source (changes most frequently)
COPY . .

# 7. Runtime configuration (changes rarely)
USER nobody
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0"]
```

**Common mistakes:**
- Copying the entire source tree before installing dependencies — any source change invalidates the dependency cache
- Running `apt-get update` and `apt-get install` in separate `RUN` instructions — the update layer gets cached, leading to stale package lists
- Installing build tools in the runtime stage — use a separate build stage

---

## 3. ENTRYPOINT and CMD Interaction

### Exec Form vs Shell Form

| Form | Syntax | PID 1 | Signal handling | Variable expansion |
|------|--------|-------|-----------------|-------------------|
| Exec | `["executable", "arg1"]` | The executable | Direct (receives SIGTERM) | None |
| Shell | `executable arg1` | `/bin/sh -c` | Shell receives signals, not the process | Yes (`$VAR` works) |

Always prefer exec form for `ENTRYPOINT`. Shell form wraps the process in `/bin/sh`, preventing proper signal propagation for graceful shutdown.

### Interaction Matrix

| | No ENTRYPOINT | ENTRYPOINT (shell) `cmd` | ENTRYPOINT (exec) `["exec"]` |
|---|---|---|---|
| **No CMD** | Error | `/bin/sh -c cmd` | `exec` |
| **CMD (exec)** `["c1", "c2"]` | `c1 c2` | `/bin/sh -c cmd` | `exec c1 c2` |
| **CMD (shell)** `c1 c2` | `/bin/sh -c c1 c2` | `/bin/sh -c cmd` | `exec /bin/sh -c c1 c2` |

Key rules:
- `docker run <image> arg1 arg2` replaces CMD but preserves ENTRYPOINT
- Setting ENTRYPOINT resets any inherited CMD to empty
- Only the last ENTRYPOINT and last CMD in a Dockerfile take effect

### Common Patterns

**Init process wrapper** — handles zombie processes and signal forwarding:

```dockerfile
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
```

**Script entrypoint** — performs setup then execs the main process:

```dockerfile
COPY docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["postgres"]
```

```bash
#!/bin/sh
set -e
# Run migrations, set permissions, etc.
exec "$@"
```

The `exec "$@"` pattern replaces the shell with the CMD arguments, ensuring the application becomes PID 1.

---

## 4. Security Hardening

### Non-Root User

```dockerfile
# Alpine
RUN addgroup -S app && adduser -S -G app app
USER app

# Debian/Ubuntu
RUN groupadd --system app && useradd --system --gid app --no-create-home app
USER app
```

Set `USER` after copying files and before `ENTRYPOINT`/`CMD`. Files copied before `USER` are owned by root; use `COPY --chown=app:app` to set ownership at copy time.

### Read-Only Filesystem

Run containers with `--read-only` and provide writable tmpfs mounts for required paths:

```yaml
# compose.yaml
services:
  app:
    read_only: true
    tmpfs:
      - /tmp
      - /var/run
```

### Minimal Base Images

| Base | Size | Use Case |
|------|------|----------|
| `alpine:3.21` | ~7 MB | Static binaries, Go, Rust |
| `node:22-alpine` | ~130 MB | Node.js applications |
| `python:3.13-slim` | ~140 MB | Python (when C extensions needed) |
| `python:3.13-alpine` | ~50 MB | Python (pure Python or prebuilt wheels) |
| `gcr.io/distroless/static` | ~2 MB | Static binaries, no shell |
| `gcr.io/distroless/cc` | ~20 MB | C/C++ with glibc |
| `ubuntu:24.04` | ~75 MB | When Alpine compatibility is an issue |

Distroless images contain no shell, package manager, or unnecessary utilities — reducing attack surface. Debug variants (`distroless/static:debug`) include a busybox shell for troubleshooting.

### No Secrets in Build Args

Build args are visible in the image metadata (`docker history`). Use `--mount=type=secret` instead of `ARG` for sensitive values:

```dockerfile
# WRONG — secret visible in image history
ARG DATABASE_PASSWORD
RUN echo $DATABASE_PASSWORD > /app/config

# CORRECT — secret available only during build step
RUN --mount=type=secret,id=db_pass,target=/run/secrets/db_pass \
    cat /run/secrets/db_pass > /app/config
```

---

## 5. .dockerignore Patterns

Place `.dockerignore` in the build context root. Patterns follow `.gitignore` syntax:

```gitignore
# Version control
.git
.gitignore

# Dependencies (rebuilt in container)
node_modules
__pycache__
*.pyc
.venv
vendor/

# Build output
dist
build
*.egg-info

# IDE and editor files
.vscode
.idea
*.swp
*.swo

# Docker files (prevent recursive context)
Dockerfile*
compose*.yaml
.dockerignore

# Secrets and environment
.env
.env.*
*.pem
*.key
secrets/

# Documentation and CI
README.md
LICENSE
.github/
docs/
```

A well-maintained `.dockerignore` reduces build context size (faster builds) and prevents accidentally including secrets or unnecessary files in the image.

---

## 6. HEALTHCHECK in Dockerfile

Define health checks directly in the Dockerfile when the check is intrinsic to the application:

```dockerfile
# HTTP service
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# TCP service (no curl/wget needed)
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD ["pg_isready", "-U", "postgres"]
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--interval` | `30s` | Time between probes |
| `--timeout` | `30s` | Maximum time for a single probe |
| `--retries` | `3` | Consecutive failures before `unhealthy` |
| `--start-period` | `0s` | Grace period — failures do not count |
| `--start-interval` | `5s` | Probe frequency during start period |

Exit codes: `0` = healthy, `1` = unhealthy. Only the last `HEALTHCHECK` instruction takes effect. Disable an inherited health check with `HEALTHCHECK NONE`.

Prefer lightweight probes. Use `wget --spider` over `curl` in Alpine images (wget is included by default; curl requires installation). For non-HTTP services, use the service's native readiness tool (`pg_isready`, `redis-cli ping`, `mysqladmin ping`).

Health checks defined in the Dockerfile serve as defaults. Compose health checks override them when specified.

---

## 7. Security Audit Checklist

A systematic checklist for auditing Dockerfile and Compose security. Work through each item in order — earlier items address higher-impact risks:

1. **Base image currency** — Pin base images to a specific digest or version tag. Scan with `docker scout cves` or Trivy. Verify the image is updated within the last 90 days.
2. **Non-root user** — Confirm a dedicated user/group is created and `USER` is set before `ENTRYPOINT`/`CMD`. Verify no `chmod 777` or overly permissive ownership.
3. **Read-only root filesystem** — Enable `read_only: true` in Compose. Provide `tmpfs` mounts only for paths that require writes (`/tmp`, `/var/run`, application-specific caches).
4. **No secrets in build args or ENV** — Search for `ARG` and `ENV` containing passwords, tokens, or keys. Replace with `--mount=type=secret` for build-time secrets and `/run/secrets/` for runtime secrets.
5. **`.dockerignore` coverage** — Confirm `.env`, `*.pem`, `*.key`, credentials files, and `.git` are excluded from the build context.
6. **Minimal exposed ports** — Verify each `EXPOSE` and Compose `ports` entry is required. Internal-only services should not publish ports to the host.
7. **Capabilities dropped** — Set `cap_drop: [ALL]` in Compose, then add back only required capabilities with `cap_add`. Common additions: `NET_BIND_SERVICE` (bind ports < 1024), `SYS_PTRACE` (debugging only).
8. **Volume mounts reviewed** — Confirm no mount exposes the host root filesystem or Docker socket (`/var/run/docker.sock`) unless explicitly required and documented.
9. **Network isolation** — Backend services (databases, caches, internal APIs) should use networks with `internal: true`. Only edge services belong on externally reachable networks.
10. **Image scanning in CI** — Run `docker scout cves`, `trivy image`, or equivalent in the build pipeline. Fail the build on critical/high CVEs with no available fix excluded.
