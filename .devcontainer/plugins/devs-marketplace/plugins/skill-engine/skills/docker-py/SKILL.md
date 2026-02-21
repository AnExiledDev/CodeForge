---
name: docker-py
description: >-
  This skill should be used when the user asks to "manage Docker containers from Python",
  "create containers programmatically", "stream Docker container logs",
  "execute commands in a running container", "manage Docker volumes from code",
  "build images with the Docker SDK", "use docker-py for container lifecycle",
  "monitor container health from Python", or discusses docker-py,
  aiodocker, programmatic container management, or Docker Engine API.
version: 0.1.0
---

# Docker SDK for Python

## Mental Model

The Docker SDK for Python (`docker-py`) provides **programmatic access to the Docker Engine API**. Where Dockerfiles and Compose files declare static configuration, the SDK enables dynamic container lifecycle management -- creating, starting, stopping, and inspecting containers at runtime from application code.

The SDK mirrors the Docker CLI's resource model: a `DockerClient` exposes collections (`.containers`, `.images`, `.volumes`, `.networks`), each with CRUD methods. Container objects are stateful handles -- they cache inspection data and expose methods like `.exec_run()`, `.logs()`, and `.stop()`. Call `.reload()` to refresh cached state from the daemon.

For async applications (FastAPI, event-driven systems), `aiodocker` provides an asyncio-native alternative with a similar API surface but different method signatures. The core Docker Engine API is the same underneath both libraries.

Assume `docker>=7.0` (the `docker` PyPI package) for all new code. Distinguish this skill from the docker skill (Dockerfiles and Compose), which covers static build and orchestration configuration.

---

## Client Initialization

Two primary initialization patterns:

```python
import docker

# From environment (reads DOCKER_HOST, DOCKER_TLS_VERIFY, DOCKER_CERT_PATH)
client = docker.from_env()

# Direct connection
client = docker.DockerClient(base_url="unix:///var/run/docker.sock")

# TCP with TLS
client = docker.DockerClient(base_url="tcp://192.168.1.10:2376", tls=True)
```

`from_env()` is the standard pattern for both local development and production. It auto-detects the Docker socket and API version. Key parameters: `timeout` (seconds), `max_pool_size` (connection pool), `use_ssh_client` (SSH transport).

### Connection Verification

```python
client.ping()           # Returns True if daemon is reachable
client.version()        # Returns API version info dict
client.info()           # Returns system-wide daemon information
```

---

## Container Lifecycle

All container operations live under `client.containers`.

### Create and Run

```python
# Run detached (create + start, returns Container object)
container = client.containers.run(
    "python:3.12-slim",
    command="python -m http.server 8000",
    name="my-server",
    detach=True,
    ports={"8000/tcp": 8080},
    environment={"DEBUG": "1"},
    labels={"app": "web", "env": "dev"},
)

# Create without starting
container = client.containers.create(
    "alpine:latest",
    command="sleep 3600",
    name="worker",
)
container.start()
```

Key `run()` parameters:

- **`detach=True`**: Run in background, return `Container` object. Without this, `run()` blocks and returns logs.
- **`ports`**: Port mapping dict: `{"80/tcp": 8080}` or `{"80/tcp": ("127.0.0.1", 8080)}`.
- **`volumes`**: Dict syntax: `{"/host/path": {"bind": "/container/path", "mode": "rw"}}`.
- **`mounts`**: Preferred over `volumes`. Uses `docker.types.Mount` objects.
- **`environment`**: Dict `{"KEY": "val"}` or list `["KEY=val"]`.
- **`remove=True`**: Auto-remove container when it exits.
- **`network`**: Connect to a network at creation time.
- **`user`**: Run as specific UID or username.
- **`working_dir`**: Set the working directory inside the container.
- **`init=True`**: Run init process as PID 1 (proper signal forwarding).

### List and Inspect

```python
# All running containers
containers = client.containers.list()

# Include stopped containers
containers = client.containers.list(all=True)

# Filter by label
containers = client.containers.list(filters={"label": "app=web"})

# Get a specific container
container = client.containers.get("my-server")
print(container.status)    # "running", "exited", "created", etc.
print(container.name)
print(container.short_id)
print(container.labels)
print(container.attrs)     # Full inspection dict
```

### Stop, Remove, Wait

