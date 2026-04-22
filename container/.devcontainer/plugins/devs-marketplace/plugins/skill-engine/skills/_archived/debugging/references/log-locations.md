# Log Locations Reference

Comprehensive reference of log file locations organized by system, runtime, and application framework.

---

## Linux System Logs

### Syslog

The traditional Unix system log. Most distributions write to one of:

| Distribution | Path | Format |
|---|---|---|
| Debian / Ubuntu | `/var/log/syslog` | BSD syslog |
| RHEL / CentOS / Fedora | `/var/log/messages` | BSD syslog |
| Alpine | `/var/log/messages` | BSD syslog |

Syslog captures messages from system services, cron, mail, and applications that use the syslog facility. Each line follows the format:

```
<timestamp> <hostname> <program>[<pid>]: <message>
```

**Useful filters:**
```bash
# Recent errors
grep -i "error\|fail\|crit" /var/log/syslog | tail -50

# Specific service
grep "nginx" /var/log/syslog | tail -20
```

### Systemd Journal (journald)

Modern Linux distributions use systemd's binary journal as the primary log store. The journal captures structured metadata (unit name, priority, PID, UID) alongside the message.

**Key commands:**

```bash
# All logs from the last hour
journalctl --no-pager -n 200 --since "1 hour ago"

# Specific systemd unit
journalctl --no-pager -n 100 -u nginx.service --since "1 hour ago"

# Kernel messages only (OOM killer, hardware, drivers)
journalctl --no-pager -n 100 -k --since "1 hour ago"

# Priority filtering (0=emerg through 7=debug)
journalctl --no-pager -p err --since "1 hour ago"

# Follow mode (like tail -f)
journalctl -f -u myservice.service

# Output as JSON for structured parsing
journalctl --no-pager -o json -n 50 -u myservice.service

# Disk usage of journal
journalctl --disk-usage
```

### Kernel Log

Kernel messages are critical for diagnosing:
- **OOM killer** events (`Out of memory: Killed process`)
- **Segmentation faults** (`segfault at`)
- **Hardware errors** (`I/O error`, `EXT4-fs error`)
- **Network stack** issues (`nf_conntrack: table full`)

```bash
# Kernel ring buffer (dmesg)
dmesg --time-format iso | tail -50

# Via journal
journalctl -k --no-pager -n 50 --since "1 hour ago"

# File-based (if available)
# /var/log/kern.log (Debian/Ubuntu)
```

### Authentication Log

Records login attempts, sudo usage, SSH sessions, and PAM events.

| Distribution | Path |
|---|---|
| Debian / Ubuntu | `/var/log/auth.log` |
| RHEL / CentOS / Fedora | `/var/log/secure` |

```bash
# Failed login attempts
grep "Failed password\|authentication failure" /var/log/auth.log | tail -20

# Sudo commands
grep "sudo:" /var/log/auth.log | tail -20
```

### Other System Logs

| Log | Path | Contents |
|---|---|---|
| Boot log | `/var/log/boot.log` | Service startup messages |
| Cron log | `/var/log/cron` or in syslog | Scheduled task execution |
| Package manager | `/var/log/dpkg.log` (Debian) or `/var/log/yum.log` (RHEL) | Package install/remove |
| Filesystem | `/var/log/fsck/` | Filesystem check results |

---

## Docker

### Container Logs

Docker captures stdout and stderr from the container's PID 1 process. This is the primary log source for containerized applications.

**Storage location** (default json-file driver):
```
/var/lib/docker/containers/<container-id>/<container-id>-json.log
```

**Access methods:**

```bash
# By container name or ID
docker logs <container>

# With timestamps
docker logs --timestamps <container>

# Tail last N lines
docker logs --tail 100 <container>

# Time window
docker logs --since "2025-01-15T10:00:00" --until "2025-01-15T11:00:00" <container>

# Follow (real-time)
docker logs -f <container>

# Separate stdout and stderr
docker logs <container> 2>/dev/null    # stdout only
docker logs <container> 1>/dev/null    # stderr only
```

### Log Drivers

