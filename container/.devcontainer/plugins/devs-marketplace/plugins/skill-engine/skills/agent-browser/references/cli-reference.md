# agent-browser CLI Reference

Complete command reference for the `agent-browser` headless browser automation CLI.

---

## open

Opens a URL in the headless browser and starts a session.

```bash
agent-browser open <url>
```

**Arguments:**
- `<url>` — Full URL to navigate to (must include protocol, e.g., `https://`)

**Behavior:**
- Launches bundled Chromium in headless mode
- Navigates to the specified URL and waits for page load
- Only one session can be active at a time — close the current session before opening a new one

**Examples:**
```bash
agent-browser open https://example.com
agent-browser open https://github.com/vercel-labs/agent-browser
```

---

## snapshot

Returns the accessibility tree of the current page with element reference IDs.

```bash
agent-browser snapshot
```

**Output format:**
The accessibility tree is a hierarchical text representation of the page. Each interactive element is tagged with a reference ID (`@eN`):

```
document "Page Title"
  navigation "Main"
    link "Home" @e1
    link "About" @e2
    link "Contact" @e3
  main ""
    heading "Welcome" @e4
    paragraph "Some description text"
    textbox "Email" @e5
    textbox "Password" @e6
    button "Sign In" @e7
```

**Key details:**
- Non-interactive elements (paragraphs, divs) appear without reference IDs
- Interactive elements (links, buttons, inputs, selects) get `@eN` references
- The tree reflects the current DOM state — run again after navigation or DOM changes
- Reference IDs are assigned sequentially and are stable until the page state changes

---

## screenshot

Captures a PNG screenshot of the current page.

```bash
agent-browser screenshot <path>
```

**Arguments:**
- `<path>` — File path for the screenshot output (PNG format)

**Examples:**
```bash
agent-browser screenshot page.png
agent-browser screenshot /tmp/checkout-form.png
agent-browser screenshot ./screenshots/step-3.png
```

**Notes:**
- The directory must exist — the command does not create intermediate directories
- Screenshots capture the full visible viewport

---

## click

Clicks an element identified by its reference ID.

```bash
agent-browser click <ref>
```

**Arguments:**
- `<ref>` — Element reference from a previous `snapshot` (e.g., `@e2`)

**Examples:**
```bash
agent-browser click @e3          # Click a button
agent-browser click @e1          # Click a link (triggers navigation)
```

**Notes:**
- If clicking a link causes navigation, run `snapshot` afterward to get the new page's element references
- The element must be visible and interactive

---

## fill

Types text into an input element.

```bash
agent-browser fill <ref> "<text>"
```

**Arguments:**
- `<ref>` — Element reference for a text input, textarea, or contenteditable element
- `<text>` — The text to type into the element

**Examples:**
```bash
agent-browser fill @e5 "user@example.com"
agent-browser fill @e6 "my-password"
agent-browser fill @e2 "search query"
```

**Notes:**
- Clears any existing content in the field before typing
- Quote the text argument if it contains spaces

---

## select

Selects an option from a dropdown/select element.

```bash
agent-browser select <ref> "<value>"
```

**Arguments:**
- `<ref>` — Element reference for a `<select>` element
- `<value>` — The value or visible text of the option to select

**Examples:**
```bash
agent-browser select @e5 "United States"
agent-browser select @e8 "option2"
```

---

## cookie

Manages cookies for the browser session.

```bash
agent-browser cookie set "<cookie-string>"
```

**Subcommands:**
- `set` — Sets a cookie using standard cookie string format

**Cookie string format:**
```
"name=value; domain=.example.com"
```

**Examples:**
```bash
agent-browser cookie set "session=abc123; domain=.example.com"
agent-browser cookie set "auth_token=xyz789; domain=.app.example.com; path=/; secure"
```

**Notes:**
- Set cookies before `open` to ensure they apply to the initial page load
- The `domain` attribute determines which requests include the cookie
- Multiple cookies require separate `cookie set` calls

---

## connect

Connects to a Chrome instance running on the host via Chrome DevTools Protocol (CDP).

```bash
agent-browser connect <host:port>
```

**Arguments:**
- `<host:port>` — The CDP endpoint. Use `host.docker.internal:9222` when running inside a devcontainer.

**Prerequisites:**
Chrome must have remote debugging enabled on the host before connecting.

**Chrome 144+** (recommended): No CLI launch needed. Enable via a checkbox:
1. Open `chrome://inspect/#remote-debugging` in Chrome
2. Check "Enable remote debugging" — Chrome listens on port 9222 by default

**Chrome 136–143**: Chrome 136+ requires `--user-data-dir` alongside `--remote-debugging-port` or the flag is silently ignored:
```bash
# Linux / macOS
google-chrome --remote-debugging-port=9222 --user-data-dir="/tmp/chrome-debug"

# Windows PowerShell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:TEMP\chrome-debug"
```

**Examples:**
```bash
agent-browser connect host.docker.internal:9222
```

**When to use:**
- When the container's bundled Chromium is insufficient
- When specific browser extensions are needed
- When you need to observe browser behavior visually on the host
- When you need access to a logged-in Chrome session (cookies, extensions, saved passwords)

---

## close

Ends the current browser session and releases resources.

```bash
agent-browser close
```

**Notes:**
- Always close the session when done to free resources
- After closing, you can start a new session with `open` or `connect`

---

## Error Handling

**Common errors and recovery:**

| Error | Cause | Recovery |
|-------|-------|----------|
| Page load timeout | URL unreachable or slow response | Verify URL is correct; check network connectivity |
| Element not found | Reference ID from stale snapshot | Run `snapshot` again to get current references |
| Session already active | Tried to `open` without `close` | Run `close` first, then `open` |
| Connection refused (CDP) | Host Chrome not running with debug port | Start Chrome with `--remote-debugging-port` |
| Connection refused via localhost | Container cannot reach host on localhost | Use `host.docker.internal:9222` instead of `localhost:9222` |
| Chrome ignores --remote-debugging-port | Chrome 136+ requires --user-data-dir | Add `--user-data-dir` flag when launching Chrome |

**General recovery pattern:**
```bash
# If something goes wrong, close and start fresh
agent-browser close
agent-browser open https://example.com
agent-browser snapshot
```
