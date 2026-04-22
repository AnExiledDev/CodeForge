# Container Lifecycle -- Deep Dive

## 1. Container Create and Run Options

### Full run() Signature (Key Parameters)

```python
container = client.containers.run(
    image="python:3.12-slim",
    command="python app.py",
    name="my-app",
    detach=True,

    # Networking
    ports={"8000/tcp": 8080, "8443/tcp": ("127.0.0.1", 8443)},
    network="app-net",
    hostname="app-host",

    # Environment
    environment={"DEBUG": "1", "DB_URL": "sqlite:///data.db"},
    working_dir="/app",
    user="1000:1000",

    # Storage
    volumes={"/host/data": {"bind": "/data", "mode": "rw"}},
    mounts=[Mount(target="/config", source="/host/config", type="bind", read_only=True)],
    tmpfs={"/tmp": "size=100m"},
    read_only=True,

    # Lifecycle
    remove=True,           # auto-remove on exit
    init=True,             # use tini as PID 1
    restart_policy={"Name": "on-failure", "MaximumRetryCount": 3},
    stop_signal="SIGTERM",

    # Resources
    mem_limit="512m",
    nano_cpus=500_000_000,  # 0.5 CPU

    # Labels
    labels={"app": "web", "version": "1.0"},

    # Health
    healthcheck={
        "test": ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"],
        "interval": 10_000_000_000,
        "timeout": 5_000_000_000,
        "retries": 3,
        "start_period": 30_000_000_000,
    },
)
```

### create() vs run()

`create()` accepts the same parameters as `run()` but does not start the container:

```python
container = client.containers.create("alpine", command="echo hello", name="one-off")
# Configure further if needed...
container.start()
output = container.wait()
logs = container.logs()
container.remove()
```

Use `create()` + `start()` when:
- Pre-start inspection or configuration is needed.
- Attaching to streams before start.
- Explicit lifecycle control is required.

---

## 2. exec_run Patterns

### Basic Execution

```python
result = container.exec_run("python -c 'print(1+1)'")
assert result.exit_code == 0
assert result.output == b"2\n"
```

### Streaming Output

For long-running commands or real-time output:

```python
result = container.exec_run(
    "python train_model.py --epochs 100",
    stream=True,
    demux=True,
)
for stdout_chunk, stderr_chunk in result.output:
    if stdout_chunk:
        print(stdout_chunk.decode(), end="")
    if stderr_chunk:
        print(f"ERR: {stderr_chunk.decode()}", end="")
```

With `stream=True`, `result.output` is a generator. With `demux=True`, each yielded item is a tuple `(stdout_bytes | None, stderr_bytes | None)`.

### Detached Execution

Fire-and-forget commands:

```python
result = container.exec_run("cleanup.sh", detach=True)
# result.output is None; command runs in background
```

### Interactive-Style Execution

```python
result = container.exec_run(
    "/bin/sh -c 'cd /app && python manage.py migrate'",
    environment={"DJANGO_SETTINGS_MODULE": "config.production"},
    workdir="/app",
    user="django",
)
if result.exit_code != 0:
    raise RuntimeError(f"Migration failed: {result.output.decode()}")
```

### Full exec_run Signature

```python
container.exec_run(
    cmd,                # str or list
    stdout=True,        # attach stdout
    stderr=True,        # attach stderr
    stdin=False,        # attach stdin
    tty=False,          # allocate pseudo-TTY
    privileged=False,   # extended privileges
    user="",            # user identity
    detach=False,       # run in background
    stream=False,       # return generator
    socket=False,       # return raw socket
    environment=None,   # dict of env vars
    workdir=None,       # working directory
    demux=False,        # separate stdout/stderr
)
# Returns: ExecResult(exit_code=int, output=bytes|generator|tuple)
```

---

## 3. Log Streaming

### Real-Time Tailing

```python
import threading

def tail_logs(container):
    for line in container.logs(stream=True, follow=True):
        print(f"[{container.name}] {line.decode().strip()}")

thread = threading.Thread(target=tail_logs, args=(container,), daemon=True)
thread.start()
```

### Time-Bounded Logs

```python
from datetime import datetime, timedelta

# Last hour
recent = container.logs(since=datetime.utcnow() - timedelta(hours=1))

# Between two timestamps
logs = container.logs(
    since=datetime(2024, 1, 1),
    until=datetime(2024, 1, 2),
)
```

### Separated Streams

```python
stdout_only = container.logs(stdout=True, stderr=False)
stderr_only = container.logs(stdout=False, stderr=True)
```

### Full logs() Signature

