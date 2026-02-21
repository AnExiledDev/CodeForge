---
name: docker
description: >-
  This skill should be used when the user asks to "write a Dockerfile",
  "set up Docker Compose", "create a multi-stage Docker build",
  "add health checks to Docker Compose", "use Docker Compose watch for development",
  "configure Docker networking", "optimize Docker image size",
  "add secrets to Docker Compose", or discusses Dockerfile best practices,
  Compose service orchestration, container networking, volume management,
  build caching, resource limits, or development workflows with containers.
version: 0.1.0
---

# Docker & Docker Compose

## Mental Model

Containers are immutable, reproducible process environments. A Dockerfile defines how to build an image — a read-only filesystem snapshot plus metadata (entrypoint, exposed ports, environment). Containers are ephemeral instances of images; any state that must survive container recreation belongs in volumes or external stores.

Docker Compose is declarative service orchestration for local and CI environments. The Compose Specification is the unified format — there is no `version` field. The `docker-compose` standalone binary is deprecated; the current interface is the `docker compose` V2 plugin (invoked as a subcommand of `docker`).

A Compose file declares services, networks, volumes, secrets, and configs. Services reference images or build contexts. Dependencies between services use `depends_on` with health check conditions to ensure correct startup ordering.

---

## Dockerfile Patterns

Multi-stage builds separate build-time dependencies from the runtime image. Each `FROM` instruction starts a new stage; only the final stage produces layers in the output image. Earlier stages provide artifacts via `COPY --from=<stage>`:

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
USER app
EXPOSE 3000
ENTRYPOINT ["node"]
CMD ["dist/server.js"]
```

Layer caching is order-dependent. Place instructions that change infrequently (system packages, dependency manifests) before those that change often (application source). Use `COPY` over `ADD` unless tarball auto-extraction or remote URL fetching is specifically needed. Always include a `.dockerignore` to exclude `.git`, `node_modules`, build artifacts, and secrets from the build context.

Run the application as a non-root user. Create a dedicated user/group and switch with `USER` before the `ENTRYPOINT`. Separate `ENTRYPOINT` (the executable) from `CMD` (default arguments) — this allows `docker run <image> --custom-flag` to override arguments while preserving the entrypoint.

> **Deep dive:** See `references/dockerfile-patterns.md` for BuildKit cache mounts, `RUN --mount=type=secret`, layer ordering strategies, the ENTRYPOINT/CMD interaction matrix, common base images, security hardening patterns, and the security audit checklist.

---

## Compose Services

Define services with `build` (for local images) or `image` (for pre-built). Use `build.target` to select a specific Dockerfile stage and `build.args` for build-time variables:

```yaml
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: runtime
      args:
        NODE_ENV: production
    ports:
      - "3000:3000"
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: app
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    secrets:
      - db_password

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
```

Health checks on infrastructure services (databases, caches, message brokers) enable `depends_on` with `condition: service_healthy`, ensuring dependent services start only after their dependencies are ready to accept connections. The `service_completed_successfully` condition is for one-shot services like migrations.

> **Deep dive:** See `references/compose-services.md` for health check recipes across common services, `depends_on` conditions and `restart` flag, resource limits with `deploy.resources`, GPU reservations, build caching, and multi-platform builds.

---

## Development Workflow

Compose Watch monitors local files and triggers actions on change, replacing manual rebuild cycles. Define watch rules under `develop.watch`:

```yaml
services:
  app:
    build: .
    develop:
      watch:
        - path: ./src
          action: sync
          target: /app/src

        - path: ./config
          action: sync+restart
          target: /app/config

        - path: package.json
          action: rebuild

        - path: ./templates
          action: sync+exec
          target: /app/templates
          exec:
            command: app reload-templates
      initial_sync: true
```

| Action | Behavior | Requires `target` |
|--------|----------|-------------------|
| `sync` | Copies changed files into the running container | Yes |
| `rebuild` | Rebuilds the image and recreates the container | No |
| `restart` | Restarts the container without rebuilding | No |
| `sync+restart` | Syncs files then restarts the container | Yes |
| `sync+exec` | Syncs files then runs a command inside the container | Yes |

Start watch mode with `docker compose watch` or `docker compose up --watch`. Use `ignore` patterns (`.dockerignore` syntax) to exclude generated files and build artifacts from triggering actions.

For simple cases where watch is unnecessary, bind mounts provide direct host-to-container file mapping:

```yaml
volumes:
  - ./src:/app/src