```python
container.stop(timeout=10)         # SIGTERM, then SIGKILL after timeout
container.kill(signal="SIGTERM")   # Send specific signal
container.restart(timeout=10)
container.pause()
container.unpause()
container.remove(force=True)       # force=True kills if running

# Wait for exit (blocking)
result = container.wait(timeout=60)
print(result["StatusCode"])        # 0 for success
```

> **Deep dive:** See `references/container-lifecycle.md` for exec_run patterns, log streaming, health check configuration, health status polling, auto-remove patterns, and the wait/timeout API.

---

## Executing Commands in Containers

`exec_run()` executes a command inside a running container:

```python
# Basic execution
result = container.exec_run("ls -la /app")
print(result.exit_code)   # int
print(result.output)       # bytes

# Streaming output
result = container.exec_run("tail -f /var/log/app.log", stream=True)
for chunk in result.output:
    print(chunk.decode(), end="")

# Separated stdout/stderr
result = container.exec_run("some_command", demux=True)
stdout, stderr = result.output  # tuple of (bytes | None, bytes | None)

# With environment and working directory
result = container.exec_run(
    "python migrate.py",
    environment={"DB_URL": "sqlite:///app.db"},
    workdir="/app",
    user="appuser",
)
```

Key parameters: `stream` (return generator), `demux` (separate stdout/stderr), `detach` (fire-and-forget), `privileged` (extended privileges), `tty` (allocate pseudo-TTY).

---

## Log Streaming

```python
# All logs as bytes
logs = container.logs()

# Stream in real-time (blocking generator)
for line in container.logs(stream=True, follow=True):
    print(line.decode().strip())

# Tail last N lines
logs = container.logs(tail=100)

# Since a specific time
from datetime import datetime, timedelta
logs = container.logs(since=datetime.utcnow() - timedelta(hours=1))

# With timestamps
logs = container.logs(timestamps=True)
```

`stream=True` returns a generator; `follow=True` keeps the connection open for new output. Combine both for real-time log tailing.

---

## Image Management

```python
# Pull an image
image = client.images.pull("python", tag="3.12-slim")

# Build from Dockerfile
image, build_logs = client.images.build(
    path="/path/to/context",
    tag="myapp:latest",
    buildargs={"VERSION": "1.0"},
    target="production",
)

# List and search
images = client.images.list()
dangling = client.images.list(filters={"dangling": True})

# Tag and push
image.tag("registry.example.com/myapp", tag="v1.0")
client.images.push("registry.example.com/myapp", tag="v1.0")

# Clean up
client.images.prune(filters={"dangling": True})
```

> **Deep dive:** See `references/resources-and-security.md` for volume management, bind mount patterns, network operations, resource limits (CPU, memory, I/O), security options, and the aiodocker async alternative.

---

## Volumes and Bind Mounts

### Named Volumes

```python
volume = client.volumes.create(name="app-data", labels={"env": "prod"})

container = client.containers.run(
    "myapp",
    detach=True,
    volumes={"app-data": {"bind": "/data", "mode": "rw"}},
)
```

### Mount Objects (Preferred)

```python
from docker.types import Mount

container = client.containers.run(
    "myapp",
    detach=True,
    mounts=[
        Mount(target="/data", source="app-data", type="volume"),
        Mount(target="/config", source="/host/config", type="bind", read_only=True),
    ],
)
```

`Mount` objects are explicit about mount type and read-only status. Prefer them over the dict-based `volumes` syntax. Mount types: `"volume"` (Docker-managed), `"bind"` (host filesystem path), `"tmpfs"` (memory-backed, ephemeral).

### Volume Lifecycle

```python
# List all volumes
volumes = client.volumes.list(filters={"label": "env=prod"})

# Remove a specific volume
volume = client.volumes.get("app-data")
volume.remove()

# Prune unused volumes (not attached to any container)
result = client.volumes.prune()
print(f"Reclaimed: {result['SpaceReclaimed']} bytes")
```

Volumes persist independently of containers. Removing a container does not remove its volumes unless `container.remove(v=True)` is called explicitly.

---

## Network Operations

```python
# Create a network
network = client.networks.create("app-net", driver="bridge")

# Connect a container with DNS aliases
network.connect(container, aliases=["web", "frontend"])

# Connect with static IP (requires IPAM configuration on the network)
network.connect(container, ipv4_address="192.168.52.10")

# Disconnect
network.disconnect(container)

# List connected containers
network.reload()
for c in network.containers:
    print(f"{c.name}: {c.status}")
```