Docker supports pluggable log drivers. The default is `json-file`, but others redirect logs elsewhere:

| Driver | Destination | `docker logs` Works? |
|---|---|---|
| `json-file` (default) | Local JSON files | Yes |
| `local` | Optimized local storage | Yes |
| `journald` | systemd journal | Yes |
| `syslog` | Syslog daemon | No |
| `fluentd` | Fluentd collector | No |
| `awslogs` | CloudWatch | No |
| `none` | Discarded | No |

Check which driver a container uses:
```bash
docker inspect --format '{{.HostConfig.LogConfig.Type}}' <container>
```

If `docker logs` returns nothing, the log driver may not support it. Check the driver and look for logs at the configured destination.

### Docker Daemon Logs

The Docker daemon itself logs operational events:

| System | Location |
|---|---|
| systemd-based | `journalctl -u docker.service` |
| Non-systemd | `/var/log/docker.log` |
| macOS (Docker Desktop) | `~/Library/Containers/com.docker.docker/Data/log/` |

### Docker Compose Aggregation

```bash
# All services
docker compose logs --tail 100

# Specific service
docker compose logs --tail 100 <service_name>

# With timestamps for cross-service correlation
docker compose logs --timestamps --tail 200

# Follow all services
docker compose logs -f

# Service status overview
docker compose ps -a
```

### Docker Events

System-level events (container create/start/stop/die, image pull, network connect):

```bash
# Recent events
docker events --since "1h" --until "now"

# Filtered by type
docker events --filter 'type=container' --filter 'event=die' --since "1h"

# Formatted output
docker events --since "1h" --format '{{.Time}} {{.Type}} {{.Action}} {{.Actor.Attributes.name}}'
```

### Docker Health Checks

```bash
# Health status
docker inspect --format '{{.State.Health.Status}}' <container>

# Health check log (last 5 results)
docker inspect --format '{{json .State.Health}}' <container> | python3 -m json.tool
```

---

## Python Frameworks

### FastAPI / Uvicorn

Uvicorn writes to stderr by default. Log level is controlled by `--log-level` flag or `UVICORN_LOG_LEVEL` env var.

| Source | Location |
|---|---|
| Uvicorn access log | stderr (or `--access-log` file) |
| Uvicorn error log | stderr |
| Application logger | Depends on `logging` config; defaults to stderr |
| In Docker | `docker logs <container>` |

**Uvicorn log format:**
```
INFO:     <client_ip>:<port> - "<method> <path> HTTP/1.1" <status_code>
```

**Common configuration patterns:**
```python
# logging.conf or logging.yaml referenced by app
# Check for: logging.config.dictConfig(), logging.config.fileConfig()
# Environment variables: LOG_LEVEL, UVICORN_LOG_LEVEL
```

### Django

| Source | Default Location |
|---|---|
| Django server log | stderr (runserver) |
| Application logs | Configured in `settings.LOGGING` |
| Debug log | Often `./debug.log` when `DEBUG=True` |

Check `settings.py` for `LOGGING` dict — it defines handlers, formatters, and file paths.

### Flask

| Source | Default Location |
|---|---|
| Flask dev server | stderr |
| Application logger | `app.logger` → stderr by default |
| Gunicorn | `--error-logfile`, `--access-logfile` flags |

### Gunicorn

```bash
# Default: stderr
# Common flag overrides:
# --error-logfile /var/log/gunicorn/error.log
# --access-logfile /var/log/gunicorn/access.log
# --log-level info
```

Gunicorn prefork model means each worker process logs independently. Worker crashes appear in the error log as:
```
[CRITICAL] WORKER TIMEOUT (pid:1234)
```

---

## Node.js

### Express / Generic Node

Node.js applications typically log to stdout/stderr. No default file logging.

| Source | Location |
|---|---|
| `console.log` / `console.error` | stdout / stderr |
| Winston | Configured in app (`transports` define file paths) |
| Bunyan | Configured in app (commonly `./logs/`) |
| Pino | stdout (designed for pipe-based logging) |