```

---

## Networking and Volumes

Compose creates a default bridge network per project. Services resolve each other by service name via built-in DNS. Define custom networks for isolation:

```yaml
networks:
  frontend:
  backend:
    internal: true

services:
  web:
    networks:
      - frontend
      - backend
  api:
    networks:
      backend:
        aliases:
          - api-service
  db:
    networks:
      - backend
```

The `internal: true` flag prevents containers on that network from reaching the external network — useful for isolating databases and internal services.

Named volumes persist data across container recreations. Bind mounts map host paths directly. Tmpfs mounts provide ephemeral in-memory storage:

```yaml
volumes:
  pgdata:
  uploads:
    driver: local

services:
  db:
    volumes:
      - pgdata:/var/lib/postgresql/data
  app:
    volumes:
      - uploads:/app/uploads
    tmpfs:
      - /tmp
```

---

## Environment and Secrets

Environment variables follow a precedence chain (highest to lowest):

1. `docker compose run -e` overrides
2. `environment` attribute in Compose file
3. `--env-file` flag
4. `env_file` attribute in Compose file
5. `.env` file in project directory (for variable interpolation in the Compose file itself)

```yaml
services:
  app:
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://${DB_USER}:${DB_PASS}@db:5432/app
    env_file:
      - .env.defaults
      - path: .env.local
        required: false
```

The `.env` file provides values for `${VAR}` interpolation within the Compose file, not directly to containers. The `env_file` attribute loads variables into the container environment.

Secrets provide a secure alternative for sensitive values. Secrets are mounted as files under `/run/secrets/` by default:

```yaml
secrets:
  db_password:
    file: ./secrets/db_password.txt
  api_key:
    environment: API_KEY

services:
  app:
    secrets:
      - db_password
      - source: api_key
        target: /run/secrets/external_api_key
        mode: 0440
```

File-based secrets read from the host filesystem. Environment-based secrets read from the host environment at compose up time. Services can only access secrets explicitly listed in their `secrets` attribute.

---

## Profiles and Composition

Profiles conditionally include services. Services without a `profiles` attribute always start. Profiled services start only when their profile is activated:

```yaml
services:
  app:
    build: .

  debug-tools:
    image: busybox
    profiles: [debug]

  seed:
    image: seed-data
    profiles: [setup]
```

Activate with `docker compose --profile debug up` or `COMPOSE_PROFILES=debug,setup docker compose up`.

Compose files merge and override using multiple `-f` flags or the `compose.override.yaml` convention. The `include` directive loads other Compose files as independent sub-applications:

```yaml
include:
  - path: ../monitoring/compose.yaml
  - path: ../shared/compose.yaml
    env_file: ../.env
```

The `extends` attribute reuses service definitions from other files or services within the same file, applying merge rules for mappings, sequences, and scalars.

---

## Ambiguity Policy

These defaults apply when the user does not specify a preference. State the assumption when applying a default:

- **Compose filename:** `compose.yaml` (not `docker-compose.yml`)
- **Build strategy:** Multi-stage builds with separate builder and runtime stages
- **Base images:** Alpine variants for minimal size (`node:22-alpine`, `python:3.13-alpine`, `golang:1.23-alpine`)
- **Health checks:** Always define on infrastructure services (databases, caches, brokers)
- **Volume strategy:** Named volumes for persistent data; bind mounts for development source only
- **User:** Non-root with dedicated user/group in production images
- **Compose command:** `docker compose` (V2 plugin), not `docker-compose`

---

## Reference Files

| File | Contents |
|------|----------|
| `references/dockerfile-patterns.md` | Multi-stage deep dive, BuildKit cache mounts, `RUN --mount=type=secret`, layer ordering, ENTRYPOINT/CMD matrix, security hardening, common base images, `.dockerignore` patterns |
| `references/compose-services.md` | Health check recipes (Postgres, MySQL, Redis, RabbitMQ, HTTP), `depends_on` conditions, resource limits, GPU reservations, profiles, `include` and `extends`, build caching, environment variable precedence |
