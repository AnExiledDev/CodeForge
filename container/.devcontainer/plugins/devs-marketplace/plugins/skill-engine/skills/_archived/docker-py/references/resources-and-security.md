# Resources and Security -- Deep Dive

## 1. Volume Management

### CRUD Operations

```python
# Create
volume = client.volumes.create(
    name="app-data",
    driver="local",
    driver_opts={"type": "tmpfs", "device": "tmpfs", "o": "size=100m"},
    labels={"env": "production"},
)

# List
volumes = client.volumes.list()
volumes = client.volumes.list(filters={"label": "env=production"})

# Get by name
volume = client.volumes.get("app-data")
print(volume.name)
print(volume.attrs)

# Remove
volume.remove(force=False)

# Prune unused
result = client.volumes.prune(filters={"label": "env=staging"})
```

### Using Volumes with Containers

**Dict syntax:**

```python
container = client.containers.run(
    "postgres:16",
    detach=True,
    volumes={
        "pgdata": {"bind": "/var/lib/postgresql/data", "mode": "rw"},
        "/host/backups": {"bind": "/backups", "mode": "ro"},
    },
)
```

**Mount objects (preferred):**

```python
from docker.types import Mount

container = client.containers.run(
    "postgres:16",
    detach=True,
    mounts=[
        Mount(target="/var/lib/postgresql/data", source="pgdata", type="volume"),
        Mount(target="/backups", source="/host/backups", type="bind", read_only=True),
        Mount(target="/tmp", type="tmpfs", tmpfs_size=100 * 1024 * 1024),
    ],
)
```

Mount types: `"volume"` (managed by Docker), `"bind"` (host path), `"tmpfs"` (memory-backed).

---

## 2. Bind Mount Patterns

### Read-Only Configuration

```python
from docker.types import Mount

mounts = [
    Mount(target="/app/config", source="/etc/myapp", type="bind", read_only=True),
]
```

### Writable Data Directory

```python
mounts = [
    Mount(target="/app/data", source="/var/lib/myapp", type="bind", read_only=False),
]
```

### Bind Mount Security Considerations

- Bind mounts expose host filesystem paths directly to the container.
- A writable bind mount to a sensitive host path (e.g., `/`, `/etc`, `/var/run/docker.sock`) grants significant host access.
- Prefer named volumes for application data. Use bind mounts only for configuration injection or development workflows.
- Mount the Docker socket (`/var/run/docker.sock`) only when container management is an explicit requirement, and combine with read-only root filesystem and dropped capabilities.

---

## 3. Network Operations

### Create Networks

```python
# Basic bridge network
network = client.networks.create("app-net", driver="bridge")

# With IPAM configuration
import docker.types
ipam_pool = docker.types.IPAMPool(subnet="192.168.52.0/24", gateway="192.168.52.254")
ipam_config = docker.types.IPAMConfig(pool_configs=[ipam_pool])

network = client.networks.create(
    "app-net",
    driver="bridge",
    ipam=ipam_config,
    internal=False,
    attachable=True,
    labels={"env": "dev"},
)
```

### Connect and Disconnect

```python
# Connect with aliases (DNS names within the network)
network.connect(container, aliases=["web-app", "frontend"])

# Connect with static IP
network.connect(container, ipv4_address="192.168.52.10")

# Disconnect
network.disconnect(container, force=False)
```

### Inspect Connected Containers

```python
network.reload()
for c in network.containers:
    print(f"{c.name}: {c.status}")
```

### Remove and Prune

```python
network.remove()
client.networks.prune(filters={"until": "24h"})
```

---

## 4. Resource Limits

### Memory

```python
container = client.containers.run(
    "myapp",
    detach=True,
    mem_limit="512m",           # hard limit: "100000b", "1000k", "128m", "1g"
    mem_reservation="256m",     # soft limit
    memswap_limit="1g",         # memory + swap combined
    oom_kill_disable=False,     # keep OOM killer enabled
)
```

### CPU

```python
container = client.containers.run(
    "myapp",
    detach=True,
    nano_cpus=500_000_000,      # 0.5 CPU (units: 1e-9 CPUs)
    cpuset_cpus="0-3",          # pin to specific CPUs
    cpu_shares=1024,            # relative weight (default 1024)
)
```

Alternative CPU limit via CFS quota:

```python
container = client.containers.run(
    "myapp",
    detach=True,
    cpu_period=100000,          # CFS period in microseconds
    cpu_quota=50000,            # 50% of one CPU
)
```

### Block I/O

```python
container = client.containers.run(
    "myapp",
    detach=True,
    blkio_weight=500,
    device_read_bps=[{"Path": "/dev/sda", "Rate": 1048576}],   # 1 MB/s
    device_write_bps=[{"Path": "/dev/sda", "Rate": 1048576}],
)
```

### PID Limit

```python
container = client.containers.run("myapp", detach=True, pids_limit=100)
```

### Runtime Updates

Update resource limits on a running container:

```python
container.update(
    mem_limit="1g",
    cpu_shares=2048,
    restart_policy={"Name": "on-failure", "MaximumRetryCount": 5},
)
```

---

## 5. Security Options

### Capabilities

Drop all capabilities and add only what is needed:

