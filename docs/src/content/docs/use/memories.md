---
title: Memories
description: Memory management system for Claude Code observations — browse, approve, and maintain agent-generated memories.
sidebar:
  order: 9
---

CodeForge provides a memory management system that lets you review, approve, and maintain the observations Claude generates during your sessions.

## What Are Memories?

During Claude Code sessions, Claude generates **observations** — patterns it notices, preferences it learns, decisions it records. These are part of Claude Code's autoMemory system: Claude writes observations to memory files in your project, and those files are loaded into future sessions to provide continuity.

Not every observation is worth keeping. Some may be outdated, incorrect, or too specific to a single session. The memory system gives you a review layer to curate what Claude remembers.

## How It Works

The memory lifecycle follows a structured flow:

1. **Claude generates observations** during sessions — stored as memory files
2. **Analysis runs** process sessions to extract and categorize observations
3. **You review observations** — approve (promote to memory) or dismiss
4. **Maintenance runs** consolidate and clean up the memory store
5. **Approved memories** are synced back to project `MEMORY.md` files for use in future sessions

## Analysis Runs

Analysis runs process a session's content and extract observations. Analysis runs:

- Parse the session's conversation for patterns, preferences, and decisions
- Categorize each observation
- Store results in the database for review

You can trigger analysis for individual sessions or for an entire project.

## Maintenance Runs

Maintenance runs consolidate and clean up the memory store for a project. They:

- Identify duplicate or near-duplicate memories
- Flag memories that may be outdated based on recent session activity
- Produce a summary of changes made

## Related

- [Agents Reference](/reference/agents/) — agents generate observations during sessions
- [CLI Tools Reference](/reference/cli-tools/) — `codeforge` CLI for session and memory operations
