# agent-browser

Headless browser automation CLI for AI agents from [Vercel Labs](https://github.com/vercel-labs/agent-browser).

## Features

- Accessibility tree snapshots for AI navigation
- Screenshots and PDF capture
- Element interaction (click, fill, select)
- Cookie and localStorage management
- Network interception

## Usage

```bash
# Basic workflow
agent-browser open https://example.com
agent-browser snapshot          # Get accessibility tree
agent-browser click @e2         # Click element by reference
agent-browser fill @e3 "text"   # Fill input
agent-browser screenshot page.png
agent-browser close

# Cookie management (for authenticated sessions)
agent-browser cookie set "session=abc123; domain=.example.com"
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `version` | `latest` | npm package version |
| `username` | `automatic` | Container user |

## WSL/Devcontainer Usage

Two modes work in containerized environments:

### Headless Mode (Default)

Uses bundled Chromium in the container—no display needed. Works out of the box:

```bash
agent-browser open https://example.com
agent-browser snapshot
agent-browser close
```

### Host Chrome Connection

Connect to Chrome running on your host machine via CDP (Chrome DevTools Protocol). Useful when the container's bundled Chromium is insufficient (e.g., specific browser extensions or logged-in sessions needed).

**Chrome 144+** (recommended): No CLI launch needed. Enable remote debugging via a checkbox:
1. Open `chrome://inspect/#remote-debugging` in Chrome
2. Check "Enable remote debugging" — Chrome listens on port 9222 by default

**Chrome 136–143**: Chrome 136+ requires `--user-data-dir` alongside `--remote-debugging-port` or the flag is silently ignored:

```bash
# Linux / macOS
google-chrome --remote-debugging-port=9222 --user-data-dir="/tmp/chrome-debug"

# Windows PowerShell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:TEMP\chrome-debug"
```

Connect from the container using `host.docker.internal` — not `localhost`, which refers to the container itself:

```bash
agent-browser connect host.docker.internal:9222
```

> **Security note:** CDP exposes the full browser session (cookies, storage, DOM) to anything that can reach the debug port. Use with caution on shared or networked machines.
