---
title: Port Forwarding
description: How to access ports from inside the CodeForge container — VS Code auto-detect, devcontainer-bridge, and SSH tunneling.
sidebar:
  order: 5
---

CodeForge runs inside a Docker container. When a service inside the container listens on a port (e.g., a dev server on port 3000 or the Claude Dashboard on port 7847), you need a forwarding mechanism to access it from your host machine. Which mechanism to use depends on your DevContainer client.

## Mechanisms

| Mechanism | Client | Discovery | Setup Required |
|-----------|--------|-----------|----------------|
| VS Code auto-detect | VS Code only | Dynamic — all ports | None |
| devcontainer-bridge (`dbr`) | Any terminal client | Dynamic — polls `/proc/net/tcp` | Host daemon required |
| SSH tunneling | Any SSH client | Manual | Per-port command |

## VS Code Auto-Detect

VS Code automatically detects ports opened inside the container and forwards them to your host. CodeForge configures this in `devcontainer.json`:

- **All ports** are auto-forwarded with a notification prompt
- **Port 7847** (Claude Dashboard) gets a friendly label in the Ports panel

No setup required — ports appear in the VS Code **Ports** panel as services start. Click the local address to open in your browser.

:::note
This only works inside VS Code and GitHub Codespaces. The `devcontainer` CLI, JetBrains Gateway, and DevPod ignore `portsAttributes` in `devcontainer.json`.
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

## SSH Tunneling

For one-off port forwarding or environments where `dbr` isn't available, use SSH tunneling directly:

```bash
# Forward a single port
ssh -L 3000:localhost:3000 <container-user>@<container-host>

# Forward multiple ports
ssh -L 3000:localhost:3000 -L 7847:localhost:7847 <container-user>@<container-host>
```

This requires SSH access to the container, which is available when connecting via the `devcontainer` CLI or any Docker SSH setup.

## Which Should I Use?

| If you use... | Recommended mechanism |
|---------------|----------------------|
| VS Code | Auto-detect (built-in, zero config) |
| DevContainer CLI | `dbr` (dynamic, automatic) |
| JetBrains Gateway | Gateway's built-in forwarding, or `dbr` as fallback |
| Codespaces | Auto-detect (built-in to Codespaces) |
| DevPod | DevPod's built-in SSH tunneling, or `dbr` |
| Direct SSH | SSH tunneling for specific ports, or `dbr` for all ports |

## Configuration

Port forwarding behavior is configured in `.devcontainer/devcontainer.json`:

```jsonc
"forwardPorts": [],
"portsAttributes": {
    "7847": {
        "label": "Claude Dashboard",
        "onAutoForward": "notify"
    },
    "*": {
        "onAutoForward": "notify"
    }
}
```

- `forwardPorts` — static port list (empty by default; VS Code auto-detects dynamically instead)
- `portsAttributes` — labels and behavior for auto-detected ports (VS Code / Codespaces only)

These settings are ignored by non-VS Code clients. Use `dbr` or SSH tunneling instead.
