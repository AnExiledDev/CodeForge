---
name: agent-browser
description: >-
  Guides headless browser automation using the agent-browser CLI for web interaction,
  accessibility tree navigation, form filling, screenshots, and authenticated sessions.
  USE WHEN the user asks to "open a webpage", "navigate a site", "take a screenshot",
  "fill a form", "get page content", "interact with a website", "scrape a page",
  "automate browser", "accessibility tree", or works with agent-browser, Playwright,
  headless Chrome, CDP. DO NOT USE for static HTML parsing, curl/wget requests,
  or API-only interactions where WebFetch suffices.
version: 0.1.0
allowed-tools: Bash
argument-hint: "[url or action]"
effort: high
---

# Headless Browser Automation

## Mental Model

`agent-browser` is a **stateful CLI** — you `open` a page, interact with it through a series of commands, and `close` when done. There is one active browser session at a time.

The accessibility tree (`snapshot`) is the primary way to "see" the page. It returns a structured tree of every element on the page, each tagged with a reference ID (`@e1`, `@e2`, etc.). You use these references to target elements for clicks, form fills, and selections. Think of it as a DOM you can address by stable short IDs rather than CSS selectors.

The core loop is: **open → snapshot → interact → snapshot → close**. Always snapshot before interacting so you know what elements are available. Always snapshot after interacting to verify the result.

---

## Core Workflow

Every browser task follows this pattern:

```bash
# 1. Open a page
agent-browser open https://example.com

# 2. Snapshot to see the page structure
agent-browser snapshot

# 3. Interact using element references from the snapshot
agent-browser click @e2
agent-browser fill @e3 "search query"

# 4. Snapshot again to see the result
agent-browser snapshot

# 5. Close when done
agent-browser close
```

---

## Commands Overview

| Command | Purpose | Example |
|---------|---------|---------|
| `open <url>` | Navigate to a URL and start a session | `agent-browser open https://example.com` |
| `snapshot` | Get the accessibility tree with element references | `agent-browser snapshot` |
| `screenshot <path>` | Capture a PNG screenshot of the current page | `agent-browser screenshot page.png` |
| `click @eN` | Click an element by its reference ID | `agent-browser click @e2` |
| `fill @eN "text"` | Type text into an input element | `agent-browser fill @e3 "hello"` |
| `select @eN "value"` | Select an option from a dropdown | `agent-browser select @e5 "option1"` |
| `cookie set "..."` | Set a cookie for authenticated sessions | `agent-browser cookie set "session=abc123; domain=.example.com"` |
| `connect <port>` | Connect to host Chrome via CDP | `agent-browser connect 9222` |
| `close` | End the browser session | `agent-browser close` |

> **Full details:** See `references/cli-reference.md` for complete command syntax, output formats, and all options.

---

## Element References

When you run `agent-browser snapshot`, the output is an accessibility tree where each interactive element is tagged with a reference like `@e1`, `@e2`, etc.:

```
document "Example Page"
  heading "Welcome" @e1
  textbox "Search" @e2
  button "Submit" @e3
  link "About Us" @e4
```

Use these references in subsequent commands:

- `agent-browser click @e3` — clicks the "Submit" button
- `agent-browser fill @e2 "my query"` — types into the "Search" textbox
- References are stable within a single page state. After navigation or significant DOM changes, run `snapshot` again to get updated references.

---

## Authentication Patterns

For pages requiring authentication, inject cookies before opening the page:

```bash
# Set session cookie first
agent-browser cookie set "session=abc123; domain=.example.com"

# Then open the authenticated page
agent-browser open https://example.com/dashboard

# Proceed normally
agent-browser snapshot
```

This avoids needing to fill login forms when you already have valid session credentials.

---

## Containerized Usage

### Headless Mode (Default)

Uses bundled Chromium in the container — no display needed. Works out of the box:

```bash
agent-browser open https://example.com
agent-browser snapshot
agent-browser close
```

### Host Chrome Connection

Connect to Chrome running on your host machine via CDP (Chrome DevTools Protocol). Useful when the container's bundled Chromium is insufficient (e.g., specific browser extensions needed):

1. Start Chrome on host with remote debugging:
   ```bash
   chrome --remote-debugging-port=9222
   ```

2. Connect from container:
   ```bash
   agent-browser connect 9222
   ```

---

## Ambiguity Policy

These defaults apply when the user does not specify a preference. State the assumption when applying a default:

- **Mode:** Always use headless mode (bundled Chromium) unless the user explicitly requests host Chrome connection
- **Snapshot first:** Always run `snapshot` before interacting with elements — never guess element references
- **Snapshot after:** Always run `snapshot` after interactions to verify results
- **Close when done:** Always `close` the browser session when the task is complete
- **Screenshots:** Save to the current working directory unless the user specifies a path
- **Cookie scope:** Set cookies before `open` so they apply to the initial page load

---

## Reference Files

| File | Contents |
|------|----------|
| [CLI Reference](references/cli-reference.md) | Complete command syntax, all flags and options, output format descriptions, connection modes, error handling |
| [Workflow Patterns](references/workflow-patterns.md) | Common automation patterns: page inspection, form filling, multi-page navigation, authenticated sessions, screenshots, error recovery |