```python
container = client.containers.run(
    "myapp",
    detach=True,
    cap_drop=["ALL"],
    cap_add=["NET_BIND_SERVICE"],  # bind to ports < 1024
)
```

Common capabilities:
- `NET_ADMIN`: network configuration
- `SYS_PTRACE`: debugging, strace
- `NET_BIND_SERVICE`: bind to privileged ports
- `DAC_OVERRIDE`: bypass file permission checks

### Read-Only Root Filesystem

```python
container = client.containers.run(
    "myapp",
    detach=True,
    read_only=True,
    tmpfs={"/tmp": "size=100m", "/run": "size=10m"},
)
```

Combine `read_only=True` with `tmpfs` for directories that need write access. This prevents runtime modification of application code.

### Security Labels and Options

```python
container = client.containers.run(
    "myapp",
    detach=True,
    security_opt=[
        "no-new-privileges",              # prevent privilege escalation
        "label:type:svirt_apache_t",      # SELinux label
    ],
)
```

### Namespace Isolation

```python
container = client.containers.run(
    "myapp",
    detach=True,
    ipc_mode="private",        # isolate IPC namespace
    pid_mode="container:other", # share PID namespace with another container
    network_mode="none",        # no network access
    userns_mode="host",         # share host user namespace
)
```

### Non-Root User

```python
container = client.containers.run(
    "myapp",
    detach=True,
    user="1000:1000",          # UID:GID
)
```

### GPU Access

```python
import docker.types

container = client.containers.run(
    "nvidia/cuda:12.0-runtime",
    detach=True,
    device_requests=[
        docker.types.DeviceRequest(count=-1, capabilities=[["gpu"]]),  # all GPUs
    ],
)
```

---

## 6. Image Management

### Pull

```python
image = client.images.pull("python", tag="3.12-slim")

# With authentication
image = client.images.pull(
    "registry.example.com/private/app",
    auth_config={"username": "user", "password": "token"},
)
```

### Build

```python
image, build_logs = client.images.build(
    path="/path/to/context",
    tag="myapp:latest",
    nocache=False,
    buildargs={"VERSION": "1.0", "ENV": "production"},
    target="production",     # multi-stage target
    platform="linux/amd64",
    rm=True,                 # remove intermediate containers
)

for log_line in build_logs:
    if "stream" in log_line:
        print(log_line["stream"], end="")
```

### Tag and Push

```python
image = client.images.get("myapp:latest")
image.tag("registry.example.com/myapp", tag="v1.0")
client.images.push("registry.example.com/myapp", tag="v1.0")
```

### Save and Load

```python
# Export to tarball
image = client.images.get("myapp:latest")
with open("/tmp/myapp.tar", "wb") as f:
    for chunk in image.save(named=True):
        f.write(chunk)

# Import from tarball
with open("/tmp/myapp.tar", "rb") as f:
    images = client.images.load(f.read())
```

---

## 7. Error Handling Reference

```python
from docker.errors import (
    ContainerError,    # non-zero exit code (detach=False)
    ImageNotFound,     # image does not exist
    NotFound,          # container/resource not found
    APIError,          # general Docker daemon error
    BuildError,        # image build failure
)
from requests.exceptions import ReadTimeout, ConnectionError

try:
    container = client.containers.run("myapp", detach=True)
    container.wait(timeout=60)
except ImageNotFound:
    # Image needs to be pulled or built
    client.images.pull("myapp", tag="latest")
except NotFound:
    # Container was removed (e.g., auto-remove)
    pass
except ContainerError as e:
    print(f"Exit code: {e.exit_status}")
    print(f"Output: {e.stderr.decode()}")
except ReadTimeout:
    # wait() timed out
    container.stop(timeout=5)
except APIError as e:
    print(f"Docker API error: {e.status_code} {e.explanation}")
```

---

## 8. aiodocker -- Async Alternative

For asyncio applications, `aiodocker` provides native async/await support:

```python
import aiodocker

async def run_container():
    docker = aiodocker.Docker()
    try:
        container = await docker.containers.create_or_replace(
            config={
                "Cmd": ["python", "-c", "print('hello')"],
                "Image": "python:3.12-slim",
            },
            name="async-worker",
        )
        await container.start()

        # Stream logs
        async for line in container.log(stdout=True, follow=True):
            print(line)

        await container.wait()
        await container.delete(force=True)
    finally:
        await docker.close()
```

### Key Differences from docker-py

| Aspect | docker-py | aiodocker |
|--------|-----------|-----------|
| Style | Synchronous (blocking) | Asyncio-native |
| Config format | Keyword arguments | Raw Docker Engine API dicts |
| Client cleanup | Implicit | Explicit `await docker.close()` |
| Method names | `run()`, `remove()`, `logs()` | `create_or_replace()`, `delete()`, `log()` |
| Streaming | Thread-blocking generators | Async iterators |

### When to Use aiodocker

- The application already runs an asyncio event loop (FastAPI, aiohttp).
- Container operations happen alongside other async I/O (database queries, HTTP requests).
- Log streaming needs to be non-blocking.

### When to Use docker-py

- Scripts and CLI tools.
- Synchronous applications.
- The official `docker` library is needed for compatibility.
- Higher-level convenience methods (`run()`, `exec_run()`) are preferred over raw API dicts.
