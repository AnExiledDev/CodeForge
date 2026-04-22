---
description: Investigate logs and diagnose issues using the debug-logs agent
argument-hint: [error description, container/service name, or timeframe]
allowed-tools: Bash, Read, Glob, Grep, Task
---

# /debug - Log Investigation & Issue Diagnosis

Investigate application, container, and system logs to diagnose failures and errors.

## Input

`$ARGUMENTS` - Optional scope hint. Can be:
- An error message or description (e.g., "connection refused on port 5432")
- A container or service name (e.g., "web", "postgres")
- A timeframe (e.g., "last 30 minutes", "since deployment")
- A combination (e.g., "OOM errors in worker container since noon")
- Empty (triggers a broad scan of all available log sources)

## Process

### Step 1: Load Domain Knowledge

**CRITICAL:** Before any log analysis, invoke the `debugging` skill to load log analysis domain knowledge. This ensures you have the full reference material for log locations, error patterns, and diagnosis procedures.

### Step 2: Parse Scope

Analyze `$ARGUMENTS` to determine:
- **Target service/container**: Specific container name, service name, or "all"
- **Error type**: What kind of error to look for, or "any"
- **Timeframe**: How far back to look (default: 1 hour)

If arguments are empty, set scope to: all sources, any errors, last 1 hour.

### Step 3: Delegate to Debug Agent

**CRITICAL:** You MUST use the `debug-logs` agent (via the Task tool) for all log analysis work. Do NOT read logs directly — delegate to the agent.

Construct a clear task description for the agent that includes:
- What to investigate (the parsed scope from Step 2)
- Any specific error messages or patterns to search for
- The timeframe to focus on
- What the user reported as the symptom

Example delegation:
```
Investigate logs for the "web" container. The user reports "connection refused" errors.
Focus on the last 1 hour. Check the web container logs, any dependent service containers
(database, redis, etc.), and correlate timestamps to find the root cause.
```

### Step 4: Present Findings

When the agent returns its findings, present them to the user in this format:

**Summary** - One-sentence root cause assessment.

**What Was Checked** - List of all log sources examined.

**Errors Found** - Each error with severity, timestamp, source, and context. Highlight the root cause error distinctly from downstream effects.

**Timeline** - Chronological sequence of events if multiple errors were found.

**Recommended Actions** - Ordered steps to resolve the issue, with specific commands or code changes.

### Step 5: Follow Up (if inconclusive)

If the agent's findings are inconclusive:
1. Identify what additional information would help
2. Re-invoke the agent with a narrower or different scope
3. Consider checking different log sources or expanding the timeframe
4. Report partial findings to the user and suggest manual investigation steps

## Examples

**Broad scan (no arguments):**
> User: `/debug`
> Action: Delegate to agent with "Perform a broad scan of all available log sources from the last hour. List all containers, find all log files, check system logs. Report any errors, warnings, or anomalies."

**Specific container:**
> User: `/debug postgres container keeps restarting`
> Action: Delegate to agent with "Investigate the postgres container. It is reportedly restarting repeatedly. Check container exit codes, restart count, logs before each crash, memory usage, and health check status."

**Error investigation:**
> User: `/debug 502 Bad Gateway`
> Action: Delegate to agent with "Investigate 502 Bad Gateway errors. Check the reverse proxy / web server logs (nginx, caddy, etc.) for upstream connection failures, then check the upstream application container logs for crashes or errors that would cause it to be unavailable."
