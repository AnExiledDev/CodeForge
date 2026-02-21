# Error Patterns Reference

Catalog of common error patterns with symptoms, diagnosis commands, and resolutions. Organized by error category.

---

## Connection Errors

### ECONNREFUSED / Connection refused

**Symptoms:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
ConnectionRefusedError: [Errno 111] Connection refused
upstream connect error or disconnect/reset before headers
```

**Diagnosis:**
```bash
# Is the target service running?
docker ps -a --filter "name=<service>"
ss -tlnp | grep <port>
netstat -tlnp 2>/dev/null | grep <port>

# Can we reach the port?
curl -v telnet://localhost:<port> 2>&1 | head -5

# In Docker Compose, services use service names as hostnames
docker compose exec <client_service> sh -c "nc -zv <target_service> <port>"
```

**Resolution:**
- Target service is not running → Start it, check its logs for startup failures
- Wrong hostname → In Docker Compose, use the service name (not `localhost`)
- Wrong port → Verify the port the service is actually listening on
- Service starting too slowly → Add health check + `depends_on` with `condition: service_healthy`

### ETIMEDOUT / Connection timed out

**Symptoms:**
```
Error: connect ETIMEDOUT 10.0.0.5:3000
requests.exceptions.ConnectTimeout
dial tcp 10.0.0.5:3000: i/o timeout
```

**Diagnosis:**
```bash
# Network reachability
ping -c 3 <host>
traceroute <host>

# DNS resolution
nslookup <hostname>
dig <hostname>

# Docker network inspection
docker network ls
docker network inspect <network_name>

# Check if container is on the expected network
docker inspect --format '{{json .NetworkSettings.Networks}}' <container> | python3 -m json.tool
```

**Resolution:**
- Containers on different Docker networks → Connect to same network or use `external` network
- Firewall/security group blocking → Check iptables, cloud security groups
- DNS not resolving → Verify Docker DNS, check `/etc/resolv.conf` in container

### DNS Resolution Failure

**Symptoms:**
```
Error: getaddrinfo ENOTFOUND myservice
socket.gaierror: [Errno -2] Name or service not known
dial tcp: lookup myservice: no such host
```

**Diagnosis:**
```bash
# From inside the container
docker compose exec <service> sh -c "nslookup <target_hostname>"
docker compose exec <service> sh -c "cat /etc/resolv.conf"

# Docker DNS uses 127.0.0.11 internally
docker compose exec <service> sh -c "nslookup <target_hostname> 127.0.0.11"
```

**Resolution:**
- Typo in hostname → Check Compose service names, environment variables
- Container not on same network → Verify Docker network membership
- External DNS failure → Check `/etc/resolv.conf`, try `8.8.8.8` as resolver

### SSL/TLS Errors

**Symptoms:**
```
SSL: CERTIFICATE_VERIFY_FAILED
unable to verify the first certificate
x509: certificate signed by unknown authority
ERR_CERT_AUTHORITY_INVALID
```

**Diagnosis:**
```bash
# Check certificate
openssl s_client -connect <host>:<port> -servername <host> </dev/null 2>/dev/null | openssl x509 -noout -dates -subject -issuer

# Check certificate chain
openssl s_client -connect <host>:<port> -servername <host> -showcerts </dev/null 2>&1 | grep -E "subject|issuer|verify"

# Check CA bundle in container
docker compose exec <service> sh -c "ls -la /etc/ssl/certs/"
```

**Resolution:**
- Self-signed cert in development → Set `REQUESTS_CA_BUNDLE`, `NODE_TLS_REJECT_UNAUTHORIZED=0` (dev only!)
- Expired certificate → Renew, check dates with openssl command above
- Missing intermediate cert → Ensure full chain is provided, not just leaf cert
- CA not trusted in container → Mount CA cert and update trust store

---

## Resource Exhaustion Errors

### OOMKilled (Out of Memory)

**Symptoms:**
```
Container exited with code 137
Killed
OOMKilled: true
kernel: Out of memory: Killed process <pid> (<name>)
```

**Diagnosis:**
```bash
# Check if container was OOM killed
docker inspect --format '{{.State.OOMKilled}}' <container>

# Container memory limit vs usage
docker stats --no-stream <container>

# Memory limit configured
docker inspect --format '{{.HostConfig.Memory}}' <container>

# Kernel OOM killer logs
journalctl -k --no-pager | grep -i "oom\|out of memory\|killed process" | tail -10
dmesg | grep -i "oom\|killed process" | tail -10

# Current memory usage
free -h
cat /proc/meminfo | head -10
```

**Resolution:**
- Increase container memory limit in `docker-compose.yml` (`deploy.resources.limits.memory`)
- Increase host memory or swap
- Fix memory leak in application (profile with language-specific tools)
- For Java: adjust `-Xmx` heap size to stay within container limit
- For Node: `--max-old-space-size=<MB>`

### Disk Space Exhaustion

**Symptoms:**
```
No space left on device
ENOSPC: no space left on device
OSError: [Errno 28] No space left on device
write /var/lib/docker/...: no space left on device
```

**Diagnosis:**
```bash
# Filesystem usage
df -h

