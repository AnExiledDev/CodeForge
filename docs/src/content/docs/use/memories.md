---
title: Memories
description: Memory management system for Claude Code observations — browse, approve, and maintain agent-generated memories.
sidebar:
  order: 9
---

CodeForge provides a memory management system that lets you review, approve, and maintain the observations Claude generates during your sessions. Memories are surfaced through the [dashboard](./dashboard/) and managed via a structured review workflow.

## What Are Memories?

During Claude Code sessions, Claude generates **observations** — patterns it notices, preferences it learns, decisions it records. These are part of Claude Code's autoMemory system: Claude writes observations to memory files in your project, and those files are loaded into future sessions to provide continuity.

Not every observation is worth keeping. Some may be outdated, incorrect, or too specific to a single session. The memory system gives you a review layer to curate what Claude remembers.

## How It Works

The memory lifecycle follows a structured flow:

1. **Claude generates observations** during sessions — stored as memory files
2. **Analysis runs** process sessions to extract and categorize observations
3. **You review observations** in the dashboard — approve (promote to memory) or dismiss
4. **Maintenance runs** consolidate and clean up the memory store
5. **Approved memories** are synced back to project `MEMORY.md` files for use in future sessions

## Browsing Memories

The dashboard's **Memories** page (`/memories`) provides three tabs for navigating the memory system:

### Memories Tab

Shows all approved memories with their category, content, confidence score, and source observations. Memories can be revoked if they are no longer accurate — revoking a memory removes it from the active set and updates the synced `MEMORY.md` file.

### Observations Tab

Lists all observations extracted from sessions, with filtering by:

- **Project** — scope to a specific project
- **Category** — filter by observation type (pattern, preference, decision, etc.)
- **Status** — pending, promoted, or stale

Each observation shows its content, source session, and extraction timestamp. From here you can:

- **Approve** an observation — promotes it to a memory. You provide the final memory text (rewritten as an imperative instruction) and optional tags.
- **Dismiss** an observation — marks it as stale so it no longer appears in the pending queue.
- **View history** — see the full lifecycle of an observation, including any analysis or promotion events.

### Runs Tab

Shows the history of analysis and maintenance runs, including:

- Run type (analysis or maintenance)
- Status and duration
- Number of observations produced
- Detailed event log for each run

## Analysis Runs

Trigger a memory analysis run from the dashboard to process a session's content and extract observations. Analysis runs:

- Parse the session's conversation for patterns, preferences, and decisions
- Categorize each observation
- Store results in the database for review

You can trigger analysis for individual sessions or for an entire project.

## Maintenance Runs

Maintenance runs consolidate and clean up the memory store for a project. They:

- Identify duplicate or near-duplicate memories
- Flag memories that may be outdated based on recent session activity
- Produce a summary of changes made

Trigger maintenance from the dashboard's Memories page and view run results in the Runs tab.

## Memory Stats

The Memories page header shows overview metrics:

- Total observations (pending, promoted, stale)
- Total active memories
- Breakdown by project

These stats help you gauge the size of your review queue and the health of your memory store.

## API Endpoints

The memory system is backed by these API endpoints on the dashboard server:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/memory/observations` | List observations with filtering |
| GET | `/api/memory/memories` | List approved memories |
| GET | `/api/memory/stats` | Memory statistics |
| GET | `/api/memory/runs` | Analysis and maintenance run history |
| GET | `/api/memory/runs/:id` | Run detail with events |
| POST | `/api/memory/analyze` | Trigger analysis for a session |
| POST | `/api/memory/maintain` | Trigger maintenance for a project |
| POST | `/api/memory/observations/:id/approve` | Promote observation to memory |
| POST | `/api/memory/observations/:id/dismiss` | Dismiss observation |
| POST | `/api/memory/memories/:id/revoke` | Revoke an approved memory |

## Related

- [Dashboard](./dashboard/) — the visual interface where memories are managed
- [Agents Reference](/reference/agents/) — agents generate observations during sessions
- [CLI Tools Reference](/reference/cli-tools/) — `codeforge` CLI for session and memory operations