**Common file locations when file transport is configured:**
- `./logs/combined.log`
- `./logs/error.log`
- `./logs/app.log`
- `/var/log/<app-name>/`

### PM2

PM2 manages Node processes and captures their output:

```bash
# Log file locations
~/.pm2/logs/<app-name>-out.log    # stdout
~/.pm2/logs/<app-name>-error.log  # stderr

# View logs
pm2 logs                          # all apps, follow mode
pm2 logs <app-name> --lines 100   # specific app

# Flush logs
pm2 flush
```

---

## Databases

### PostgreSQL

| Distribution | Default Log Location |
|---|---|
| Debian / Ubuntu (apt) | `/var/log/postgresql/postgresql-<version>-main.log` |
| RHEL (yum/dnf) | `/var/lib/pgsql/<version>/data/log/` |
| Docker (official image) | stderr → `docker logs` |
| Custom | Check `log_directory` in `postgresql.conf` |

```bash
# Find log config
psql -c "SHOW log_directory; SHOW log_filename; SHOW logging_collector;"

# Check for slow queries if log_min_duration_statement is set
psql -c "SHOW log_min_duration_statement;"
```

**Key log entries:**
- `FATAL:` — Connection failures, authentication errors, startup failures
- `ERROR:` — Query errors, constraint violations
- `LOG:  checkpoint` — Checkpoint activity (performance indicator)
- `LOG:  connection` — Connection open/close events

### MySQL / MariaDB

| Log Type | Default Path | Config Variable |
|---|---|---|
| Error log | `/var/log/mysql/error.log` | `log_error` |
| General query log | Off by default | `general_log_file` |
| Slow query log | Off by default | `slow_query_log_file` |
| Binary log | `/var/lib/mysql/binlog.*` | `log_bin` |

```bash
# Check what's enabled
mysql -e "SHOW VARIABLES LIKE '%log%';"

# Docker
docker logs <mysql-container>
```

### Redis

| Installation | Log Location |
|---|---|
| Package manager | `/var/log/redis/redis-server.log` |
| Docker (official) | stderr → `docker logs` |
| Custom | Check `logfile` directive in `redis.conf` |

```bash
# Check config
redis-cli CONFIG GET logfile
redis-cli CONFIG GET loglevel

# In Docker
docker logs <redis-container>
```

Key log patterns:
- `# WARNING overcommit_memory` — Memory configuration warning
- `* Ready to accept connections` — Successful startup
- `# oO0OoO0OoO0Oo Redis is starting` — Boot sequence

---

## Web Servers

### Nginx

| Log Type | Default Path |
|---|---|
| Access log | `/var/log/nginx/access.log` |
| Error log | `/var/log/nginx/error.log` |
| Docker | stdout (access) / stderr (error) → `docker logs` |

```bash
# Check configured paths
nginx -T 2>/dev/null | grep -E "access_log|error_log"

# Error levels (in order): debug, info, notice, warn, error, crit, alert, emerg
# Default error_log level: error
```

**Common error log patterns:**
- `connect() failed (111: Connection refused)` — Upstream/proxy target is down
- `no live upstreams` — All backends in upstream block are unhealthy
- `client intended to send too large body` — `client_max_body_size` exceeded

### Apache (httpd)

| Log Type | Default Path |
|---|---|
| Access log | `/var/log/apache2/access.log` (Debian) or `/var/log/httpd/access_log` (RHEL) |
| Error log | `/var/log/apache2/error.log` (Debian) or `/var/log/httpd/error_log` (RHEL) |
| Docker | Varies by image configuration |

```bash
# Check configured paths
apachectl -S 2>/dev/null | grep -i log
grep -r "ErrorLog\|CustomLog" /etc/apache2/ /etc/httpd/ 2>/dev/null
```

### Caddy

| Installation | Log Location |
|---|---|
| Package | `journalctl -u caddy` |
| Docker | stderr → `docker logs` |
| File | Configured in Caddyfile with `log` directive |

Caddy uses structured JSON logging by default (v2). Access logs require explicit `log` directive in the Caddyfile.
