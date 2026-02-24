---
title: Hooks
description: The hook system that lets plugins and custom scripts run at specific points in the Claude Code lifecycle.
sidebar:
  order: 5
---

Hooks are scripts that execute at specific points during a Claude Code session. They let plugins validate commands before they run, inject context after tool use, run quality checks when Claude finishes a turn, and respond to team events. Hooks are the primary mechanism for extending Claude Code without modifying it.

## Hook Points

CodeForge uses eight hook points, each serving a different purpose in the session lifecycle:

### PreToolUse

Fires **before** a tool executes. Used for validation and gating.

**Common uses:** Block dangerous shell commands, enforce workspace scope, protect critical files, validate file paths, redirect agent types.

**Return behavior:** The script exits with code 0 to allow the tool, or code 2 to block it with an error message.

**Example from CodeForge:** The dangerous-command-blocker checks every Bash command against a list of destructive patterns (like `rm -rf /` or `git push --force main`) and blocks matches before they execute.

### PostToolUse

Fires **after** a tool executes successfully. Used for context injection and file tracking.

**Common uses:** Collect edited files for batch processing, validate syntax of written files, suggest relevant skills, inject working directory context.

**Return behavior:** The script can return context to inject into the conversation via `additionalContext`, or return nothing for silent observation.

**Example from CodeForge:** The auto-code-quality plugin tracks every file edited via `Edit` or `Write` tools, then batches them for formatting and linting at the next Stop point.

### Stop

Fires **when Claude finishes a turn** and returns control to the user. Used for quality assurance and reminders.

**Common uses:** Batch format all edited files, run linters, execute affected tests, remind about uncommitted changes, check if specs need updating, send desktop notifications.

**Return behavior:** Context injected via `additionalContext` appears in Claude's next turn. Advisory hooks (like the test runner) provide information without blocking.

**Example from CodeForge:** At every Stop, the auto-code-quality plugin formats all edited files (Ruff, Biome, gofmt, shfmt, dprint, rustfmt), runs linters (Pyright, Ruff, Biome, ShellCheck, go vet, hadolint, clippy), and then runs affected tests.

### SessionStart

Fires **when a new session begins**. Used for initial context loading.

**Common uses:** Inject git repository state (branch, status, recent commits), harvest TODO/FIXME comments from the codebase.

### SubagentStart

Fires **when a subagent is spawned**. Used for subagent configuration.

**Common uses:** Inject the current working directory into subagent context.

### TeammateIdle

Fires **when a teammate agent goes idle** in a team session. Used for quality gates.

**Common uses:** Check whether the teammate has incomplete tasks before allowing shutdown.

### TaskCompleted

Fires **when a task is marked complete** in a team session. Used for verification.

**Common uses:** Run the test suite to verify the completed task has not broken anything.

### UserPromptSubmit

Fires **when the user sends a prompt**, before Claude processes it. Used for context enrichment.

**Common uses:** Auto-suggest relevant skills based on prompt content, fetch linked GitHub issues/PRs from `#123` references, inject contextual information.

**Return behavior:** The script can return `additionalContext` to inject information into Claude's context before it processes the user's message.

**Example from CodeForge:** The skill-engine's `skill-suggester.py` matches your prompt against keyword patterns and suggests relevant skills. The ticket-workflow's `ticket-linker.py` detects GitHub issue references and fetches their details.

## Hook Registration

Hooks are registered in a `hooks.json` file within a plugin's `hooks/` directory. Here is the structure from the session-context plugin:

```json
{
  "description": "Context injection at session boundaries",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ${CLAUDE_PLUGIN_ROOT}/scripts/git-state-injector.py",
            "timeout": 10
          },
          {
            "type": "command",
            "command": "python3 ${CLAUDE_PLUGIN_ROOT}/scripts/todo-harvester.py",
            "timeout": 8
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 ${CLAUDE_PLUGIN_ROOT}/scripts/commit-reminder.py",
            "timeout": 8
          }
        ]
      }
    ]
  }
}
```

### Registration Fields

| Field | Description | Required |
|-------|-------------|----------|
| `type` | Execution type (always `"command"` for script-based hooks) | Yes |
| `command` | Shell command to execute. Use `${CLAUDE_PLUGIN_ROOT}` to reference the plugin directory. | Yes |
| `timeout` | Maximum execution time in seconds. The hook is killed if it exceeds this limit. | Yes |
| `matcher` | Tool name filter -- only fires for matching tools. Use `\|` to match multiple tools (e.g., `Edit\|Write`). Empty string matches all tools. Only relevant for PreToolUse, PostToolUse, and SubagentStart. | No |

:::tip[Set Reasonable Timeouts]
Hooks run synchronously in the Claude Code pipeline. A slow hook delays every tool use. Keep PreToolUse and PostToolUse hooks under 5 seconds. Stop hooks can be longer (up to 60 seconds) since they run at turn boundaries.
:::

## Hook Scripts

Hook scripts are typically Python files that receive context via stdin (JSON) and communicate results via stdout and exit codes.

### Input Format

Scripts receive a JSON object on stdin with context about the current tool use:

```json
{
  "tool_name": "Bash",
  "tool_input": {
    "command": "git status"
  },
  "session_id": "abc-123",
  "cwd": "/workspaces/projects/MyProject"
}
```

The exact fields depend on the hook point and which tool triggered it.

### Output Format

Scripts communicate results in two ways:

