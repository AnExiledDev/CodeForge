# RTK (Rust Token Killer)

RTK is a transparent CLI proxy that compresses command output before it reaches your context window. It is active in this environment — Bash commands are automatically rewritten via a PreToolUse hook.

## What You Need to Know

- **You don't need to prefix commands with `rtk`** — the hook does this automatically
- Output you receive from Bash is already compressed (60-90% token savings)
- The original semantics are preserved; only verbose/redundant output is stripped

## Meta-Commands

These RTK-specific commands provide insight into compression behavior:

| Command | Purpose |
|---------|---------|
| `rtk gain` | Show token savings statistics for the current session |
| `rtk discover` | List all commands RTK can compress |
| `rtk status` | Show RTK version and configuration |
| `rtk telemetry status` | Verify telemetry is disabled |

## Important

- Do NOT confuse `rtk` (Rust Token Killer, rtk-ai/rtk) with the unrelated Rust Type Kit package
- If you need raw uncompressed output, use `command <cmd>` instead of `<cmd>` — the hook only rewrites the base command form