Networks enable container-to-container communication via DNS names. Containers on the same network can reach each other by container name or by aliases specified during `connect()`. Use `internal=True` when creating a network to block external access entirely.

### Network IPAM Configuration

```python
import docker.types

ipam_pool = docker.types.IPAMPool(subnet="192.168.52.0/24", gateway="192.168.52.254")
ipam_config = docker.types.IPAMConfig(pool_configs=[ipam_pool])

network = client.networks.create(
    "isolated-net",
    driver="bridge",
    ipam=ipam_config,
    internal=True,
    attachable=True,
)
```

---

## Health Check Monitoring

Configure health checks at container creation and poll the status programmatically:

```python
SECOND = 1_000_000_000  # nanosecond conversion constant

container = client.containers.run(
    "myapp:latest",
    detach=True,
    healthcheck={
        "test": ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"],
        "interval": 10 * SECOND,
        "timeout": 5 * SECOND,
        "retries": 3,
        "start_period": 30 * SECOND,
    },
)
```

All healthcheck time values are in **nanoseconds**. Define a `SECOND` constant for readability.

### Polling Health Status

```python
import time

def wait_for_healthy(container, timeout=60, interval=2):
    """Block until the container reports healthy or raise on failure."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        container.reload()
        health = container.attrs.get("State", {}).get("Health", {})
        status = health.get("Status", "none")
        if status == "healthy":
            return True
        if status == "unhealthy":
            logs = health.get("Log", [])
            last = logs[-1] if logs else {}
            raise RuntimeError(f"Unhealthy: {last.get('Output', '')[:200]}")
        time.sleep(interval)
    raise TimeoutError(f"Container not healthy within {timeout}s")
```

The health status is stored in `container.attrs["State"]["Health"]` and includes the current status (`"starting"`, `"healthy"`, `"unhealthy"`), the failing streak count, and a log of recent check results.

---

## Error Handling

The SDK exposes specific exception types for precise error handling:

```python
from docker.errors import ContainerError, ImageNotFound, NotFound, APIError
from requests.exceptions import ReadTimeout

try:
    container = client.containers.run("myapp", detach=True)
    result = container.wait(timeout=60)
except ImageNotFound:
    # Image needs to be pulled first
    client.images.pull("myapp", tag="latest")
except NotFound:
    # Container was auto-removed before inspection
    pass
except ContainerError as e:
    print(f"Exit code: {e.exit_status}")
    print(f"Stderr: {e.stderr.decode()}")
except ReadTimeout:
    # wait() exceeded the timeout; stop the container manually
    container.stop(timeout=5)
except APIError as e:
    print(f"Docker daemon error: {e.status_code} {e.explanation}")
```

Catch specific exceptions rather than bare `except`. `ContainerError` fires when `detach=False` and the container exits with a non-zero code. `ReadTimeout` fires when `wait()` exceeds its timeout. `APIError` is the base class for most daemon-level errors.

---

## Ambiguity Policy

These defaults apply when the user does not specify a preference. State the assumption when making a choice so the user can override:

- **Library choice:** Default to `docker` (docker-py) for synchronous code. Recommend `aiodocker` only when the application already uses asyncio throughout (e.g., FastAPI).
- **Container creation:** Default to `client.containers.run(detach=True)` for background containers. Use `create()` + `start()` only when pre-start configuration is needed.
- **Volume syntax:** Default to `Mount` objects over dict-based `volumes` parameter.
- **Connection:** Default to `docker.from_env()`. Use explicit `DockerClient()` only for remote daemons or custom socket paths.
- **Auto-remove:** Default to `remove=True` for ephemeral containers (one-off tasks). Omit for long-running services.
- **Error handling:** Import and catch specific exceptions (`ImageNotFound`, `NotFound`, `ContainerError`, `APIError`) rather than bare `except`.

---

## Reference Files

| File | Contents |
|------|----------|
| `references/container-lifecycle.md` | Container create/run options, exec_run patterns (stream, demux, detach), log streaming, health check configuration, health status polling, wait/timeout, auto-remove, prune |
| `references/resources-and-security.md` | Volume CRUD, bind mount patterns, Mount objects, network create/connect/disconnect, resource limits (CPU, memory, I/O), security options (capabilities, read-only, seccomp, namespaces), image management, aiodocker async alternative |
