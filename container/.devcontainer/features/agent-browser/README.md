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

Connect to Chrome running on your host machine via CDP (Chrome DevTools Protocol):

1. Start Chrome on host with remote debugging:
   ```bash
   chrome --remote-debugging-port=9222
   # or on macOS:
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
   ```

2. Connect from container:
   ```bash
   agent-browser connect 9222
   ```

This is useful when the container's bundled Chromium is insufficient (e.g., specific browser extensions needed).
