# Compose Services — Deep Dive

## 1. Health Check Recipes

### PostgreSQL

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres}"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s
```

### MySQL / MariaDB

```yaml
healthcheck:
  test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s
```

### Redis

```yaml
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 10s
  timeout: 3s
  retries: 3
```

### RabbitMQ

```yaml
healthcheck:
  test: ["CMD", "rabbitmq-diagnostics", "check_running"]
  interval: 15s
  timeout: 10s
  retries: 5
  start_period: 30s
```

### HTTP Service

```yaml
healthcheck:
  test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1"]
  interval: 15s
  timeout: 5s
  retries: 3
  start_period: 10s
```

### MongoDB

```yaml
healthcheck:
  test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 20s
```

### Elasticsearch

```yaml
healthcheck:
  test: ["CMD-SHELL", "curl -sf http://localhost:9200/_cluster/health || exit 1"]
  interval: 15s
  timeout: 10s
  retries: 5
  start_period: 60s
```

---

## 2. depends_on Conditions

### Condition Types

| Condition | Waits Until | Use Case |
|-----------|-------------|----------|
| `service_started` | Container has started | Services without health checks |
| `service_healthy` | Health check reports healthy | Databases, caches, brokers |
| `service_completed_successfully` | Container exits with code 0 | Migrations, seed scripts |

### Full Syntax

```yaml
services:
  api:
    depends_on:
      db:
        condition: service_healthy
        restart: true
        required: true
      migration:
        condition: service_completed_successfully
      cache:
        condition: service_started
        required: false
```

The `restart: true` flag (Compose v2.17.0+) automatically restarts the dependent service when the dependency is recreated or updated. This enables rolling updates where restarting a database triggers restart of dependent services.

The `required: false` flag (Compose v2.20.0+) makes a dependency optional — Compose warns but does not error if the dependency service is unavailable or not defined in the current profile.

### Migration Pattern

```yaml
services:
  migration:
    build:
      context: .
      target: migration
    depends_on:
      db:
        condition: service_healthy
    restart: "no"

  api:
    build:
      context: .
      target: runtime
    depends_on:
      db:
        condition: service_healthy
      migration:
        condition: service_completed_successfully
```

The migration service runs once, applies database changes, and exits. The API service starts only after migrations complete successfully.

---

## 3. Resource Limits

### CPU and Memory

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
          pids: 200
        reservations:
          cpus: "0.25"
          memory: 128M
```

| Field | Under `limits` | Under `reservations` |
|-------|---------------|---------------------|
| `cpus` | Maximum CPU shares (string, fractional) | Guaranteed minimum |
| `memory` | Hard ceiling — OOM killed if exceeded | Guaranteed allocation |
| `pids` | Maximum process/thread count | — |

Memory values accept suffixes: `b`, `k`, `m`, `g` (or uppercase `B`, `K`, `M`, `G`).

### GPU Reservations

```yaml
services:
  ml-worker:
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

Alternatively, specify exact GPU IDs:

```yaml
devices:
  - driver: nvidia
    device_ids: ["0", "2"]
    capabilities: [gpu, compute]
```

Capabilities include `gpu`, `compute`, `utility`, and `video`. The `count` field accepts an integer or `all`.

---

## 4. Profiles

### Conditional Service Groups

```yaml
services:
  app:
    build: .

  db:
    image: postgres:16-alpine

  adminer:
    image: adminer
    profiles: [debug]
    ports:
      - "8080:8080"

  mailhog:
    image: mailhog/mailhog
    profiles: [debug]

  seed:
    image: seed-runner
    profiles: [setup]
    depends_on:
      db:
        condition: service_healthy

  test-runner:
    build:
      context: .
      target: test
    profiles: [test]
```

Services without `profiles` always start. Activate profiles:

```bash
# Single profile
docker compose --profile debug up

# Multiple profiles
docker compose --profile debug --profile setup up