# Largest directories
du -sh /var/lib/docker/ 2>/dev/null
du -sh /var/log/ 2>/dev/null
du -sh /tmp/ 2>/dev/null

# Docker disk usage breakdown
docker system df
docker system df -v

# Large Docker images
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | sort -k3 -h

# Dangling images and stopped containers
docker images -f "dangling=true"
docker ps -a --filter "status=exited" --format "table {{.Names}}\t{{.Size}}"
```

**Resolution:**
- Clean Docker resources: `docker system prune` (removes stopped containers, dangling images, unused networks)
- Clean build cache: `docker builder prune`
- Remove old images: `docker image prune -a`
- Rotate/compress log files
- Increase disk allocation

### File Descriptor Exhaustion

**Symptoms:**
```
Too many open files
EMFILE: too many open files
OSError: [Errno 24] Too many open files
accept4: too many open files
```

**Diagnosis:**
```bash
# Current limits
ulimit -n

# Per-process file descriptors (find PID first)
ls -la /proc/<pid>/fd | wc -l
cat /proc/<pid>/limits | grep "open files"

# System-wide
cat /proc/sys/fs/file-nr
# Format: <allocated> <free> <max>

# In Docker
docker exec <container> sh -c "ulimit -n"
docker exec <container> sh -c "cat /proc/1/limits | grep 'open files'"
```

**Resolution:**
- Increase container ulimit: `ulimits: { nofile: { soft: 65536, hard: 65536 } }` in Compose
- Increase host limit in `/etc/security/limits.conf`
- Fix file descriptor leaks (unclosed connections, file handles)
- For databases: check connection pooling settings

---

## Permission Errors

### EACCES / Permission denied

**Symptoms:**
```
Error: EACCES: permission denied, open '/app/data/file.txt'
PermissionError: [Errno 13] Permission denied: '/app/data/file.txt'
open /app/data/file.txt: permission denied
```

**Diagnosis:**
```bash
# Check file ownership and permissions
docker exec <container> ls -la /app/data/
docker exec <container> id

# Check who the container runs as
docker inspect --format '{{.Config.User}}' <container>

# Volume mount permissions
ls -la <host_mount_path>
```

**Resolution:**
- Mismatch between container user UID and file owner → Set correct ownership on host or match UIDs
- Volume mounted as root, container runs as non-root → `chown` on host or use `user:` in Compose
- Read-only filesystem → Check if volume is mounted as `:ro`
- SELinux → Add `:z` or `:Z` suffix to volume mount

### EPERM / Operation not permitted

**Symptoms:**
```
Operation not permitted
EPERM: operation not permitted
permission denied while trying to connect to the Docker daemon socket
```

**Diagnosis:**
```bash
# Docker socket access
ls -la /var/run/docker.sock
id  # Check group membership

# Container capabilities
docker inspect --format '{{.HostConfig.CapAdd}}' <container>
docker inspect --format '{{.HostConfig.SecurityOpt}}' <container>

# AppArmor / seccomp
docker inspect --format '{{.HostConfig.SecurityOpt}}' <container>
```

**Resolution:**
- Docker socket → Add user to `docker` group, or mount socket with correct permissions
- Missing capability → Add with `cap_add:` in Compose (e.g., `NET_ADMIN`, `SYS_PTRACE`)
- Seccomp blocking → Use custom seccomp profile or `--security-opt seccomp=unconfined` (dev only)

---

## Application Errors

### Unhandled Exceptions (Python)

**Symptoms:**
```
Traceback (most recent call last):
  File "/app/main.py", line 42, in process_request
    result = await db.execute(query)
asyncio.exceptions.CancelledError
```

**Diagnosis:**
```bash
# Search for tracebacks in container logs
docker logs <container> 2>&1 | grep -A 20 "Traceback"

# Search log files
grep -r -A 20 "Traceback" /app/logs/ 2>/dev/null

# Check the last error specifically
docker logs --tail 50 <container> 2>&1 | grep -B 5 -A 20 "Error\|Exception"
```

**Resolution:**
- Read the traceback bottom-to-top: the exception type and message are at the bottom, the call chain above
- `ModuleNotFoundError` → Missing dependency, check requirements.txt/pyproject.toml
- `AttributeError` → Wrong object type or missing attribute
- `KeyError` → Missing dictionary key, check data shape
- `asyncio.CancelledError` → Task cancelled, often during shutdown

### Unhandled Promise Rejections (Node.js)

**Symptoms:**
```
UnhandledPromiseRejectionWarning: Error: <message>
(node:1) UnhandledPromiseRejection
This error originated either by throwing inside an async function without a catch block
```

**Diagnosis:**
```bash
docker logs <container> 2>&1 | grep -B 5 -A 10 "UnhandledPromiseRejection\|unhandledRejection"
```

**Resolution:**
- Add try/catch around async operations
- Add global handler: `process.on('unhandledRejection', handler)`
- Check if a database connection or external service call is failing

### Segmentation Faults

**Symptoms:**
```
Segmentation fault (core dumped)
signal: segmentation fault (core dumped)
SIGSEGV
```

**Diagnosis:**
```bash
# Kernel log for segfault details
dmesg | grep segfault | tail -5
journalctl -k | grep segfault | tail -5

