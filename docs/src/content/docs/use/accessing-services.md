---
title: Accessing Services
description: How to reach previews and forwarded ports from a CodeForge container across different clients.
sidebar:
  order: 10
---

CodeForge runs inside a Docker container. When a service inside the container listens on a port (e.g., a dev server on port 4321), you need a forwarding mechanism to access it from your host machine. Which mechanism to use depends on your DevContainer client.

:::tip[When to read this page]
If you use VS Code, you usually only need this page when automatic forwarding is not enough. If you use the DevContainer CLI, JetBrains, or direct SSH, this page matters much earlier.
:::

## Mechanisms

| Mechanism | Client | Discovery | Setup Required |
|-----------|--------|-----------|----------------|
| Docker Compose port mapping | Any client | Static — configured ports | None (built-in) |
| VS Code auto-detect | VS Code only | Dynamic — output-based | None |
| devcontainer-bridge (`dbr`) | Any terminal client | Dynamic — polls `/proc/net/tcp` | Host daemon required |
| SSH tunneling | Any SSH client | Manual | Per-port command |

### Docker Compose Port Mapping (Primary)

CodeForge maps all known service ports in `docker-compose.yml`, bound to `127.0.0.1`. This is the primary forwarding mechanism — it works with every client, requires no setup, and is independent of VS Code.

| Port | Service | Lifecycle |
|------|---------|-----------|
| 7847 | Claude Code Karma Dashboard | Auto-started |
| 7848 | Claude Code Karma API | Auto-started |
| 37777 | Claude-Mem Worker | Auto-started |
| 4321 | Astro docs dev server | On-demand (`npm run dev` in `docs/`) |
| 8081 | mitmproxy | On-demand (`codeforge proxy`) |
| 9119 | ccdiag API Proxy | On-demand (`ccdiag proxy`) |

With **WSL mirrored networking**, these ports are accessible on `localhost` from Windows with no additional configuration. On macOS/Linux, Docker Desktop forwards them to `localhost` natively.

:::note
On-demand ports (4321, 8081, 9119) are mapped at container startup but only become accessible when the corresponding service is running. Connections are refused until the service starts.
:::

## Windows: Mirrored Networking (Recommended)

If you're on Windows with WSL 2, **mirrored networking** is the recommended approach. It makes `localhost` work bidirectionally between your host and the container — no forwarding tools needed.

Once enabled, container ports are accessible on `localhost` from Windows, and host services (like Chrome remote debugging) are reachable from inside the container via `host.docker.internal`.

This replaces the need for `dbr` (which does not support Windows) and eliminates manual SSH tunneling for most use cases.

→ **[Set up mirrored networking](/start-here/windows-networking/)**

## VS Code Auto-Detect

VS Code provides supplementary port detection on top of the Docker Compose mappings. CodeForge uses `output` mode (`remote.autoForwardPortsSource`), which detects ports printed to VS Code terminals.

:::caution[VS Code forwarding is supplementary, not primary]
Docker Compose port mappings handle all known service ports reliably. VS Code auto-detect is a bonus for dynamically-allocated ports (e.g., OAuth callbacks, ephemeral dev servers). Do not rely on it as your only forwarding mechanism — it only works while VS Code is actively connected and has known reliability issues when backgrounded.
:::

:::note[Why not `hybrid` mode?]
VS Code's `hybrid` port detection mode has [known reliability issues](https://github.com/microsoft/vscode/issues/200795) — it silently stops working after detecting 20+ ports, which is common in feature-rich devcontainers. The `output` mode is less aggressive but more reliable. Docker Compose port mappings compensate for the reduced detection scope.
:::

:::note
`portsAttributes` labels only work inside VS Code and GitHub Codespaces. The `devcontainer` CLI, JetBrains Gateway, and DevPod ignore them — but Docker Compose port mappings work with all clients.
:::

## devcontainer-bridge (`dbr`)