**Exit codes** (PreToolUse only):
- `0` -- Allow the tool to proceed
- `2` -- Block the tool and show the error message from stdout

**Stdout JSON** (all hook points):
```json
{
  "decision": "allow",
  "message": "Optional context to inject",
  "additionalContext": "Text that appears in Claude's context"
}
```

:::caution[Fail Closed for Safety Hooks]
Safety-critical hooks (like the dangerous-command-blocker) should fail closed: if JSON parsing fails or an unexpected error occurs, exit with code 2 to block the operation rather than code 0 to allow it.
:::

## Creating Your First Hook

Here is a step-by-step example of creating a PreToolUse hook that blocks shell commands containing `sudo`:

### Step 1: Write the Script

Create `scripts/block-sudo.py` in your plugin directory:

```python
#!/usr/bin/env python3
"""Block any bash command that uses sudo."""

import json
import sys

def main():
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError):
        # Fail closed: block if we can't parse the input
        print(json.dumps({
            "decision": "block",
            "message": "Hook error: could not parse input"
        }))
        sys.exit(2)

    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {})

    if tool_name != "Bash":
        sys.exit(0)

    command = tool_input.get("command", "")
    if "sudo" in command.split():
        print(json.dumps({
            "decision": "block",
            "message": "Blocked: sudo is not allowed in this environment"
        }))
        sys.exit(2)

    sys.exit(0)

if __name__ == "__main__":
    main()
```

### Step 2: Register the Hook

Add the hook to your plugin's `hooks/hooks.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ${CLAUDE_PLUGIN_ROOT}/scripts/block-sudo.py",
            "timeout": 3
          }
        ]
      }
    ]
  }
}
```

### Step 3: Test It

Start a Claude Code session and try a command with `sudo`. The hook should block it with your custom message.

## Hook Execution Order

When multiple plugins register hooks for the same point:

1. Hooks execute in plugin registration order (as listed in `settings.json` `enabledPlugins`)
2. **PreToolUse:** If _any_ hook blocks (exit 2), the tool does not execute. Remaining hooks are skipped.
3. **PostToolUse and Stop:** All hooks execute regardless of individual results. One hook's failure does not prevent others from running.
4. **Within a plugin:** Hooks listed in the same array execute sequentially in order.

## Built-in Hook Summary

Here is a quick reference of all hooks registered by CodeForge's default plugins:

| Plugin | Hook Point | Script | Purpose |
|--------|-----------|--------|---------|
| agent-system | PreToolUse (Task) | `redirect-builtin-agents.py` | Swap built-in agents for enhanced custom agents |
| agent-system | SubagentStart | `inject-cwd.py` | Inject working directory into subagent context |
| agent-system | TeammateIdle | `teammate-idle-check.py` | Check incomplete tasks before teammate shutdown |
| agent-system | TaskCompleted | `task-completed-check.py` | Run test suite after task completion |
| auto-code-quality | PostToolUse (Edit\|Write) | `collect-edited-files.py` | Track edited files for batch processing |
| auto-code-quality | PostToolUse (Edit\|Write) | `syntax-validator.py` | Validate syntax of written files |
| auto-code-quality | Stop | `format-on-stop.py` | Batch format all edited files |
| auto-code-quality | Stop | `lint-file.py` | Batch lint all edited files |
| auto-code-quality | Stop | `advisory-test-runner.py` | Run affected tests |
| session-context | SessionStart | `git-state-injector.py` | Inject git branch, status, recent commits |
| session-context | SessionStart | `todo-harvester.py` | Surface TODO/FIXME comments |
| session-context | Stop | `commit-reminder.py` | Remind about uncommitted changes |
| dangerous-command-blocker | PreToolUse (Bash) | `block-dangerous.py` | Block destructive bash commands |
| protected-files-guard | PreToolUse (Edit\|Write) | `guard-protected.py` | Block edits to sensitive files |
| protected-files-guard | PreToolUse (Bash) | `guard-protected-bash.py` | Block bash writes to sensitive paths |
| workspace-scope-guard | PreToolUse (Read\|Write\|Edit\|NotebookEdit\|Glob\|Grep\|Bash) | `guard-workspace-scope.py` | Block operations outside project directory |
| workspace-scope-guard | PreToolUse | `inject-workspace-cwd.py` | Inject working directory context |
| workspace-scope-guard | SessionStart | `inject-workspace-cwd.py` | Inject working directory at session start |
| workspace-scope-guard | UserPromptSubmit | `inject-workspace-cwd.py` | Inject working directory on prompt |
| workspace-scope-guard | SubagentStart | `inject-workspace-cwd.py` | Inject working directory for subagents |
| spec-workflow | Stop | `spec-reminder.py` | Remind about spec updates after code changes |
| skill-engine | UserPromptSubmit | `skill-suggester.py` | Suggest relevant skills based on prompt content |
| ticket-workflow | UserPromptSubmit | `ticket-linker.py` | Auto-fetch GitHub issues/PRs from `#123` references |
| notify-hook | Stop | (bell/OSC) | Desktop notification when Claude finishes |

## Related

- [Plugins](../plugins/) -- plugins that register hooks
- [Configuration](./configuration/) -- hook configuration and plugin toggles
- [Agent System](../plugins/agent-system/) -- agent-specific hooks for redirection and team quality gates
- [Architecture](../reference/architecture/) -- how hooks fit into the overall system pipeline
