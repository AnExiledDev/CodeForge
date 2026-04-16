---
title: Everyday Commands
description: The most useful commands for daily work in CodeForge without making you read the full command reference first.
sidebar:
  order: 2
---

This page is intentionally curated. Use it for the commands you are likely to need every day.

## Start and Debug Sessions

| Command | Why You Use It |
|---------|----------------|
| `cc` | Start a normal CodeForge session |
| `ccw` | Use the writing prompt |
| `ccraw` | Compare behavior against vanilla Claude Code |
| `cc --resume <id>` | Resume a previous session |

## Verify and Inspect the Environment

| Command | Why You Use It |
|---------|----------------|
| `check-setup` | Confirm the install is healthy |
| `cc-tools` | See what is installed and enabled |
| `gh auth status` | Check GitHub CLI auth |

## Monitor Usage and Sessions

| Command | Why You Use It |
|---------|----------------|
| `ccusage` | Check Claude usage and cost stats |
| `ccusage-codex` | Check Codex usage stats |
| `claude-monitor` | Watch active session activity in the terminal |

## Search and Navigation

| Command | Why You Use It |
|---------|----------------|
| `sg` | AST-aware structural search |
| `tree-sitter` | Parse and inspect file structure |
| `codeforge session search` | Search session history |

## Specs, Git, and Reviews

These are typed inside a Claude session, not in your shell:

| Command | Why You Use It |
|---------|----------------|
| `/spec <feature>` | Create and refine a spec package |
| `/build <feature>` | Implement from an approved spec |
| `/ship` | Review, commit, push, and optionally create a PR |
| `/pr:review` | Review an existing PR and post findings |

## Full Reference

When you need the complete catalog, use [Commands Reference](/reference/commands/) and [CLI Tools Reference](/reference/cli-tools/).
