# Writing Effective Claude Code Subagents

A consolidated research brief for designing production-quality subagents. Sources are official Anthropic documentation, Anthropic's engineering blog, Anthropic's actual internal agent system prompts (reverse-engineered), and the best community guides as of May 2026.

---

## TL;DR — One-paragraph handoff

Build subagents per [the official docs](https://code.claude.com/docs/en/sub-agents). Treat the `description` field as a **routing rule** starting with "Use proactively/MUST BE USED when…" — not as a label. Always explicitly set `tools:` (omitting it inherits everything from the parent). System prompts: second-person, numbered process, required output format, explicit constraints repeated at start and end, **no references to conversation history** (subagents start fresh with zero parent context). Default read-only agents to Haiku. Study Anthropic's own internal prompts at [Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts) as templates — they're reproduced verbatim in this doc. Read [Anthropic's multi-agent research blog](https://www.anthropic.com/engineering/multi-agent-research-system) for the eight prompt-engineering principles. Don't use subagents for tightly-coupled multi-layer code work — they shine for isolated, high-volume, or parallelizable tasks.

---

## Source tiers

### Tier 1 — Canonical, must-read

1. [Create custom subagents — official Claude Code docs](https://code.claude.com/docs/en/sub-agents) — definitive reference: frontmatter schema, scope/priority rules, tool scoping, model resolution, hooks, memory, permission modes, fork mode, four worked examples.
2. [Best practices for Claude Code — official docs](https://code.claude.com/docs/en/best-practices) — context management, the Writer/Reviewer pattern, fan-out across files, named failure patterns.
3. [How we built our multi-agent research system — Anthropic engineering blog](https://www.anthropic.com/engineering/multi-agent-research-system) — Anthropic's own production lessons: eight prompt engineering principles, common failure modes, why multi-agent outperforms single-agent by 90.2%, when NOT to use multi-agent.
4. [Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts) — Anthropic's actual internal agent system prompts, reverse-engineered per Claude Code version. Reproduced verbatim below.
5. [Subagents in the Agent SDK — official](https://platform.claude.com/docs/en/agent-sdk/subagents) — if building via SDK rather than markdown files.

### Tier 2 — Useful supporting reads

- [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) — 131+ production agents across 10 categories. Best for studying frontmatter and prompt structure at scale.
- [wshobson/agents](https://github.com/wshobson/agents) — 185 agents + 16 orchestrators in plugin form. Notes the PluginEval anti-pattern taxonomy.
- [Builder.io: Claude Code Subagents](https://www.builder.io/blog/claude-code-subagents) — strong on the description-field-as-router framing.
- [PubNub: Best practices for Claude Code subagents](https://www.pubnub.com/blog/best-practices-for-claude-code-sub-agents/) — HITL gates, permission hygiene, handoff rules.
- [Anthropic Skilljar: Introduction to subagents](https://anthropic.skilljar.com/introduction-to-subagents) — Anthropic's training course.
- [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) — curated index of skills, hooks, slash-commands, and agent orchestrators.
- [Prompting best practices — Claude API docs](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) — applies fully to agent system prompts.

### Tier 3 — Skim if time permits

- [Nimbalyst: Practical 2026 Guide](https://nimbalyst.com/blog/claude-code-subagents-guide/)
- [Developers Digest: 2026 Playbook](https://www.developersdigest.tech/blog/claude-code-agent-teams-subagents-2026)
- [Shipyard Quickstart](https://shipyard.build/blog/claude-code-subagents-guide/)
- [Sathish Raju Medium guide](https://medium.com/@sathishkraju/claude-code-subagents-the-complete-guide-to-ai-agent-delegation-d0a9aba419d0)
- [Rick Hightower on coordination patterns](https://medium.com/@richardhightower/claude-code-subagents-and-main-agent-coordination-a-complete-guide-to-ai-agent-delegation-patterns-a4f88ae8f46c)
- [ofox.ai complete guide](https://ofox.ai/blog/claude-code-hooks-subagents-skills-complete-guide-2026/)
- [MindStudio workflow patterns](https://www.mindstudio.ai/blog/claude-code-agentic-workflow-patterns)

---

## Authoritative reference: frontmatter schema

From the [official subagent docs](https://code.claude.com/docs/en/sub-agents):

| Field | Required | Purpose |
|---|---|---|
| `name` | yes | lowercase + hyphens, ≤ 64 chars. **Must NOT contain "anthropic" or "claude" (reserved).** This is the routing identifier. |
| `description` | yes | The routing rule. ≤ 1024 chars. Tells Claude when to delegate. |
| `tools` | no | Allowlist. **Omit = inherit ALL tools from parent (dangerous default).** |
| `disallowedTools` | no | Denylist. Applied before `tools`. A tool in both is removed. |
| `model` | no | `sonnet` / `opus` / `haiku` / full model ID / `inherit`. Default: `inherit`. |
| `permissionMode` | no | `default` / `acceptEdits` / `auto` / `dontAsk` / `bypassPermissions` / `plan` |
| `maxTurns` | no | Stop after N agentic turns. |
| `skills` | no | Skills to preload (full content injected at startup). |
| `mcpServers` | no | Scoped MCP server access. Inline definitions connect only for this subagent. |
| `hooks` | no | Lifecycle hooks scoped to this subagent. |
| `memory` | no | `user` / `project` / `local` — persistent learning across sessions. |
| `effort` | no | `low` / `medium` / `high` / `xhigh` / `max`. |
| `isolation` | no | `worktree` for isolated git checkout. |
| `background` | no | Default-run-in-background flag. |
| `color` | no | UI display color. |
| `initialPrompt` | no | Auto-submitted first user turn when agent runs as main session (`--agent` flag). |

### Scope precedence (high → low)

1. Managed settings (org-wide)
2. `--agents` CLI flag (current session)
3. `.claude/agents/` (current project)
4. `~/.claude/agents/` (your user)
5. Plugin's `agents/` directory

**When names collide, the higher-priority location wins.** Naming a custom agent `explore`, `plan`, or `general-purpose` overrides the built-in.

### Hard constraints often missed

- Subagent files are **loaded at session start only**. Edit on disk → restart session. Files created via `/agents` take effect immediately.
- Subagents **cannot spawn other subagents.** No nested delegation. Chain from the main thread, use forks, or use Skills instead.
- Plugin subagents **do not support** `hooks`, `mcpServers`, or `permissionMode` (security restriction).
- Permission mode parent-precedence:
  - Parent in `bypassPermissions` → subagent inherits (cannot tighten)
  - Parent in `acceptEdits` → subagent inherits (cannot override)
  - Parent in `auto` → subagent inherits auto; its own `permissionMode` is ignored
  - **To force read-only reliably: use `tools:` allowlist, not `permissionMode: plan`.** The allowlist cannot be overridden.
- Subagent transcripts persist independently at `~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl` and survive main-conversation compaction.
- Auto-compaction triggers at ~95% context capacity. Override via `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`.
- The `Task` tool was renamed to `Agent` in v2.1.63. Both names still work as aliases.

---

## The Gold: Anthropic's Internal Agent System Prompts (verbatim)

These are the actual prompts shipping inside Claude Code. **Study these as templates. They reveal Anthropic's own style.**

### 1. The "Explore" subagent — read-only codebase search

Model: `haiku`. Disallows: `Agent`, `ExitPlanMode`, `Edit`, `Write`, `NotebookEdit`.

```
You are a file search specialist for Claude Code, Anthropic's official CLI for Claude. You excel at thoroughly navigating and exploring codebases.

=== CRITICAL: READ-ONLY MODE - NO FILE MODIFICATIONS ===
This is a READ-ONLY exploration task. You are STRICTLY PROHIBITED from:
- Creating new files (no Write, touch, or file creation of any kind)
- Modifying existing files (no Edit operations)
- Deleting files (no rm or deletion)
- Moving or copying files (no mv or cp)
- Creating temporary files anywhere, including /tmp
- Using redirect operators (>, >>, |) or heredocs to write to files
- Running ANY commands that change system state

Your role is EXCLUSIVELY to search and analyze existing code. You do NOT have access to file editing tools - attempting to edit files will fail.

Your strengths:
- Rapidly finding files using glob patterns
- Searching code and text with powerful regex patterns
- Reading and analyzing file contents

Guidelines:
- Use Glob for file discovery
- Use Grep for code search
- Use Read when you know the specific file path you need to read
- Use Bash ONLY for read-only operations (ls, git status, git log, git diff, find, grep, cat, head, tail)
- NEVER use Bash for: mkdir, touch, rm, cp, mv, git add, git commit, npm install, pip install, or any file creation/modification
- Adapt your search approach based on the thoroughness level specified by the caller
- Communicate your final report directly as a regular message - do NOT attempt to create files

NOTE: You are meant to be a fast agent that returns output as quickly as possible. In order to achieve this you must:
- Make efficient use of the tools that you have at your disposal: be smart about how you search for files and implementations
- Wherever possible you should try to spawn multiple parallel tool calls for grepping and reading files

Complete the user's search request efficiently and report your findings clearly.
```

**Lessons:** CAPS for hard constraints. Explicit allow/deny lists. "Don't try to write a report file — respond directly." Parallel tool use is explicitly requested. Haiku for speed.

### 2. The "general-purpose" subagent — multi-step research and modification

```
You are an agent for Claude Code, Anthropic's official CLI for Claude. Given the user's message, you should use the tools available to complete the task. Complete the task fully—don't gold-plate, but don't leave it half-done. When you complete the task, respond with a concise report covering what was done and any key findings — the caller will relay this to the user, so it only needs the essentials.

Your strengths:
- Searching for code, configurations, and patterns across large codebases
- Analyzing multiple files to understand system architecture
- Investigating complex questions that require exploring many files
- Performing multi-step research tasks

Guidelines:
- For file searches: search broadly when you don't know where something lives. Use Read when you know the specific file path.
- For analysis: Start broad and narrow down. Use multiple search strategies if the first doesn't yield results.
- Be thorough: Check multiple locations, consider different naming conventions, look for related files.
- NEVER create files unless they're absolutely necessary for achieving your goal. ALWAYS prefer editing an existing file to creating a new one.
- NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested.
```

**Lessons:** "Don't gold-plate, but don't leave it half-done" — directly addresses the over/under-completion failure mode. "The caller will relay this to the user" — explicitly sets report shape. NEVER-rules in CAPS.

### 3. The "Plan" subagent — architecture and planning

Model: `inherit`. Disallows: `Agent`, `ExitPlanMode`, `Edit`, `Write`, `NotebookEdit`.

```
You are a software architect and planning specialist for Claude Code. Your role is to explore the codebase and design implementation plans.

=== CRITICAL: READ-ONLY MODE - NO FILE MODIFICATIONS ===
[same read-only block as Explore]

You will be provided with a set of requirements and optionally a perspective on how to approach the design process.

## Your Process

1. Understand Requirements: Focus on the requirements provided and apply your assigned perspective throughout the design process.

2. Explore Thoroughly:
   - Read any files provided to you in the initial prompt
   - Find existing patterns and conventions using Glob, Grep, and Read
   - Understand the current architecture
   - Identify similar features as reference
   - Trace through relevant code paths

3. Design Solution:
   - Create implementation approach based on your assigned perspective
   - Consider trade-offs and architectural decisions
   - Follow existing patterns where appropriate

4. Detail the Plan:
   - Provide step-by-step implementation strategy
   - Identify dependencies and sequencing
   - Anticipate potential challenges

## Required Output

End your response with:

### Critical Files for Implementation
List 3-5 files most critical for implementing this plan:
- path/to/file1.ts
- path/to/file2.ts
- path/to/file3.ts

REMEMBER: You can ONLY explore and plan. You CANNOT and MUST NOT write, edit, or modify any files. You do NOT have access to file editing tools.
```

**Lessons:** Numbered process. Required output format with example structure. Constraints bookended — repeated at start AND end.

### 4. The "Worker fork" prompt — single-directive executor

```
You are a worker fork. The transcript above is the parent's history — inherited reference, not your situation. You are NOT a continuation of that agent. Execute ONE directive, then stop.

Hard rules:
- Do NOT spawn sub-agents. The "default to forking" guidance in your system prompt is for the parent; you ARE the fork, execute directly.
- One shot: report once and stop. No follow-up questions, no proposed next steps, no waiting for the user.

Guidelines (your directive may override any of these):
- Stay in scope. Other forks may be handling adjacent work; if you spot something outside your directive, note it in a sentence and move on.
- Open with one line restating your task, so the parent can spot scope drift at a glance.
- Be concise — as short as the answer allows, no shorter. Plain text, no preamble, no meta-commentary.
- If you committed changes, list the paths and commit hashes in your report.
```

**Lessons:** "Open with one line restating your task" catches scope drift. "As short as the answer allows, no shorter." Explicit scope-discipline language.

### 5. The "Agent creation architect" — Anthropic's meta-prompt for generating new agents

This is the prompt Claude uses when you ask it to *create* a new agent. **It's the playbook.**

```
You are an elite AI agent architect specializing in crafting high-performance agent configurations. Your expertise lies in translating user requirements into precisely-tuned agent specifications that maximize effectiveness and reliability.

When a user describes what they want an agent to do, you will:

1. Extract Core Intent: Identify the fundamental purpose, key responsibilities, and success criteria for the agent. Look for both explicit requirements and implicit needs.

2. Design Expert Persona: Create a compelling expert identity that embodies deep domain knowledge relevant to the task. The persona should inspire confidence and guide the agent's decision-making approach.

3. Architect Comprehensive Instructions: Develop a system prompt that:
   - Establishes clear behavioral boundaries and operational parameters
   - Provides specific methodologies and best practices for task execution
   - Anticipates edge cases and provides guidance for handling them
   - Incorporates any specific requirements or preferences mentioned by the user
   - Defines output format expectations when relevant
   - Aligns with project-specific coding standards and patterns from CLAUDE.md

4. Optimize for Performance:
   - Decision-making frameworks appropriate to the domain
   - Quality control mechanisms and self-verification steps
   - Efficient workflow patterns
   - Clear escalation or fallback strategies

5. Create Identifier:
   - Uses lowercase letters, numbers, and hyphens only
   - Is typically 2-4 words joined by hyphens
   - Clearly indicates the agent's primary function
   - Memorable and easy to type
   - Avoids generic terms like "helper" or "assistant"

6. Example agent descriptions — in the 'whenToUse' field include examples of when this agent should be used in <example>...<commentary>...</commentary></example> form, showing the assistant invoking the Agent tool. If the user implied the agent should be used proactively, include proactive examples.

Output: a valid JSON object with: identifier, whenToUse, systemPrompt (written in second person).

Key principles for system prompts:
- Be specific rather than generic - avoid vague instructions
- Include concrete examples when they would clarify behavior
- Balance comprehensiveness with clarity - every instruction should add value
- Ensure the agent has enough context to handle variations of the core task
- Make the agent proactive in seeking clarification when needed
- Build in quality assurance and self-correction mechanisms

The agents you create should be autonomous experts capable of handling their designated tasks with minimal additional guidance. Your system prompts are their complete operational manual.
```

---

## Anthropic's eight prompt engineering principles (from the multi-agent blog)

From [the engineering writeup](https://www.anthropic.com/engineering/multi-agent-research-system) on building Claude's research system:

1. **Think like your agents** — simulate prompt execution step-by-step to find failure modes before deploying.
2. **Teach orchestration** — lead agents need detailed task descriptions: objectives, output formats, tool guidance, boundaries. *"Simple instructions like 'research the semiconductor shortage' proved inadequate, leading to duplicated work and misinterpreted tasks."*
3. **Scale effort appropriately** — embed scaling rules in prompts. Simple fact-finding = 1 agent, 3–10 tool calls. Complex work = 10+ subagents.
4. **Prioritize tool design** — *"Agent-tool interfaces are as critical as human-computer interfaces."*
5. **Enable self-improvement** — Claude can diagnose its own failures. One self-improvement loop on tool descriptions cut subsequent agent completion time by 40%.
6. **Start wide, then narrow** — broad query → drill into specifics.
7. **Guide thinking processes** — use extended thinking as a controllable planning scratchpad; instruct subagents to use interleaved thinking after tool results.
8. **Parallelize tool calling** — 3–5 parallel subagents + 3+ parallel tools per subagent cut research time up to 90%.

**Headline result:** Opus-lead + Sonnet-subagents outperformed single-agent Opus by **90.2%** on internal evaluations. Token usage explained 80% of the variance. Multi-agent systems consume ~15× more tokens than chat, so reserve them for high-value tasks.

---

## The `description` field — your single biggest leverage point

The `description` field is **a routing rule, not a label**. Every source converges on this.

### What governs auto-delegation

From official docs: *"Claude automatically delegates tasks based on the task description in your request, the description field in subagent configurations, and current context. To encourage proactive delegation, include phrases like 'use proactively' in your subagent's description field."*

### Anatomy of a good description

Start with **when** (the trigger), then **what** (the capability), then a **boost phrase**:

```
[WHEN] Use proactively after the user writes or modifies code.
[WHAT] Reviews the diff for bugs, security issues, and missing tests.
```

Anthropic's official example:
```
description: Expert code review specialist. Proactively reviews code for quality, security, and maintainability. Use immediately after writing or modifying code.
```

### Boost phrases that increase auto-delegation

- `Use proactively`
- `Use immediately after…`
- `MUST BE USED when…`
- `Use after [specific trigger]`

### Description anti-patterns

| Bad | Why | Fix |
|---|---|---|
| `Code review agent` | No trigger, generic | Add WHEN + use proactively |
| `Helps with security` | What, not when | Reframe around triggers |
| `Use when you need a second opinion on auth` | Assumes conversation context | Use objective triggers |
| `frontend-engineer` | Role label, not job-shaped | Use `repo-explorer`, `test-runner`, `auth-reviewer` |
| Over-specific: `Use only on TypeScript files >50 lines` | Brittle | Broaden the trigger |

**Debugging tip:** If your agent isn't being auto-invoked, fix the description first. Tweak the prompt body second.

---

## Tool scoping rules

### Default behavior is dangerous

**If you omit `tools`, the subagent inherits everything from the main session.** This is the most common misconfiguration. Be intentional.

### Standard tool combinations

| Agent type | Tools | Notes |
|---|---|---|
| Read-only reviewer / auditor / explorer | `Read, Grep, Glob` | Add `Bash` only with a `PreToolUse` validation hook. |
| Research / web | `Read, Grep, Glob, WebFetch, WebSearch` | |
| Code writer | `Read, Write, Edit, Bash, Glob, Grep` | The standard implementer load-out. |
| Documentation | `Read, Write, Edit, Glob, Grep, WebFetch, WebSearch` | |
| Test runner | `Bash, Read, Grep` | Execute + read results. |

### Allowlist vs denylist

- `tools:` → strict allowlist (only listed tools work).
- `disallowedTools:` → denylist (inherit everything except listed).
- Both present: `disallowedTools` applied first, then `tools` resolved against remainder.

### Restricting Bash with PreToolUse hooks (defense in depth)

For read-only SQL access or any conditional command restriction, layer a `PreToolUse` hook on top of the tool allowlist. The official docs ship a complete example for SQL read-only:

```yaml
---
name: db-reader
description: Execute read-only database queries
tools: Bash
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-readonly-query.sh"
---
```

The hook script reads JSON from stdin, extracts the command, and exits with code 2 to block writes.

### Restricting subagent spawning

When an agent runs as the main session (`claude --agent <name>`), it can spawn subagents via the `Agent` tool. To restrict which types:

```yaml
tools: Agent(worker, researcher), Read, Bash
```

To allow any: `tools: Agent, Read, Bash`. To block all: omit `Agent`.

**Subagents themselves cannot spawn subagents** — this restriction only applies to agents running as the main thread.

### Global deny

```json
{
  "permissions": {
    "deny": ["Agent(Explore)", "Agent(my-custom-agent)"]
  }
}
```

---

## Model selection

| Model | Cost vs Sonnet | Speed | Best for |
|---|---|---|---|
| `haiku` | ~0.33× | Fastest | Read-only analysis, exploration, simple validations. Anthropic uses it for the built-in Explore agent. |
| `sonnet` | 1× (baseline) | Balanced | Default for general work — code review, debugging, test running. |
| `opus` | ~2× | Slowest | Architecture, security policy validation, multi-domain reasoning. |
| `inherit` | matches parent | varies | Default behavior when `model` is omitted. |

### Model resolution precedence (high → low)

1. `CLAUDE_CODE_SUBAGENT_MODEL` environment variable
2. Per-invocation `model` parameter (SDK only)
3. Subagent definition's `model` frontmatter
4. Main conversation's model

### Practical pattern

```yaml
# Fast exploration
model: haiku

# Most everyday work
model: sonnet

# Deep reasoning, architecture, security
model: opus
```

**Test with all target models.** Per official guidance: what works perfectly for Opus may need more detail for Haiku.

---

## Context isolation — what subagents see and don't see

**This is the most important thing to internalize.** Subagents start fresh.

From official docs: *"Subagents receive only this system prompt (plus basic environment details like working directory), not the full Claude Code system prompt."*

| Subagent receives | Subagent does NOT receive |
|---|---|
| Its own system prompt (the markdown body) | Parent's conversation history |
| Project CLAUDE.md (loaded normally) | Parent's system prompt |
| Tool definitions (inherited or restricted) | Parent's prior tool calls or results |
| The Agent tool prompt string passed at invocation | Preloaded skill content (unless in `skills:` field) |

### Implications for prompt design

- **Never write "as we discussed earlier" or "based on our agreement."** They didn't have the discussion.
- **The caller must brief the subagent like a new colleague.** File paths, findings, constraints, partial results — all in the invocation prompt.
- **Working directory:** subagent starts in main session's CWD. `cd` doesn't persist across its own Bash calls and doesn't affect the parent.

### The exception: forks

Experimental, enabled via `CLAUDE_CODE_FORK_SUBAGENT=1`. Forks inherit the entire parent conversation. Use when:
- A named subagent would need too much background context to be useful
- You want to try several approaches in parallel from the same starting point
- You want to share the parent's prompt cache (cheaper than fresh spawn)

Spawn via `/fork <directive>` or via the Agent tool when fork mode is enabled.

---

## Invocation patterns

### Auto-delegation
No special syntax. Claude reads your prompt and the subagent's `description`, then decides whether to delegate. Quality of description determines reliability.

### Natural language naming
```
Use the test-runner subagent to fix failing tests
Have the code-reviewer subagent look at my recent changes
```
Claude usually delegates, but not guaranteed.

### @-mention (guaranteed)
```
@"code-reviewer (agent)" look at the auth changes
```
Type `@` and pick from the typeahead. Manual form: `@agent-<name>` or `@agent-<plugin>:<name>`.

### Session-wide (full takeover)
```bash
claude --agent code-reviewer
```
The whole session uses that subagent's system prompt, tool restrictions, and model. Persists across resumes. Set in `.claude/settings.json` to make project default:
```json
{ "agent": "code-reviewer" }
```

### Parallel subagents

```
Research the authentication, database, and API modules in parallel using separate subagents
```

Each runs in its own context window. Warning: results all return to the main conversation. Detailed results × many subagents = context blow-up. For sustained parallelism, use Agent Teams instead (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`).

### Chaining
```
Use the code-reviewer subagent to find performance issues, then use the optimizer subagent to fix them
```
Each completes and returns; Claude passes relevant context to the next.

### Resuming subagents

When agent teams are enabled, you can resume a subagent via its `agentId` using `SendMessage`. The subagent retains full prior tool calls and reasoning. Useful for multi-stage workflows. Find IDs at `~/.claude/projects/{project}/{sessionId}/subagents/`.

---

## Common failure modes (cited)

### From official best practices

1. **The kitchen sink session** — mixing tasks pollutes context. → `/clear` between unrelated work.
2. **Correcting over and over** — after two failed corrections, context is poisoned. → `/clear` and restart with a better prompt.
3. **Over-specified CLAUDE.md** — rules get lost in noise. → prune ruthlessly.
4. **Trust-then-verify gap** — plausible-looking code that fails edge cases. → always provide verification (tests, scripts, screenshots).
5. **Infinite exploration** — unbounded "investigate X" prompts. → scope narrowly OR delegate to a subagent so bloat stays out of main context.

### From Anthropic's multi-agent post-mortem

Early agent prototypes:
- Spawned 50 subagents for simple queries
- Searched endlessly for nonexistent sources
- Kept searching after they had enough information
- Used overly verbose search queries
- Picked SEO content farms over authoritative sources
- Duplicated work across subagents because task descriptions were vague

### From wshobson's PluginEval taxonomy

`OVER_CONSTRAINED`, `EMPTY_DESCRIPTION`, `MISSING_TRIGGER`, `BLOATED_SKILL`, `ORPHAN_REFERENCE`, `DEAD_CROSS_REF`.

### Failure mode → fix table

| Symptom | Root cause | Fix |
|---|---|---|
| Agent never auto-invokes | Vague description | Rewrite with WHEN + trigger phrases |
| Agent has no context to work with | Forgot subagents start fresh | Pack context into the Agent tool prompt |
| Agent accidentally modifies files | Over-broad tool access | Use `tools:` allowlist |
| Works on Opus, fails on Haiku | Prompt assumes reasoning capacity | Add detail / test on weaker models |
| Permission prompts everywhere | Permission boundaries missing | Set `permissionMode` and `tools` intentionally |
| File added but agent not loading | Loaded only at session start | Restart session |
| Inherits unwanted mode from parent | `bypassPermissions`/`acceptEdits` precedence | Use tool restrictions instead of permission mode |

---

## Anti-patterns vs proven patterns

### Anti-patterns (do NOT do)

- ❌ Empty or generic `description` ("frontend agent", "helper")
- ❌ Description that describes WHAT, not WHEN
- ❌ Omitting `tools` and inheriting everything by accident
- ❌ Prompts that reference conversation history ("as we discussed…")
- ❌ Prompts that don't define an output format
- ❌ Treating subagents as orchestrators (they can't spawn subagents)
- ❌ Using subagents for tightly-coupled multi-layer changes
- ❌ Over-long system prompts where critical rules get lost
- ❌ No verification criteria — agent declares done without proof
- ❌ Spawning multiple verbose subagents in parallel (context blows up on return)
- ❌ Sycophantic prompts — LLMs default agreeable; explicitly tell agents to "be honest" / "be critical" / "be realistic"
- ❌ Meta-instructions about Claude itself ("you are Claude…") — wasted tokens
- ❌ Names containing "anthropic" or "claude" (reserved)

### Proven patterns (do)

- ✅ Action-oriented description: `Use proactively after the user writes or modifies code. Reviews the diff for bugs and missing tests.`
- ✅ Numbered process in the prompt body (Anthropic's own Plan agent does this)
- ✅ Required output format with example structure
- ✅ Constraint bookending — repeat critical rules at start AND end
- ✅ Explicit "what NOT to do" sections with rationale
- ✅ Tell the agent to restate its task in one line (catches drift — from worker-fork prompt)
- ✅ "Don't gold-plate, but don't leave it half-done" framing (general-purpose)
- ✅ Parallel tool use instructions ("spawn multiple parallel tool calls")
- ✅ Read-only agents on Haiku for speed/cost
- ✅ Memory directories (`memory: project`) for cross-session learning
- ✅ Hooks for deterministic guarantees instead of advisory instructions
- ✅ Skills preload (`skills:` field) for domain context without runtime discovery
- ✅ Plugin packaging when sharing across teams
- ✅ Job-shaped names (`test-runner`, `repo-explorer`) over role labels (`frontend-engineer`)
- ✅ Use tool allowlist as the source of truth for read-only, not just `permissionMode`

---

## When NOT to use subagents

From Anthropic's engineering blog: *"Some domains that require all agents to share the same context or involve many dependencies between agents are not a good fit for multi-agent systems today. For instance, most coding tasks involve fewer truly parallelizable tasks than research."*

From Builder.io: don't split tightly-coupled feature work (schema + routes + UI + tests) across workers — the shared mental model fragments.

### Use the main conversation when

- The task needs frequent back-and-forth
- Multiple phases share significant context (planning → implementation → testing)
- The change is small/targeted
- Latency matters (subagents start fresh and take time to gather context)

### Use subagents when

- The task produces verbose output you don't need in main context
- You want to enforce specific tool restrictions or permissions
- The work is self-contained and can return a summary
- The investigation would otherwise consume too much main context
- You want parallel independent research streams

### Use Skills instead when

- You want reusable prompts/workflows that run in the main conversation context
- The work doesn't need isolated context

### Use Agent Teams instead when

- Workers need to communicate with each other mid-task
- You need sustained parallelism beyond what subagents support
- You need a team lead coordinating shared state

---

## Memory: persistent learning across sessions

Subagents can maintain memory across conversations via the `memory` field:

| Scope | Location | Use when |
|---|---|---|
| `user` | `~/.claude/agent-memory/<agent-name>/` | Learnings apply across all projects |
| `project` | `.claude/agent-memory/<agent-name>/` | Project-specific, share via git (recommended default) |
| `local` | `.claude/agent-memory-local/<agent-name>/` | Project-specific, do NOT check into git |

When enabled:
- The first 200 lines or 25KB of `MEMORY.md` (whichever first) is auto-injected at startup
- The subagent gets curation instructions to keep `MEMORY.md` trim
- Read, Write, and Edit tools are automatically enabled for memory management

### Memory usage pattern

In the system prompt, include something like:
```
Update your agent memory as you discover codepaths, patterns, library locations, and key architectural decisions. This builds up institutional knowledge across conversations. Write concise notes about what you found and where.
```

In invocations:
```
Review this PR. First, check your memory for patterns you've seen in this codebase.
```

After completion:
```
Now save what you learned to your memory.
```

---

## Pre-launch checklist

Run this checklist before shipping any subagent.

### Definition

- [ ] `name` is descriptive, lowercase-hyphenated, ≤ 64 chars
- [ ] `name` doesn't contain "anthropic" or "claude" (reserved)
- [ ] `description` ≤ 1024 chars
- [ ] `description` starts with WHEN, includes WHAT, has a trigger phrase (`Use proactively` / `Use immediately after…` / `MUST BE USED when…`)
- [ ] `description` is job-shaped (specific triggers), not role-shaped (generic labels)

### Tools

- [ ] `tools:` is **explicitly set** (not inherited by omission)
- [ ] Tool set matches the actual job (no over-provisioning)
- [ ] If Bash is present, you've considered a `PreToolUse` validation hook
- [ ] If file edits are not needed, `Edit` and `Write` are excluded

### Model and effort

- [ ] Model choice is justified (Haiku for fast/simple, Sonnet for general, Opus for hard reasoning)
- [ ] If using Haiku, you've tested that the prompt is detailed enough for it
- [ ] `effort` is set if you need higher reasoning than the default

### System prompt

- [ ] Length is in the 100–300 token range (or you have a reason to exceed)
- [ ] Opens with a clear role statement ("You are a [specialist] who…")
- [ ] Includes a numbered process or workflow
- [ ] Specifies required output format
- [ ] Constraints repeated at start AND end (bookending)
- [ ] No references to conversation history
- [ ] No meta-instructions about Claude itself
- [ ] Includes "be honest / be critical / be realistic" if applicable
- [ ] Tells the agent to restate its task in one line if scope drift is a risk

### Permissions

- [ ] `permissionMode` is intentional, not just default
- [ ] You understand parent precedence (`bypassPermissions` / `acceptEdits` / `auto` cannot be tightened)
- [ ] For read-only enforcement, you use tool allowlist as the primary mechanism

### Lifecycle and ops

- [ ] Hooks added for deterministic guarantees that prompts can't enforce
- [ ] `memory:` set if cross-session learning is wanted
- [ ] `isolation: worktree` if the agent should not touch the live checkout
- [ ] `background: true` if the agent should always run async
- [ ] File checked into version control if project-scoped
- [ ] Tested by invoking explicitly via `@-mention`
- [ ] Tested via auto-delegation (verify the description triggers)

### Smoke test

- [ ] Run a representative happy-path task and check the report shape
- [ ] Run an edge case (missing input, ambiguous request) and verify graceful behavior
- [ ] Confirm it doesn't try to spawn subagents
- [ ] Confirm it doesn't reference anything from a parent conversation

---

## Quick-handoff payload (paste into next session)

> Build subagents per `https://code.claude.com/docs/en/sub-agents`. Treat `description` as a routing rule starting with "Use proactively/MUST BE USED when…" not as a label. Always set `tools:` explicitly (omitting inherits everything). System prompts: second-person, 100–300 tokens, numbered process, required output format, constraints bookended start and end, no references to conversation history. Read-only agents on Haiku. Study Anthropic's own internal prompts at `github.com/Piebald-AI/claude-code-system-prompts` as templates. Read `anthropic.com/engineering/multi-agent-research-system` for the eight prompt-engineering principles. For read-only enforcement, use tool allowlist as primary mechanism (permission mode can be overridden by parent). Subagents start fresh with zero parent context — brief them like new colleagues in the invocation prompt. Don't use subagents for tightly-coupled multi-layer code work; they shine for isolated, high-volume, or parallelizable tasks.
