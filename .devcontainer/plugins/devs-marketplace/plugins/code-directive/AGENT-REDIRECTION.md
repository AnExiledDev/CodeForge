# Agent Redirection Guide

How Claude Code's hook system lets you replace, reroute, or transform any tool call — including swapping built-in subagents for custom ones.

## How It Works

Claude Code plugins can register **PreToolUse hooks** that intercept tool calls before they execute. The hook receives the full tool input as JSON on stdin and can return modified input on stdout. This is the mechanism behind agent redirection: when Claude spawns a subagent via the `Task` tool, a hook intercepts the call and rewrites `subagent_type` to point at a custom agent definition.

### The Hook Contract

```
stdin  → { "tool_name": "Task", "tool_input": { "subagent_type": "Explore", "prompt": "...", ... } }
stdout ← { "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "allow", "updatedInput": { ...modified tool_input... } } }
```

The hook script receives the tool call context on stdin, and can return:

| Field | Effect |
|-------|--------|
| `permissionDecision: "allow"` | Let the call proceed (with optional modifications) |
| `permissionDecision: "deny"` | Block the call entirely (with a reason) |
| `updatedInput: {...}` | Replace the tool input — Claude Code uses the new values instead of the originals |

**Critical detail**: `updatedInput` **replaces** the original input (it does not merge). Always spread the original fields and override only what you need:

```python
updated = {**tool_input, "subagent_type": "my-custom-agent"}
```

### Hook Registration

In your plugin's `hooks/hooks.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Task",
        "hooks": [{
          "type": "command",
          "command": "python3 ${CLAUDE_PLUGIN_ROOT}/scripts/my-hook.py",
          "timeout": 5
        }]
      }
    ]
  }
}
```

The `matcher` field controls which tool triggers the hook. Use `"Task"` to intercept subagent spawning, `"Bash"` for command execution, `"Edit|Write"` for file modifications, etc.

## What We Do: Built-in → Custom Agent Swap

The `redirect-builtin-agents.py` hook maps Claude Code's built-in agent types to our custom agents:

```python
REDIRECT_MAP = {
    "Explore": "explorer",        # Fast codebase search
    "Plan": "architect",          # Implementation planning
    "general-purpose": "generalist",  # Multi-step tasks
    "Bash": "bash-exec",          # Command execution
    "claude-code-guide": "claude-guide",
    "statusline-setup": "statusline-config",
}
```

When Claude decides to spawn an `Explore` agent, the hook rewrites it to `code-directive:explorer` — a custom agent with tailored instructions, tool restrictions, and model selection. The original prompt passes through unchanged.

### Custom Agent Definitions

Agents are Markdown files with YAML frontmatter in the `agents/` directory:

```yaml
---
name: explorer
description: >-
  Fast codebase search. Use when you need to find files,
  search code, or answer structural questions.
tools: Read, Glob, Grep, Bash        # Restrict available tools
model: sonnet                         # Or: opus, haiku, inherit
color: cyan
memory:
  scope: project                      # Or: user, global
skills:
  - debugging                         # Inject skill knowledge
---

# Explorer Agent

You are a codebase navigation specialist...
```

Key frontmatter fields:

| Field | What it controls |
|-------|-----------------|
| `tools` | Which tools the agent can use (`"*"` for all, or comma-separated list) |
| `model` | Which model runs the agent (`sonnet`, `opus`, `haiku`, `inherit`) |
| `skills` | Skills injected into the agent's context |
| `memory.scope` | Memory persistence level |

The Markdown body below the frontmatter becomes the agent's system prompt.

## What Else You Can Do

The same hook mechanism supports far more than agent swapping. Here are patterns that work today:

### Modify the Prompt

Inject additional context, constraints, or instructions into any subagent's prompt:

```python
updated = {
    **tool_input,
    "prompt": tool_input["prompt"] + "\n\nALWAYS check for security issues.",
}
```

### Change the Model

Force a specific model for certain agent types or tasks:

```python
if "security" in tool_input.get("prompt", "").lower():
    updated = {**tool_input, "model": "opus"}  # Use strongest model for security tasks
```

### Conditional Routing

Route to different agents based on prompt content, file patterns, or environment:

```python
prompt = tool_input.get("prompt", "")
if "test" in prompt.lower():
    target = "test-writer"
elif "refactor" in prompt.lower():
    target = "refactorer"
else:
    target = "generalist"
updated = {**tool_input, "subagent_type": f"code-directive:{target}"}
```

### Block Certain Operations

Deny tool calls that match dangerous patterns:

```python
# This is exactly how dangerous-command-blocker works for Bash
response = {
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": "This operation is not allowed.",
    }
}
```

### Intercept Any Tool (Not Just Task)

Hooks aren't limited to subagent spawning. You can intercept `Bash`, `Edit`, `Write`, `WebFetch` — any tool:

```json
{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "python3 my-script.py" }] }
```

The `dangerous-command-blocker` plugin uses this to inspect Bash commands before execution. The `protected-files-guard` does the same for Edit/Write to block modifications to sensitive files.

### Chain with External Services

Since hooks are just scripts that read stdin and write stdout, you can call anything:

```python
# Forward the prompt to an external API for analysis
import requests
result = requests.post("https://my-api.example.com/analyze", json=tool_input)
# Use the response to modify the tool call
```

This opens up patterns like:
- **External LLM routing** — send the prompt to a classifier that picks the best model/agent
- **Audit logging** — POST every tool call to an external logging service
- **Cost control** — check a budget API before allowing expensive operations
- **RAG injection** — query a vector DB and inject relevant context into the prompt

### PostToolUse: React After Execution

`PostToolUse` hooks run after a tool completes and can inject context back to Claude:

```python
# Return diagnostic information that Claude will see
print(json.dumps({"additionalContext": "Lint warning: unused import on line 12"}))
```

This is how the auto-linter and syntax validator work — they inspect the result of Edit/Write operations and feed findings back into the conversation.

## File Layout

```
code-directive/
├── agents/                    # Agent definitions (17 .md files)
│   ├── explorer.md
│   ├── architect.md
│   ├── generalist.md
│   └── ...
├── hooks/
│   └── hooks.json             # Hook registrations
├── scripts/
│   ├── redirect-builtin-agents.py   # The redirection hook
│   ├── collect-edited-files.py      # Collects paths for Stop hooks
│   ├── syntax-validator.py          # PostToolUse syntax checks
│   └── skill-suggester.py           # Suggests skills on prompt
└── skills/                    # Skill definitions (16 directories)
    ├── fastapi/
    ├── svelte5/
    └── ...
```

## Writing Your Own

1. **Create the agent** — add a `.md` file to `agents/` with YAML frontmatter
2. **Add the redirect** — add an entry to `REDIRECT_MAP` in `redirect-builtin-agents.py`, or write a new hook script
3. **Register the hook** — add it to `hooks/hooks.json` under the appropriate event type
4. **Test** — spawn the agent via Claude and check `/tmp/agent-redirect.log` for redirect entries

The hook always exits 0. If it crashes or times out, Claude Code falls back to the original tool call — so a broken hook never blocks work.
