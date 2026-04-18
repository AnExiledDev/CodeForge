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

### Chrome 144+ (Recommended)

No command-line launch needed:

1. Open `chrome://inspect/#remote-debugging` in Chrome
2. Check **"Enable remote debugging"**
3. Chrome listens on port 9222 by default

### Chrome 136–143

Launch Chrome with explicit flags from PowerShell:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:TEMP\chrome-debug"
```

:::caution[Chrome 136+ requires --user-data-dir]
Chrome 136 and later silently ignores `--remote-debugging-port` unless `--user-data-dir` is also specified. Always include both flags.
:::

### Connect from the Container

```bash
agent-browser connect host.docker.internal:9222
```

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
| Host reachable | `curl -s http://host.docker.internal:9222/json/version` | JSON response (if Chrome debugging is active) |
| Internet works | `curl -s https://httpbin.org/ip` | Your public IP |
| Port visible on host | Start `python -m http.server 8080` in container, then `curl localhost:8080` from PowerShell | HTML response |

## Related

- [Before You Install](/start-here/before-you-install/) — prerequisites including WSL 2
- [Accessing Services](/use/accessing-services/) — all port forwarding mechanisms compared
- [Troubleshooting](/reference/troubleshooting/) — mirrored networking and CDP troubleshooting
