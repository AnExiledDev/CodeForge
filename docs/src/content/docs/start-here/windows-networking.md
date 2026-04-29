---
title: "Windows Networking"
description: "Set up WSL 2 mirrored networking for seamless port forwarding and host Chrome CDP access in CodeForge on Windows."
sidebar:
  order: 2
---

Windows users running CodeForge in Docker Desktop on WSL 2 face a networking asymmetry: the container can reach the internet, but reaching back to the host (or exposing container ports on `localhost`) requires extra steps. **Mirrored networking** eliminates this gap.

## Why Mirrored Networking

By default, WSL 2 uses NAT networking. This means:

| Scenario | Default (NAT) | Mirrored |
|----------|---------------|----------|
| Container → internet | Works | Works |
| Host → container port | Requires port forwarding (`dbr`, SSH tunnel, or `netsh portproxy`) | Works via `localhost` |
| Container → host service | Requires `host.docker.internal` | Works via `localhost` *and* `host.docker.internal` |
| LAN device → container port | Requires manual `netsh portproxy` rules | Works automatically |

Mirrored mode makes WSL 2 networking behave like the host — `localhost` is shared, ports are visible both ways, and LAN access just works.

:::tip[Recommended for all Windows CodeForge users]
Mirrored networking is the simplest path to working port forwarding on Windows. It replaces the need for `dbr` (which does not support Windows) and eliminates manual SSH tunneling for most use cases.
:::

## How to Enable

### 1. Create or edit `.wslconfig`

Open PowerShell and edit the WSL configuration file:

```powershell
notepad "$env:USERPROFILE\.wslconfig"
```

Add or merge these settings:

```ini
[wsl2]
networkingMode=mirrored

[experimental]
autoMemoryReclaim=gradual
```

:::caution[Existing .wslconfig settings]
If you already have a `.wslconfig` file, merge these lines into your existing `[wsl2]` section. Don't create duplicate section headers.
:::

### 2. Restart WSL

```powershell
wsl --shutdown
```

Wait a few seconds, then start your WSL distribution or Docker Desktop again.

### 3. Verify

From inside WSL or a container:

```bash
# Should show "mirrored"
wslinfo --networking-mode 2>/dev/null || echo "wslinfo not available — check from PowerShell instead"
```

From PowerShell:

```powershell
wsl --status
# Look for "Networking mode: Mirrored" in the output
```

## Docker Desktop Compatibility

Docker Desktop **4.26.0+** supports mirrored networking mode. If you're on an older version, update Docker Desktop first.

:::caution[Known issue: TCP stalls on Docker gateway]
Some Docker Desktop versions exhibit TCP connection stalls when communicating through the Docker gateway IP in mirrored mode. If you experience hanging connections, ensure Docker Desktop is updated to the latest stable release. This does not affect `host.docker.internal` or `localhost` connections.
:::

## Chrome Remote Debugging Setup

Mirrored networking makes host Chrome CDP (Chrome DevTools Protocol) connections straightforward. After enabling mirrored mode, `host.docker.internal` reliably resolves to your Windows host.

### Recommended Windows Setup

Run the helper from an Administrator PowerShell on the Windows host:

```powershell
.\.devcontainer\scripts\start-hermes-chrome.ps1
```

The helper keeps Chrome CDP local-only on Windows and exposes a separate Docker-facing proxy:

```text
Chrome CDP:            127.0.0.1:9222
Windows portproxy:     0.0.0.0:9223 -> 127.0.0.1:9222
Container endpoint:    resolved host.docker.internal IPv4, port 9223
```

Cleanup removes the portproxy and firewall rule:

```powershell
.\.devcontainer\scripts\start-hermes-chrome.ps1 -Cleanup
```

:::caution[Chrome 136+ requires --user-data-dir]
Chrome 136 and later silently ignores `--remote-debugging-port` unless `--user-data-dir` is also specified. The helper always launches Chrome with a non-default profile directory.
:::

### Connect from the Container

```bash
CDP_HOST=$(getent ahostsv4 host.docker.internal | awk 'NR==1 {print $1}')
curl http://$CDP_HOST:9223/json/version
agent-browser connect $CDP_HOST:9223
```

Chrome CDP rejects requests whose HTTP `Host` header is a DNS name such as `host.docker.internal`. Resolve `host.docker.internal` to IPv4 first, then connect with the IP address.

See the [agent-browser CLI reference](/reference/cli-tools/#agent-browser) for the full workflow.

## Known Issues

### VPN Conflicts

Mirrored networking can conflict with VPN clients, particularly:

- **Cisco AnyConnect** — may break WSL 2 networking entirely when mirrored mode is active
- **OpenVPN / WireGuard** — generally work, but some configurations route WSL traffic incorrectly

**Workaround:** If your VPN breaks networking, temporarily switch back to NAT mode:

```ini
[wsl2]
networkingMode=NAT
```

Then run `wsl --shutdown` and reconnect. Switch back to mirrored when disconnected from VPN.

### Windows Update Regressions

Microsoft occasionally ships Windows updates that break mirrored networking. If networking stops working after an update:

1. Check [WSL GitHub Issues](https://github.com/microsoft/WSL/issues) for known regressions
2. Revert to NAT mode as a temporary workaround
3. The fix usually arrives in the next cumulative update

### How to Revert

To switch back to NAT mode, edit `.wslconfig`:

```ini
[wsl2]
networkingMode=NAT
```

Then restart WSL:

```powershell
wsl --shutdown
```

## Verification Checklist

After enabling mirrored networking, confirm these work:

| Check | Command (from inside container) | Expected |
|-------|-------------------------------|----------|
| Host Chrome CDP reachable | `CDP_HOST=$(getent ahostsv4 host.docker.internal \| awk 'NR==1 {print $1}') && curl -s http://$CDP_HOST:9223/json/version` | JSON response after running `.devcontainer\scripts\start-hermes-chrome.ps1` |
| Internet works | `curl -s https://httpbin.org/ip` | Your public IP |
| Port visible on host | Start `python -m http.server 8080` in container, then `curl localhost:8080` from PowerShell | HTML response |

## Related

- [Before You Install](/start-here/before-you-install/) — prerequisites including WSL 2
- [Accessing Services](/use/accessing-services/) — all port forwarding mechanisms compared
- [Troubleshooting](/reference/troubleshooting/) — mirrored networking and CDP troubleshooting