# Check if core dump exists
ls -la /var/crash/ /tmp/core.* 2>/dev/null

# In container
docker logs <container> 2>&1 | grep -i "segfault\|sigsegv\|core dumped"
```

**Resolution:**
- Native extension or C library issue — update dependencies
- Memory corruption — check for buffer overflows in native code
- Incompatible binary — rebuild native modules for container architecture

---

## Docker-Specific Errors

### Image Not Found

**Symptoms:**
```
Error response from daemon: manifest for <image>:<tag> not found
pull access denied for <image>, repository does not exist
```

**Diagnosis:**
```bash
# Check available local images
docker images | grep <image_name>

# Check registry
docker manifest inspect <image>:<tag> 2>&1

# Check Compose file for typos
grep -n "image:" docker-compose.yml
```

**Resolution:**
- Typo in image name or tag
- Private registry requires `docker login`
- Image was removed from registry
- Architecture mismatch (arm64 vs amd64)

### Port Conflict

**Symptoms:**
```
Bind for 0.0.0.0:8080 failed: port is already allocated
Error starting userland proxy: listen tcp4 0.0.0.0:8080: bind: address already in use
```

**Diagnosis:**
```bash
# What's using the port?
ss -tlnp | grep <port>
lsof -i :<port> 2>/dev/null

# Docker containers using the port
docker ps --format "table {{.Names}}\t{{.Ports}}" | grep <port>
```

**Resolution:**
- Stop the conflicting service or container
- Change the host port mapping in Compose (e.g., `8081:8080` instead of `8080:8080`)

### Volume Mount Errors

**Symptoms:**
```
ERROR: for <service> Cannot create container for service <service>: source path does not exist
Mounts denied: the path /host/path is not shared from the host
```

**Diagnosis:**
```bash
# Check if host path exists
ls -la <host_path>

# Check Docker Desktop file sharing settings (macOS/Windows)
docker info | grep -A 5 "Docker Root Dir"

# Inspect existing mounts
docker inspect --format '{{json .Mounts}}' <container> | python3 -m json.tool
```

**Resolution:**
- Create the host directory before starting the container
- On Docker Desktop: add path to file sharing settings
- Use named volumes instead of bind mounts for portability

### Health Check Failures

**Symptoms:**
```
Container <name> is unhealthy
health_status: unhealthy
depends_on condition not met: service <name> is not healthy
```

**Diagnosis:**
```bash
# Health status and recent check results
docker inspect --format '{{json .State.Health}}' <container> | python3 -m json.tool

# What health check is configured?
docker inspect --format '{{json .Config.Healthcheck}}' <container> | python3 -m json.tool

# Run the health check manually
docker exec <container> <health_check_command>
```

**Resolution:**
- Health check command failing → Run it manually to see the error
- Service not ready in time → Increase `start_period` and `interval`
- Wrong health check endpoint → Verify the URL/port/command

### Build Failures

**Symptoms:**
```
ERROR: Service '<service>' failed to build
COPY failed: file not found in build context
RUN /bin/sh -c <command> returned a non-zero code
```

**Diagnosis:**
```bash
# Check .dockerignore (it may exclude needed files)
cat .dockerignore 2>/dev/null

# Verify build context contents
ls -la <context_path>

# Build with verbose output
docker compose build --no-cache --progress plain <service> 2>&1

# Check which stage failed in multi-stage build
docker compose build <service> 2>&1 | grep -E "^#|ERROR|FAILED"
```

**Resolution:**
- `COPY failed` → File excluded by `.dockerignore` or wrong path relative to build context
- `RUN` failed → Command error; read the output for the specific failure
- Cache invalidation → Use `--no-cache` to rebuild from scratch

---

## Exit Code Reference

| Code | Signal | Meaning |
|---|---|---|
| `0` | — | Success / clean exit |
| `1` | — | General application error |
| `2` | — | Misuse of shell command (bad arguments) |
| `126` | — | Command invoked cannot execute (permission problem) |
| `127` | — | Command not found (bad PATH or entrypoint) |
| `128` | — | Invalid exit argument |
| `129` | SIGHUP (1) | Hangup (terminal closed) |
| `130` | SIGINT (2) | Interrupted (Ctrl+C) |
| `131` | SIGQUIT (3) | Quit with core dump |
| `134` | SIGABRT (6) | Abort (assertion failure, `abort()`) |
| `136` | SIGFPE (8) | Floating point exception |
| `137` | SIGKILL (9) | Killed (OOM killer, `docker kill`, `kill -9`) |
| `139` | SIGSEGV (11) | Segmentation fault |
| `141` | SIGPIPE (13) | Broken pipe |
| `143` | SIGTERM (15) | Terminated (`docker stop`, graceful shutdown) |
| `255` | — | Exit status out of range |

**Rule of thumb:** Exit codes 128+N mean the process was killed by signal N. Calculate: `exit_code - 128 = signal_number`.