```python
container.logs(
    stdout=True,        # include stdout
    stderr=True,        # include stderr
    stream=False,       # return generator (blocking)
    timestamps=False,   # prefix lines with timestamps
    tail="all",         # "all" or int (number of lines)
    since=None,         # datetime, epoch int, or float
    follow=False,       # keep connection open for new output
    until=None,         # datetime, epoch int, or float
)
```

---

## 4. Health Check Configuration

### Setting Health Checks at Creation

```python
container = client.containers.run(
    "myapp:latest",
    detach=True,
    healthcheck={
        "test": ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"],
        "interval": 10_000_000_000,     # 10 seconds (nanoseconds)
        "timeout": 5_000_000_000,       # 5 seconds
        "retries": 3,
        "start_period": 30_000_000_000, # 30 seconds grace
    },
)
```

All time values are in **nanoseconds**. Helpers:

```python
SECOND = 1_000_000_000
MINUTE = 60 * SECOND

healthcheck = {
    "test": ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"],
    "interval": 15 * SECOND,
    "timeout": 5 * SECOND,
    "retries": 3,
    "start_period": 1 * MINUTE,
}
```

Test formats:
- `["CMD", "executable", "arg1"]` -- run command directly.
- `["CMD-SHELL", "command string"]` -- run via `/bin/sh -c`.
- `["NONE"]` -- disable health checking.

### Disabling Health Checks

```python
container = client.containers.run("myapp", detach=True, healthcheck={"test": ["NONE"]})
```

---

## 5. Health Status Polling

### Reading Health Status

```python
container.reload()  # refresh cached state from daemon
health = container.attrs["State"]["Health"]

print(health["Status"])    # "healthy", "unhealthy", "starting"
print(health["FailingStreak"])
for log_entry in health["Log"]:
    print(f"  Exit: {log_entry['ExitCode']}, Output: {log_entry['Output'][:100]}")
```

### Polling Until Healthy

```python
import time

def wait_for_healthy(container, timeout=60, interval=2):
    """Poll container health status until healthy or timeout."""
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
            raise RuntimeError(
                f"Container unhealthy: exit={last.get('ExitCode')}, "
                f"output={last.get('Output', '')[:200]}"
            )
        time.sleep(interval)
    raise TimeoutError(f"Container did not become healthy within {timeout}s")
```

### Async Health Polling

```python
import asyncio

async def wait_for_healthy_async(container, timeout=60, interval=2):
    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        container.reload()
        status = container.attrs.get("State", {}).get("Health", {}).get("Status", "none")
        if status == "healthy":
            return True
        if status == "unhealthy":
            raise RuntimeError("Container unhealthy")
        await asyncio.sleep(interval)
    raise TimeoutError(f"Health check timeout after {timeout}s")
```

---

## 6. Wait and Timeout

### Blocking Wait

```python
result = container.wait(timeout=120, condition="not-running")
# Returns: {"StatusCode": 0, "Error": None}

if result["StatusCode"] != 0:
    logs = container.logs(tail=50)
    raise RuntimeError(f"Container failed (exit {result['StatusCode']}): {logs.decode()}")
```

`condition` options: `"not-running"` (default), `"next-exit"`, `"removed"`.

### Timeout Handling

```python
from requests.exceptions import ReadTimeout

try:
    result = container.wait(timeout=30)
except ReadTimeout:
    container.stop(timeout=5)
    container.remove(force=True)
    raise TimeoutError("Container did not exit within 30s")
```

---

## 7. Auto-Remove Patterns

### Ephemeral Containers

```python
# Auto-remove on exit (daemon-side)
output = client.containers.run(
    "python:3.12-slim",
    command="python -c 'print(42)'",
    remove=True,
)
print(output)  # b"42\n"
```

With `remove=True` and `detach=False` (default), the SDK blocks until the container exits, returns the output, and the daemon removes the container automatically.

### Detached with Auto-Remove

```python
container = client.containers.run(
    "worker:latest",
    detach=True,
    remove=True,
)
# Container auto-removes when it exits; container.wait() still works
result = container.wait()
```

Caveat: after auto-removal, `container.logs()` and `container.reload()` raise `NotFound`. Capture logs before waiting if needed.

---

## 8. Prune

Remove stopped containers, unused images, volumes, and networks:

```python
# Stopped containers
result = client.containers.prune(filters={"until": "24h"})
print(result["SpaceReclaimed"])

# Dangling images
client.images.prune(filters={"dangling": True})

# Unused volumes
client.volumes.prune()

# Unused networks
client.networks.prune()
```

Prune returns a dict with `SpaceReclaimed` (bytes) and the list of deleted resource IDs.