# Via environment
COMPOSE_PROFILES=debug,test docker compose up
```

A service with `depends_on` referencing a profiled service automatically activates that profile when started directly:

```bash
docker compose run seed  # Activates setup profile, starts db
```

---

## 5. include and extends

### include — Compose Sub-Applications

Load external Compose files as independent sub-applications. Each included file is evaluated in its own context (relative paths resolve from the included file's directory):

```yaml
# compose.yaml
include:
  - path: ./monitoring/compose.yaml
  - path: ./shared/compose.yaml
    project_directory: ./shared
    env_file: ./shared/.env
```

```yaml
# monitoring/compose.yaml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
```

Included services join the same project. Resource name conflicts produce a warning — Compose does not merge conflicting definitions. Variable interpolation works in paths: `${MONITORING_PATH:?required}/compose.yaml`.

### extends — Service Reuse

Reuse and override service definitions:

```yaml
# compose.yaml
services:
  web:
    extends:
      file: base-compose.yaml
      service: base-web
    environment:
      APP_ENV: production
    ports:
      - "80:8080"
```

```yaml
# base-compose.yaml
services:
  base-web:
    build:
      context: .
      target: runtime
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "wget --spider http://localhost:8080/health || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 3
```

Merge rules for `extends`:
- **Mappings** (`environment`, `labels`): Missing keys are added; conflicting keys are overridden
- **Sequences** (`ports`, `volumes`): Values are appended
- **Scalars** (`command`, `image`): The extending service's value replaces entirely
- **Shell commands** (`command`, `entrypoint`, `healthcheck.test`): Always replaced, never appended

Use `!reset` to clear an inherited attribute to its default value. Use `!override` to fully replace an attribute, bypassing merge rules.

---

## 6. Build Caching

### Local Cache

```yaml
services:
  app:
    build:
      context: .
      cache_from:
        - type=local,src=/tmp/buildcache
      cache_to:
        - type=local,dest=/tmp/buildcache,mode=max
```

### Registry Cache

```yaml
services:
  app:
    build:
      context: .
      cache_from:
        - type=registry,ref=registry.example.com/app:cache
      cache_to:
        - type=registry,ref=registry.example.com/app:cache,mode=max
```

### GitHub Actions Cache

```yaml
services:
  app:
    build:
      context: .
      cache_from:
        - type=gha
      cache_to:
        - type=gha,mode=max
```

The `mode=max` option caches all layers from all stages, not just the final stage. This maximizes cache hits at the cost of more storage.

---

## 7. Multi-Platform Builds

```yaml
services:
  app:
    build:
      context: .
      platforms:
        - linux/amd64
        - linux/arm64
```

Multi-platform builds require BuildKit and produce a manifest list. Push directly to a registry:

```bash
docker compose build --push
```

For local testing, build a single platform:

```bash
docker compose build --no-cache --builder default
```

---

## 8. Environment Variable Precedence

Environment variables resolve in the following order (highest priority first):

| Priority | Source | Scope |
|----------|--------|-------|
| 1 | `docker compose run -e VAR=val` | Container |
| 2 | `environment` attribute in Compose file | Container |
| 3 | `--env-file` CLI flag | Container |
| 4 | `env_file` attribute in Compose file | Container |
| 5 | Dockerfile `ENV` instruction | Container |
| 6 | `.env` file in project directory | Compose file interpolation only |

The `.env` file is special — it provides values for `${VAR}` substitution within the Compose file itself. It does not directly set variables inside containers unless explicitly referenced:

```yaml
# .env
DB_PORT=5432

# compose.yaml — ${DB_PORT} resolves to 5432 via .env
services:
  db:
    ports:
      - "${DB_PORT}:5432"
```

Interpolation supports defaults and error messages:

| Syntax | Behavior |
|--------|----------|
| `${VAR}` | Value of VAR, empty string if unset |
| `${VAR:-default}` | Value of VAR, or "default" if unset or empty |
| `${VAR-default}` | Value of VAR, or "default" if unset (empty is kept) |
| `${VAR:?error msg}` | Value of VAR, or error if unset or empty |
| `${VAR?error msg}` | Value of VAR, or error if unset |

The `env_file` attribute supports the `required` field (default `true`). Set `required: false` to silently skip missing files:

```yaml
env_file:
  - .env.defaults
  - path: .env.local
    required: false
```
