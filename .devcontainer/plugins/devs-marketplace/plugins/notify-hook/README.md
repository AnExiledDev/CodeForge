# notify-hook

Ultra-lightweight Claude Code plugin that sends a desktop notification and audio chime when Claude finishes responding. No scripts — just a single hook definition that calls the `claude-notify` binary.

## What It Does

When Claude stops responding (Stop hook), it runs the `claude-notify` command to:
1. Send a desktop notification
2. Play an audio chime

This lets you switch to other tasks while Claude works and get alerted when it needs your attention.

## How It Works

### Hook Lifecycle

```
Claude stops responding (Stop event)
  │
  └─→ claude-notify command fires
       │
       ├─→ Desktop notification sent
       └─→ Audio chime played
```

The hook has a 5-second timeout. The plugin contains no scripts of its own — it delegates entirely to the `claude-notify` binary.

## Plugin Structure

```
notify-hook/
├── .claude-plugin/
│   └── plugin.json    # Plugin metadata
├── hooks/
│   └── hooks.json     # Stop hook registration
└── README.md          # This file
```

## Requirements

- Claude Code with plugin hook support
- The `notify-hook` devcontainer feature must be installed (provides the `claude-notify` binary)
