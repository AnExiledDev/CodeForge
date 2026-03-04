# notify-hook

Desktop notifications and audio chime when Claude Code finishes responding.

## How It Works

This feature uses two terminal-based notification mechanisms that work inside devcontainers:

| Mechanism | Purpose | Requirement |
|-----------|---------|-------------|
| OSC 777 escape sequence | Desktop notification popup | VSCode extension (auto-installed) |
| Terminal bell (`\a`) | Audio chime | VSCode setting (auto-configured) |

## Auto-Configured

All requirements are automatically configured on container rebuild:

- **Extension**: `wenbopan.vscode-terminal-osc-notifier` installed via devcontainer.json
- **Setting**: `terminal.integrated.enableBell: true` set via devcontainer.json
- **Hook**: Stop hook registered via plugin's hooks.json

No manual user setup required.

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `enableBell` | `true` | Enable terminal bell (audio chime) |
| `enableOsc` | `true` | Enable OSC 777 desktop notifications |

## Usage

Once the container is rebuilt, notifications trigger automatically when Claude Code finishes responding.

### Runtime Disable

Temporarily disable notifications via environment variables:

```bash
# Disable audio chime
export NOTIFY_ENABLE_BELL=false

# Disable desktop notification
export NOTIFY_ENABLE_OSC=false
```

### Manual Trigger

Test the notification manually:

```bash
/usr/local/bin/claude-notify
```

## Custom Sound

The terminal bell uses Windows "Default Beep" sound. For a custom AI-like chime:

1. Open Windows Settings → Sound → Sound Control Panel
2. Go to Sounds tab
3. Find "Default Beep" in the list
4. Change to a custom `.wav` file

## Troubleshooting

### No desktop notification

1. Verify extension is installed (check VSCode Extensions panel)
2. Check Windows notification settings allow VSCode notifications
3. Test manually: `printf '\033]777;notify;Test;Message\007'`

### No audio

1. Verify VSCode setting is applied: `"terminal.integrated.enableBell": true`
2. Check Windows sound is not muted
3. Test manually: `printf '\a'`

### Hook not triggering

Check the plugin's hook file exists:

```bash
cat /workspaces/.devcontainer/plugins/devs-marketplace/plugins/notify-hook/hooks/hooks.json
```

Verify Claude Code is loading the devs-marketplace plugins in settings.