[devcontainer-bridge](https://github.com/bradleybeddoes/devcontainer-bridge) provides dynamic port forwarding for any terminal-based workflow. It works with the DevContainer CLI, SSH connections, or any other way you access the container.

### How It Works

1. A lightweight daemon inside the container polls `/proc/net/tcp` to discover listening ports
2. A host-side daemon maintains SSH tunnels for each discovered port
3. Ports are forwarded automatically as services start and stop — no manual configuration

The container daemon **auto-starts** when the container boots and is inert (zero overhead) until the host daemon connects.

### Setup

**Inside the container** — already done. CodeForge installs `dbr` as a DevContainer feature.

**On your host machine**, install and start the host daemon:

```bash
# Install dbr on your host (see https://github.com/bradleybeddoes/devcontainer-bridge/releases)
# Then start the host daemon:
dbr host-daemon
```

The host daemon discovers running containers and establishes port forwarding automatically. Leave it running in the background while you work.

### Verify

Once the host daemon is running, any port opened inside the container becomes accessible on `localhost` on your host. Test with:

```bash
# Inside the container
python -m http.server 8080

# On your host
curl http://localhost:8080
```

### Platform Support

| Platform | Host Daemon | Auto-Forward | Status |
|----------|-------------|--------------|--------|
| macOS    | Supported   | Expected to work | Not fully confirmed |
| Linux    | Supported   | Expected to work | Not fully confirmed |
| Windows  | Not yet supported | — | Use [mirrored networking](/start-here/windows-networking/) instead |

:::note
devcontainer-bridge auto-forwarding on macOS and Linux has not been fully validated across all configurations. If you encounter issues, fall back to SSH tunneling and [report the issue](https://github.com/bradleybeddoes/devcontainer-bridge/issues). Windows host daemon support is planned for a future release.
:::

## SSH Tunneling

For one-off port forwarding or environments where `dbr` isn't available, use SSH tunneling directly:

```bash
# Forward a single port
ssh -L 3000:localhost:3000 <container-user>@<container-host>

# Forward Claude Code Karma and its API
ssh -L 7847:localhost:7847 -L 7848:localhost:7848 <container-user>@<container-host>

# Forward multiple ports
ssh -L 3000:localhost:3000 -L 8080:localhost:8080 <container-user>@<container-host>
```

This requires SSH access to the container, which is available when connecting via the `devcontainer` CLI or any Docker SSH setup.

## Which Should I Use?

Docker Compose port mappings work with **all clients** — known service ports are always forwarded. The table below covers supplementary mechanisms for dynamic ports or enhanced UX.

| If you use... | Supplementary mechanism |
|---------------|------------------------|
| **Windows (any client)** | **Mirrored networking** — [zero config after setup](/start-here/windows-networking/) |
| VS Code | Auto-detect labels + notifications (built-in) |
| DevContainer CLI | `dbr` for dynamic ports — see the [CLI guide](/start-here/devcontainer-cli/) |
| JetBrains Gateway | Gateway's built-in forwarding, or `dbr` as fallback |
| Codespaces | Auto-detect (built-in to Codespaces) |
| DevPod | DevPod's built-in SSH tunneling, or `dbr` |
| Direct SSH | SSH tunneling for dynamic ports, or `dbr` for all ports |

## Browser Automation (CDP)

For browser automation using agent-browser's host Chrome connection, Windows users should run `.devcontainer\scripts\start-hermes-chrome.ps1` on the host first. The PowerShell script keeps Chrome on `127.0.0.1:9222` and exposes a Docker-facing portproxy on port 9223. From the container, resolve `host.docker.internal` to IPv4, test with `curl http://$CDP_HOST:9223/json/version`, then connect with `agent-browser connect $CDP_HOST:9223`. Chrome CDP rejects DNS Host headers, so do not connect browser tools directly to `http://host.docker.internal:9223`. See [Windows Networking](/start-here/windows-networking/) and the agent-browser feature documentation for the full CDP workflow.

## Configuration

Port forwarding is configured at two levels:

### Docker Compose (all clients)

Service ports are mapped in `.devcontainer/docker-compose.yml` under `ports:`, bound to `127.0.0.1` for security. This is the primary forwarding mechanism and works with every client.

To add a new port, add a line to the `ports:` section:

```yaml
ports:
  - "127.0.0.1:YOUR_PORT:YOUR_PORT"  # Description
```

### VS Code labels (VS Code / Codespaces only)

Port labels and notification behavior are configured via `portsAttributes` in `.devcontainer/devcontainer.json`:

```jsonc
"portsAttributes": {
    "7847": { "label": "Claude Code Karma", "onAutoForward": "notify" },
    "*": { "onAutoForward": "notify" }
}
```

These settings are ignored by non-VS Code clients. Docker Compose port mappings and `dbr` work regardless.
