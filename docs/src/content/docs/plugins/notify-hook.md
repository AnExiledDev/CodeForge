---
title: Notify Hook
description: The notify hook plugin sends desktop notifications when Claude Code completes tasks or needs attention.
sidebar:
  order: 11
---

The notify hook plugin sends a desktop notification every time Claude finishes a turn. This is especially useful during long-running tasks -- you can switch to another window or grab a coffee and get alerted the moment Claude needs your attention again.

## How It Works

The plugin registers a single Stop hook that calls the `claude-notify` command whenever Claude completes a response. The notification fires regardless of what Claude was doing, so you always know when it's your turn.

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "claude-notify",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

The `claude-notify` command is a lightweight wrapper provided by CodeForge that handles platform-specific notification delivery. It has a 5-second timeout to ensure it never delays the session.

## When Notifications Fire

Notifications are sent at the end of every assistant turn:

- Claude finishes implementing a feature or fixing a bug
- Claude completes a code review or analysis
- Claude encounters an error and needs your guidance
- Claude asks a clarifying question before proceeding
- A long build, test, or deployment step completes
- Claude finishes a multi-step refactoring operation

:::tip[Pair It with Context]
Notifications work especially well alongside the [Session Context](./session-context/) plugin. When you return to Claude after a notification, the session context ensures Claude already has current git state and change summaries ready.
:::

## Why Notifications Matter

During AI-assisted development, many tasks take longer than you'd want to sit and watch. Test suites, dependency installations, complex refactoring across multiple files -- these operations can take minutes. Without notifications, you're stuck polling the terminal or missing the moment Claude finishes.

The notify hook solves this by turning Claude Code into an asynchronous workflow. You ask Claude to do something, switch to documentation, email, or another task, and get pinged when it's done. This is especially valuable when running multiple Claude sessions in parallel across different projects.

## Interaction with Other Stop Hooks

The notify hook fires alongside other Stop hooks like the [commit reminder](./session-context/) and [advisory test runner](./auto-code-quality/). All Stop hooks run in the order they're registered. The notification fires even if another Stop hook blocks -- so you'll still get alerted when Claude needs your attention due to test failures or uncommitted changes.

## Platform Support

Desktop notifications are delivered from the DevContainer to your host system. How they appear depends on your setup:

| Environment | Behavior |
|-------------|----------|
| **VS Code + DevContainer** | Notifications forward through VS Code's notification system |
| **Terminal-based sessions** | Uses the terminal's bell or notification capability |
| **Remote/SSH sessions** | Notifications may not reach the host depending on forwarding setup |

:::note[Notification Forwarding]
If notifications aren't appearing, check that your terminal or editor supports notification forwarding from containers. Some terminal emulators require explicit configuration to display notifications from remote sessions.
:::

## Hook Registration

| Script | Hook | Purpose |
|--------|------|---------|
| `claude-notify` | Stop | Sends desktop notification when assistant turn completes |

## Related

- [Session Context](./session-context/) -- provides the context that's available when you return after a notification
- [Hooks](../customization/hooks/) -- how Stop hooks trigger notifications
