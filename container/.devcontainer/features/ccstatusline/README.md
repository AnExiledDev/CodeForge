# ccstatusline Feature

A DevContainer Feature that installs and configures [ccstatusline](https://github.com/sirmalloc/ccstatusline) - a compact powerline status line for Claude Code with essential metrics.

## Quick Start

```json
{
  "features": {
    "ghcr.io/devcontainers/features/node:1": {},
    "ghcr.io/devcontainers/features/common-utils:2": {},
    "./features/ccstatusline": {}
  }
}
```

**Note:** This feature requires Node.js and common-utils features to be installed first.

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `username` | string | `automatic` | User to install for (auto-detects: vscode, node, codespace, or root) |

## Display Format

### 6-Line Powerline Layout

```
Line 1: Context Length ▶ Context % ▶ Model
Line 2: Tokens In ▶ Tokens Out ▶ Tokens Cached
Line 3: Git Branch ▶ Git Changes ▶ Git Worktree
Line 4: Session Clock ▶ Session Cost ▶ Block Timer
Line 5: Tokens Total ▶ Version ▶ cc --resume {sessionId}
Line 6: Session: 🧊 45% (2h14m) | Weekly: 🔥 12% | Sonnet: 🧊 3%
```

- **Lines 1-4**: Core session metrics, token tracking, git status, and cost
- **Line 5**: Totals + copyable session resume command for `cc --resume`
- **Line 6**: Live burn rate from [ccburn](https://github.com/JuanjoFuchs/ccburn) with pace indicators

All widgets connected with powerline arrows (monokai theme).

## What This Feature Installs

- **ccstatusline npm package**: Installed on-demand via `npx` (not globally)
- **Configuration file**: `~/.config/ccstatusline/settings.json` with powerline theme
- **Claude Code integration**: Automatically updates `~/.claude/settings.json`
- **Disk Usage**: Minimal (~2MB when cached by npx)

## Requirements

This feature has explicit dependencies that **must** be installed first:

```json
{
  "features": {
    "ghcr.io/devcontainers/features/node:1": {},
    "ghcr.io/devcontainers/features/common-utils:2": {},
    "./features/ccstatusline": {}
  }
}
```

**Required:**
- **Node.js + npm/npx**: For running ccstatusline package
- **jq**: For safe JSON generation (from common-utils)

The feature will validate these are present and exit with an error if missing.

## Features

- ✅ **Powerline Mode**: Seamless arrow separators between widgets (monokai theme)
- ✅ **6-Line Layout**: 16 widgets covering context, tokens, git, cost, session ID, and burn rate
- ✅ **Session Resume**: Copyable `cc --resume {sessionId}` command via custom-command widget
- ✅ **Burn Rate Tracking**: Live ccburn compact output showing pace indicators (🧊/🔥/🚨)
- ✅ **ANSI Colors**: High-contrast colors optimized for dark terminals
- ✅ **Automatic Integration**: Auto-configures `~/.claude/settings.json`
- ✅ **Idempotent**: Safe to run multiple times
- ✅ **Multi-user**: Automatically detects container user
- ✅ **Config-aware**: Respects `CLAUDE_CONFIG_DIR` environment variable (defaults to `~/.claude`)

## Post-Installation Steps

### ✅ Configuration is Automatic

This feature automatically:
1. Creates `~/.config/ccstatusline/settings.json` with powerline configuration
2. Configures `~/.claude/settings.json` to use ccstatusline

**No manual steps required!**

### Verify It Worked

**1. Check configuration:**
```bash
cat ~/.config/ccstatusline/settings.json | jq .
```

**2. Test manually:**
```bash
echo '{"model":{"display_name":"Test Model"}}' | npx -y ccstatusline@latest
```

You should see formatted output with powerline styling.

**3. Check Claude Code integration:**
```bash
cat "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json" | jq '.statusLine'
```

Should show:
```json
{
  "type": "command",
  "command": "npx -y ccstatusline@latest"
}
```

## Customization

### Modify Configuration After Installation

Edit the configuration file:
```bash
vim ~/.config/ccstatusline/settings.json
```

**Important:** Changes to runtime config are lost on container rebuild. To persist changes, modify the feature's `install.sh` file where the JSON is generated (lines 60-80).

### Widget Configuration Format

Widgets are configured in the `lines` array:

```json
{
  "id": "unique-id",
  "type": "widget-type",
  "color": "#FFFFFF",     // Foreground (hex)
  "bgColor": "#000000",   // Background (hex)
  "bold": true            // Optional: bold text
}
```

### Available Widget Types

**Session Metrics:**
- `model` - Current AI model
- `session-clock` - Session elapsed time
- `session-cost` - Total session cost (USD)
- `block-timer` - Block execution time
- `claude-session-id` - Session ID (raw or with label)

**Context Tracking:**
- `context-length` - Context window size
- `context-percentage` - Context usage percentage
- `context-percentage-usable` - Usable context percentage

**Token Metrics:**
- `tokens-input` - Input tokens
- `tokens-output` - Output tokens
- `tokens-cached` - Cached tokens
- `tokens-total` - Total tokens

**Git Integration:**
- `git-branch` - Current branch
- `git-changes` - Lines added/removed
- `git-worktree` - Git worktree info

**External Metrics (custom-command):**
- `custom-command` → `/usr/local/bin/ccstatusline-session-resume` - Copyable resume command
- `custom-command` → `/usr/local/bin/ccburn-statusline` - Burn rate with pace indicators

**Other:**
- `cwd` - Current working directory
- `version` - Claude Code version
- `custom-text` - Static text
- `custom-command` - Arbitrary command output (receives Claude Code JSON via stdin)

### Color Scheme

The default powerline theme uses:

- **Maroon** (`#9B4F5C`): Model name - bold, authoritative
- **Gold** (`#FFD700`): Context, directory, cost - attention-grabbing
- **Blue** (`#4A90E2`): Git branch - clear, standard
- **Pink/Magenta** (`#D888C8`, `#E8A8C8`): Git changes and version - distinctive
- **White** (`#FFFFFF`): Text on dark backgrounds
- **Black** (`#1E1E1E`): Text on gold background

All colors selected for excellent readability on dark terminal themes with proper contrast ratios.

## Troubleshooting

### Status Line Doesn't Appear

**Symptom:** Claude Code starts but no status line visible

**Solution:**
```bash
# 1. Verify config exists
cat ~/.config/ccstatusline/settings.json | jq .

# 2. Test manually
echo '{"model":{"display_name":"Test"}}' | npx -y ccstatusline@latest

# 3. Check Claude Code settings
cat "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json" | jq '.statusLine'

# 4. Manually run auto-config if needed
configure-ccstatusline-auto

# 5. Restart Claude Code
```

### Installation Fails: "npm/npx not available"

**Cause:** Node.js feature not installed first

**Solution:**
```json
{
  "features": {
    "ghcr.io/devcontainers/features/node:1": {},
    "./features/ccstatusline": {}
  }
}
```

### Installation Fails: "jq not available"

**Cause:** common-utils feature not installed

**Solution:**
```json
{
  "features": {
    "ghcr.io/devcontainers/features/common-utils:2": {},
    "./features/ccstatusline": {}
  }
}
```

### Display Issues (Broken Arrows, Colors)

**Cause:** Terminal doesn't support powerline fonts or truecolor

**Solutions:**
1. Install powerline fonts in your terminal
2. Check terminal supports 24-bit color (truecolor)
3. For VS Code: Ensure using a powerline-compatible font like "Cascadia Code PL" or "MesloLGS NF"

### Performance Issues (Slow Refresh)

**Cause:** `npx` downloads package on each run

**Solution:** Install globally for faster execution:
```bash
npm install -g ccstatusline@latest
```

Then update `${CLAUDE_CONFIG_DIR:-~/.claude}/settings.json`:
```json
{
  "statusLine": {
    "type": "command",
    "command": "ccstatusline"
  }
}
```

### Permission Errors

**Symptom:** "Permission denied" on config file

**Solution:**
```bash
# Check ownership
ls -la ~/.config/ccstatusline/settings.json

# Fix if needed (replace 'vscode' with your username)
sudo chown -R vscode:vscode ~/.config/ccstatusline/
```

## Resources

- [ccstatusline GitHub](https://github.com/sirmalloc/ccstatusline)
- [ccstatusline npm package](https://www.npmjs.com/package/ccstatusline)
- [Claude Code Documentation](https://docs.claude.com/en/docs/claude-code/statusline)
- [Powerline Fonts](https://github.com/powerline/fonts)

## License

This feature configuration is MIT licensed. The ccstatusline package has its own license (see npm package).

---

**Part of your DevContainer Features collection**
