---
name: debugging
description: >-
  This skill should be used when the user asks to "debug logs", "check logs",
  "find error in logs", "read docker logs", "investigate failure",
  "check container logs", "analyze error output", "find what went wrong",
  "why did this crash", "check what happened", "diagnose the issue",
  "look at the logs", or discusses log analysis, container debugging,
  error investigation, crash diagnosis, or service failure troubleshooting.
version: 0.1.0
---

# Debugging & Log Analysis

## Mental Model

Logs are **forensic evidence**. Debugging is a scientific method: observe symptoms, form hypotheses, gather evidence, test hypotheses, converge on root cause.

Every running system produces a trail of structured and unstructured log entries. Errors rarely happen in isolation — they cascade. The first error in a sequence is usually the root cause; everything after it is a consequence. Your job is to find that first domino.

**Key principles:**
- **Broad scan, then narrow focus.** Don't assume you know where the problem is. Survey all available log sources first, then zoom in on anomalies.
- **Chronology is king.** Timestamps tell you the order of events. The order of events tells you causality.
- **Absence of evidence is evidence.** If a service has no error logs, that's useful information — the problem is elsewhere.
- **Correlation across sources.** A single log source gives you symptoms. Multiple correlated sources give you root causes.

---

## Log Discovery by Environment

| Environment | Primary Sources | Key Commands |
|---|---|---|
| **Docker** | Container stdout/stderr, Docker events | `docker logs`, `docker ps -a`, `docker inspect`, `docker events` |
| **Docker Compose** | Aggregated service logs | `docker compose logs`, `docker compose ps` |
| **Linux systemd** | Journal, syslog | `journalctl -u <service>`, `journalctl -k` |
| **Python / FastAPI** | Uvicorn stderr, application loggers | Check `logging.conf`, `UVICORN_LOG_LEVEL`, stdout |
| **Node.js** | Console output, PM2 logs | `~/.pm2/logs/`, application `logs/` directory |
| **Nginx** | Access & error logs | `/var/log/nginx/error.log`, `/var/log/nginx/access.log` |
| **PostgreSQL** | Server log | `/var/log/postgresql/`, `pg_log/` |
| **Redis** | Server log | `/var/log/redis/`, `redis-server.log` |

---

## Common Log Locations Quick Reference

**System:**
- `/var/log/syslog` or `/var/log/messages` — General system log
- `/var/log/kern.log` — Kernel messages (OOM killer lives here)
- `/var/log/auth.log` — Authentication events
- `journalctl` — systemd journal (binary, query with flags)

**Docker:**
- Container logs via `docker logs <name>` (stored at `/var/lib/docker/containers/<id>/<id>-json.log`)
- Docker daemon: `/var/log/docker.log` or `journalctl -u docker`

**Applications:**
- Project `./logs/` directory
- Framework defaults (see reference files for exhaustive list)
- `/tmp/*.log` for transient application logs

---

## Docker Log Analysis

Docker captures everything a container writes to stdout and stderr. This is your primary source in containerized environments.

**Essential commands:**

```bash
# Overview: what's running, what's dead
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"

# Recent logs with timestamps
docker logs --tail 200 --timestamps <container>

# Time-windowed logs
docker logs --since "30m" <container>

# All Compose services, interleaved chronologically
docker compose logs --tail 100 --timestamps

# Container health and exit info
docker inspect --format '{{json .State}}' <container> | python3 -m json.tool
```

**Exit code interpretation:**
- `0` — Clean exit
- `1` — Generic application error
- `2` — Misuse of shell command
- `126` — Cannot execute (permission denied on entrypoint)
- `127` — Command not found (bad entrypoint/CMD)
- `137` — SIGKILL (OOM killer or forced kill)
- `143` — SIGTERM (graceful shutdown timeout)
- `255` — Exit status out of range

---

## Log Format Parsing

**JSON logs** (common with structured logging frameworks):
```bash
# Parse JSON logs with jq
docker logs <container> 2>&1 | python3 -c "
import sys, json
for line in sys.stdin:
    try:
        obj = json.loads(line)
        level = obj.get('level', obj.get('levelname', '?'))
        msg = obj.get('message', obj.get('msg', line.strip()))
        print(f'{level}: {msg}')
    except json.JSONDecodeError:
        print(line.strip())
"
```

**Python tracebacks** — Multi-line. Look for `Traceback (most recent call last):` as the start marker. The actual error is the **last line** of the traceback block.

**Stack traces** (Java, Go, Node) — Look for `at `, `goroutine`, or `Error:` as anchors. The top frame is where the error was thrown; the bottom frame is the entry point.

---

## Error Pattern Recognition

**Connection errors:**
- `ECONNREFUSED` / `Connection refused` — Target service isn't running or isn't listening on expected port
- `ETIMEDOUT` / `Connection timed out` — Network unreachable or firewall blocking
- `ENOTFOUND` / `Name resolution failed` — DNS failure, usually wrong hostname in config

**Resource exhaustion:**
- `OOMKilled` / `Killed` / exit code 137 — Container exceeded memory limit
- `No space left on device` — Disk full (check `df -h`, Docker image/volume storage)
- `Too many open files` — File descriptor limit hit

**Permission errors:**
- `EACCES` / `Permission denied` — File/directory ownership mismatch
- `EPERM` / `Operation not permitted` — Capability or security context restriction
- Docker socket permission — User not in `docker` group

**Application errors:**
- `Unhandled promise rejection` / `UnhandledPromiseRejection` — Node.js async error
- `Traceback (most recent call last)` — Python unhandled exception
- `panic:` — Go runtime panic

---

## Ambiguity Policy

When the user's request is ambiguous, apply these defaults:

| Ambiguity | Default |
|---|---|
| **Scope not specified** | Check ALL available sources (Docker first, then files, then system) |
| **Timeframe not specified** | Last 1 hour |
| **Severity not specified** | Report ERROR and CRITICAL first, then WARNING if relevant |
| **Service not specified** | Scan all running containers and accessible log files |
| **"It's not working"** | Broad scan for any error-level entries in the last hour |

---

## Reference Files

| File | Contents |
|---|---|
| [Log Locations](references/log-locations.md) | Exhaustive reference of log file paths organized by system, Docker, Python, Node.js, databases, and web servers |
| [Error Patterns](references/error-patterns.md) | Error pattern catalog with symptoms, diagnosis commands, and resolutions for connection, resource, permission, application, and Docker-specific errors |
