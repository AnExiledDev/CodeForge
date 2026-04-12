---
title: Dashboard
description: Visual analytics dashboard for Claude Code sessions — cost tracking, session replay, activity heatmaps, and real-time updates.
sidebar:
  order: 8
---

CodeForge includes a visual analytics dashboard — a Svelte 5 single-page application backed by a Bun HTTP server — that gives you a complete picture of your Claude Code usage. Browse sessions, replay conversations, track costs, and analyze token consumption patterns across projects, all from a dark-mode web interface.

:::note[Optional Component]
The dashboard is part of the CodeForge ecosystem, but it may not be enabled in every install. If `codeforge-dashboard` is unavailable, enable the dashboard feature first in [Optional Components](/customize/optional-components/).
:::

## Accessing the Dashboard

When enabled, the dashboard runs on **port 7847** and may auto-launch when your DevContainer starts. You can also start it manually:

```bash
codeforge-dashboard
```

Once running, open `http://localhost:7847` in your browser. If you are using VS Code with port forwarding, the port is forwarded automatically.

## Analytics Overview

The main dashboard page shows a comprehensive set of analytics widgets covering your Claude Code usage. All widgets respect the active time range filter.

### KPI Cards

Four summary cards at the top of the page show key metrics at a glance:

| Card | What It Shows |
|------|---------------|
| **Sessions** | Total session count in the selected time range |
| **Tokens** | Combined input and output token consumption |
| **Cost** | Estimated API cost based on token usage and model pricing |
| **Cache Efficiency** | Ratio of cache-read tokens to total input tokens |

### Charts and Visualizations

The dashboard provides a rich set of charts for deeper analysis:

| Widget | Description |
|--------|-------------|
| **Activity Heatmap** | GitHub-style calendar heatmap showing daily session activity |
| **Cost Chart** | Cost over time, broken down by day |
| **Token Trends** | Input and output token usage over time |
| **Model Comparison** | Table comparing token usage, cost, and efficiency across models |
| **Session Scatter Plot** | Sessions plotted by duration vs. token count to spot outliers |
| **Project Costs** | Per-project cost breakdown chart |
| **Model Distribution** | Pie/donut chart showing model usage proportions |
| **Tool Usage** | Which Claude Code tools are used most frequently |
| **Cache Efficiency** | Cache hit rate trends over time |
| **Hourly Heatmap** | Session activity by hour-of-day and day-of-week |
| **Duration Distribution** | Histogram of session durations |
| **Insights Bar** | Auto-generated insights and anomaly highlights |

### Time Range Filtering

A time range selector at the top of the dashboard lets you scope all analytics to a specific window:

- **7 days** — last week of activity
- **30 days** — last month
- **90 days** — last quarter
- **All time** — everything available

## Session Browsing and Replay

The **Sessions** page lists all parsed sessions with filtering by project, model, and time range. Each session row shows the project, model, token count, duration, and cost.

### Conversation Replay

Click any session to open the full conversation replay view. This renders the complete exchange between you and Claude, including:

- **Message bubbles** — user and assistant messages in a chat-style layout
- **Tool call blocks** — expandable blocks showing tool invocations and their results
- **Thinking blocks** — Claude's extended thinking content, when present
- **Conversation search** — search within the current session's messages

### Session Detail Tabs

Each session detail page includes additional tabs for deeper inspection:

| Tab | Content |
|-----|---------|
| **Context** | CLAUDE.md files and memory files that were loaded into the session |
| **Plan** | The session's plan (if one was created), with version history |
| **Tasks** | Task list and progress for team sessions |
| **Agents** | Timeline of subagent spawns, showing agent type, model, duration, and token usage |

## Search

The dashboard provides full-text search across all sessions from the top navigation bar. Search results show matching messages with context, linked back to their source sessions. Within a session detail view, conversation search lets you find specific messages in long sessions.

## Project Analytics

The **Projects** page shows per-project analytics:

- Session counts and activity timeline
- Cost breakdown by project
- Token usage patterns
- Drill-down to individual sessions within a project

## Real-Time Updates

The dashboard uses **Server-Sent Events (SSE)** to push updates when new sessions are detected or existing sessions are modified. Active sessions show a live indicator, and analytics refresh automatically as new data arrives — no manual page refresh needed.

## Routes

The dashboard provides these pages:

| Route | Page |
|-------|------|
| `/` | Analytics overview with all charts and KPIs |
| `/sessions` | Session list with filtering |
| `/sessions/:id` | Session detail with conversation replay |
| `/projects` | Project list with per-project analytics |
| `/projects/:project` | Individual project detail |
| `/plans` | Plan browser |
| `/tasks` | Task browser for team sessions |
| `/agents` | Agent activity across all sessions |
| `/memories` | Memory management (see [Memories](./memories/)) |
| `/context` | Context file browser |

## Related

- [Memories](./memories/) — memory management system accessible from the dashboard
- [CLI Tools Reference](/reference/cli-tools/) — `codeforge-dashboard` command reference
- [Commands Reference](/reference/commands/) — all CLI commands

## Next Steps

- Need port help: [Accessing Services](./accessing-services/)
- Need to enable it: [Optional Components](/customize/optional-components/)
