# Agent & Skill Quality Rubric

> Compiled from Anthropic's official documentation, Claude Code subagent docs, skill authoring best practices, and industry research on LLM agent design patterns. This rubric drives the quality review of all agents in the `agent-system` plugin and skills in the `skill-engine` / `spec-workflow` plugins.

---

## 1. Key Principles from Anthropic

These principles come directly from Anthropic's official prompt engineering documentation for Claude 4.x models (Opus 4.6, Sonnet 4.5, Haiku 4.5).

### 1.1 Be Explicit and Specific

Claude 4.x models are trained for **precise instruction following**. They do what you ask — nothing more, nothing less. Vague prompts produce vague results. If you want thorough, above-and-beyond behavior, you must explicitly request it.

- **Bad**: "Review this code"
- **Good**: "Review this code for security vulnerabilities, performance issues, and readability. For each issue, explain the problem, show the current code, and provide a corrected version."

**Implication for agents**: Every agent prompt must clearly define what the agent should do, how it should do it, and what its output should look like. Do not rely on Claude inferring intent from vague instructions.

### 1.2 Provide Context and Motivation (Explain WHY)

Providing the *reason* behind instructions helps Claude generalize correctly. Instead of bare rules, explain the motivation.

- **Bad**: "NEVER use ellipses"
- **Good**: "Never use ellipses because your output will be read by a text-to-speech engine that cannot pronounce them."

**Implication for agents**: When an agent has constraints (e.g., "read-only"), briefly explain why. When an agent follows a particular workflow, explain the rationale so it can adapt intelligently to edge cases.

### 1.3 Be Vigilant with Examples and Details

Claude pays close attention to examples. Poorly constructed examples teach bad patterns. Examples should:
- Align precisely with desired behavior
- Cover edge cases and diverse scenarios
- Be wrapped in `<example>` tags for clarity
- Include 3-5 examples for complex tasks; 1 example for simple ones

### 1.4 Use XML Tags for Structure

Claude was trained on XML-tagged prompts. Tags like `<instructions>`, `<example>`, `<constraints>` prevent Claude from confusing instructions with context or examples with rules.

- Be **consistent** with tag names throughout the prompt
- **Nest** tags for hierarchical content: `<outer><inner></inner></outer>`
- **Refer** to tagged content by tag name: "Using the data in `<context>` tags..."
- There are no canonical "best" tag names — use names that make sense for the content they surround

### 1.5 Allow Uncertainty

Give Claude explicit permission to say "I don't know" rather than guessing. This reduces hallucinations, especially in research and diagnostic agents.

### 1.6 Tell Claude What TO Do, Not What NOT to Do

Positive framing is more effective than negative framing for behavioral steering:
- **Bad**: "Do not use markdown in your response"
- **Good**: "Write your response in smoothly flowing prose paragraphs."

**Exception**: Safety constraints (e.g., "NEVER modify files") should still use strong negative framing because the cost of violation is high.

### 1.7 Claude 4.x Is More Responsive to System Prompts

Claude Opus 4.5 and 4.6 are more responsive to system prompts than previous models. Aggressive language designed to prevent undertriggering in older models (e.g., "CRITICAL: You MUST...") may now cause **overtriggering**. Use calibrated, normal language unless the constraint is genuinely critical.

---

## 2. System Prompt Best Practices

### 2.1 Identity & Role

Role prompting is the single most powerful use of system prompts. The right role turns Claude from a generalist into a domain expert.

**Best practices**:
- Define the role in the **first line** of the prompt body. This sets the frame for everything that follows.
- Be **specific**: "You are a senior Python developer specializing in FastAPI and async patterns" beats "You are a coding assistant."
- Include **expertise level**: "senior", "expert", "specialist" signals the depth expected.
- Optionally include **personality traits** relevant to the task: "methodical", "thorough", "concise".
- The `description` field in YAML frontmatter is for Claude's **task routing** — it tells the parent agent *when* to delegate. The markdown body is the agent's **system prompt** — it tells the agent *how* to behave.

**Agent-specific guidance**:
- The `name` field must use lowercase letters and hyphens only
- The `description` field should clearly state: (a) what the agent does, and (b) when it should be used
- Write descriptions in **third person**: "Analyzes code for security vulnerabilities" not "I analyze code" or "Use this to analyze code"
- Include **trigger phrases** the user might say that should invoke this agent

### 2.2 Constraints & Boundaries

Constraints define what the agent **must not** do. They are safety rails.

**Best practices**:
- Group all hard constraints in a clearly labeled section (`## Critical Constraints` or similar)
- Use strong negative framing for safety-critical constraints: "**NEVER** modify any file"
- Be exhaustive — list every prohibited action category, not just one example
- Explain *why* the constraint exists when not obvious
- Keep constraints at the top of the prompt, before workflow instructions

**Common constraint categories for agents**:
- File system modifications (read-only agents)
- Service/process management (diagnostic agents)
- Package installation (sandboxed agents)
- Git state changes (research agents)
- Network requests (isolated agents)

### 2.3 Behavioral Rules

Behavioral rules define how the agent **should act** in different scenarios. They are the decision-making logic.

**Best practices**:
- Use **conditional dispatch**: "If X, do Y. If Z, do W." This helps Claude handle varied inputs.
- Cover the **common scenarios** the agent will encounter, including the "no input" case.
- Include **negative result reporting**: "Always report what was checked, even if nothing was found."
- Include **uncertainty handling**: "If you cannot determine the answer, say so and explain what additional information would help."
- Be specific about **scope escalation**: When should the agent go broad vs. narrow?

### 2.4 Examples & Few-Shot

Examples are the most effective way to communicate expected behavior.

**Best practices**:
- Wrap examples in `<example>` tags (multiple examples in `<examples>` parent tag)
- Include **input → output** pairs that show the complete workflow
- Provide **3-5 diverse examples** for complex agents, covering:
  - The happy path (typical input)
  - Edge cases (unusual input)
  - Error cases (bad input or no results)
- Ensure examples are **consistent** with all stated rules and constraints
- Examples should demonstrate the **output format** in action, not just describe it
- Place examples **after** the rules they illustrate, not before

### 2.5 Output Format Specification

A structured output format ensures the agent's results are predictable and parseable.

**Best practices**:
- Define a clear output template with named sections
- Use markdown headers (`###`) for top-level sections
- Use consistent formatting within sections (bullet lists, tables, etc.)
- Include a "Sources" or "Evidence" section that traces claims to specific files, URLs, or line numbers
- Specify what goes in each section so there's no ambiguity
- Match the output format to the consumer — if a human reads it, optimize for readability; if another tool parses it, optimize for structure

### 2.6 Tool Usage Guidance

Agents need explicit guidance on *how* to use their available tools effectively.

**Best practices**:
- Show concrete tool usage patterns with realistic commands/queries
- Specify tool selection logic: "Use Glob to discover files, then Grep to search content, then Read to examine specific files"
- Include command templates with placeholder values
- Warn about tool-specific pitfalls (e.g., "For large logs, always filter with Grep before reading. Never dump entire large files.")
- If the agent has Bash access, provide allowed command patterns and explicitly prohibit dangerous ones
- If tools have been restricted via `tools:` or `disallowedTools:`, the prompt should align with what's available — don't reference tools the agent can't use

---

## 3. Agent Definition Patterns

### 3.1 What Makes an Effective Agent

Based on Claude Code's subagent architecture and Anthropic's guidance:

1. **Single Responsibility**: Each agent should excel at one specific task domain. Don't create Swiss Army knife agents.
2. **Clear Delegation Signal**: The `description` must be specific enough that the parent agent knows *exactly* when to delegate. Include trigger phrases.
3. **Minimal Tool Surface**: Grant only the tools the agent needs. Read-only agents should not have Write/Edit. Diagnostic agents should not have file creation.
4. **Structured Workflow**: The prompt should define a clear, repeatable workflow — not just "do the thing." Steps should be numbered and conditional.
5. **Defined Output Contract**: The agent should always produce output in a predictable format, regardless of what it finds.
6. **Graceful Failure**: The agent should handle cases where it can't find what it's looking for, can't complete the task, or encounters errors. It should report these clearly rather than hallucinating.
7. **Context Efficiency**: Agents run in their own context window. Design prompts to be thorough but not wasteful. Every line should earn its place.

### 3.2 Common Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | Fix |
|---|---|---|
| **Vague description** ("Helps with code") | Parent agent can't decide when to delegate | Be specific: "Analyzes Python code for security vulnerabilities including OWASP Top 10, injection flaws, and authentication weaknesses" |
| **Missing constraints section** | Agent may modify files, install packages, or cause side effects | Add explicit `## Critical Constraints` section listing prohibited actions |
| **Overloaded prompt** (too many tasks) | Agent loses focus, produces inconsistent results | Split into multiple focused agents |
| **No output format** | Results vary wildly between invocations | Define a structured output template |
| **ALLCAPS SHOUTING throughout** | Claude 4.x overtriggers on aggressive language; creates noise | Reserve strong emphasis for genuinely critical safety constraints; use normal language elsewhere |
| **No examples** | Agent guesses at expected behavior | Add 2-3 concrete input→output examples |
| **Contradictory instructions** | Agent behavior becomes unpredictable | Review for internal consistency; have Claude check |
| **Tool references that don't match `tools:` field** | Agent tries to use unavailable tools | Audit prompt against YAML `tools:` list |
| **Assuming Claude knows project-specific things** | Hallucinated project details | Provide concrete context or instruct the agent to discover it |
| **No negative-result handling** | Agent hallucinates results when it finds nothing | Add explicit "report what you checked even if nothing was found" |
| **Time-sensitive content** | Becomes wrong as tools/APIs evolve | Use version-agnostic language or "old patterns" sections |

### 3.3 Structure & Organization

**Recommended agent file structure:**

```markdown
---
name: kebab-case-name
description: >-
  Third-person description of what the agent does and when to use it.
  Include trigger phrases users might say.
tools: List, Of, Allowed, Tools
model: sonnet | opus | haiku | inherit
color: display-color
---

# Agent Name

Opening paragraph: role definition, purpose, and key capability.

## Critical Constraints

Exhaustive list of prohibited actions with strong negative framing.

## Strategy / Workflow

Step-by-step procedure the agent follows. Use numbered phases.
Include conditional logic for different input types.

## Behavioral Rules

Conditional dispatch rules for different scenarios.
Include the "no input" and "error" cases.

## Output Format

Structured template for the agent's response.
Named sections with descriptions of what goes in each.

<example>
Concrete input→output example demonstrating the full workflow.
</example>

<example>
Second example covering a different scenario or edge case.
</example>
```

**Key structural principles:**
- Role definition comes first (sets the frame)
- Constraints come early (before workflow, so they're weighted heavily)
- Workflow is the longest section (the operational core)
- Output format provides the contract
- Examples come last (they demonstrate everything above in action)

---

## 4. Skill Content Best Practices

These are drawn directly from Anthropic's official [Skill Authoring Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices).

### 4.1 Core Principle: Conciseness

The context window is a shared resource. Every token in your skill competes with conversation history, system prompts, and other skills.

**Default assumption**: Claude is already very smart. Only add context Claude doesn't already have.

For each piece of information, ask:
- "Does Claude really need this explanation?"
- "Can I assume Claude knows this?"
- "Does this paragraph justify its token cost?"

**Bad**: 150 tokens explaining what PDFs are before showing how to extract text.
**Good**: 50 tokens showing the extraction code directly.

### 4.2 Technical Content Quality

**Best practices**:
- **Lead with the mental model**: Start with a concise explanation of how the technology works conceptually, then provide specifics.
- **Assume competence**: Don't explain basics Claude already knows. Focus on the non-obvious: gotchas, best practices, version-specific details, and patterns that differ from common assumptions.
- **Be opinionated**: Provide a default recommendation rather than listing multiple options. "Use pdfplumber for text extraction" beats "You can use pypdf, pdfplumber, PyMuPDF, or..."
- **Version-pin where it matters**: Specify versions for APIs with breaking changes. "Assume FastAPI 0.100+ with Pydantic v2" prevents confusion.
- **Provide escape hatches**: After the default, note alternatives for edge cases. "For scanned PDFs requiring OCR, use pdf2image with pytesseract instead."

### 4.3 Code Example Standards

- Show **realistic, runnable code** — not pseudocode
- Include **imports** — don't make Claude guess
- Use **type annotations** in Python examples
- Include **error handling** only when it illustrates a non-obvious pattern
- Keep examples **minimal but complete** — enough to copy-paste and run
- Use **consistent style** across all examples in a skill
- Comment only the non-obvious — don't explain what `import json` does

### 4.4 Reference Material Design (Progressive Disclosure)

Anthropic's recommended pattern: SKILL.md is the table of contents; detail files are chapters.

- Keep SKILL.md under **500 lines**
- Split large content into separate files referenced from SKILL.md
- Keep references **one level deep** (SKILL.md → reference file, not SKILL.md → file → file → file)
- For reference files over 100 lines, include a **table of contents** at the top
- Name files descriptively: `form_validation_rules.md` not `doc2.md`
- Organize by domain: `reference/finance.md`, `reference/sales.md`

### 4.5 Description Field

The `description` field is the **most critical field** for skill discovery. Claude uses it to choose the right skill from potentially 100+ available skills.

**Best practices**:
- Write in **third person** (injected into system prompt; inconsistent POV causes discovery problems)
- Include both **what the skill does** and **when to use it**
- Include **trigger phrases** the user might say (quoted phrases work well)
- Include **key terms** users might mention
- Be specific, not vague: "Extract text and tables from PDF files, fill forms, merge documents" not "Helps with documents"
- Maximum 1024 characters

### 4.6 Skill Anti-Patterns

| Anti-Pattern | Fix |
|---|---|
| Explaining basics Claude already knows | Delete the explanation; show code directly |
| Offering too many options without a default | Pick one default; mention alternatives as escape hatches |
| Deeply nested file references (3+ levels) | Keep all references one level from SKILL.md |
| Windows-style paths (`\`) | Always use forward slashes (`/`) |
| Time-sensitive information | Use "old patterns" sections or version-agnostic language |
| Inconsistent terminology | Pick one term and use it throughout |
| Vague description field | Be specific with trigger phrases and key terms |
| Over-verbose SKILL.md (>500 lines) | Split into referenced files |

---

## 5. Quality Checklist

Use this checklist when reviewing each agent definition and skill. Items marked with `[C]` are critical (must fix); items marked with `[R]` are recommended (should fix).

### Agent Definition Checklist

#### YAML Frontmatter
- [ ] `[C]` `name` uses lowercase letters and hyphens only
- [ ] `[C]` `description` is non-empty and describes both *what* and *when*
- [ ] `[C]` `description` is written in third person
- [ ] `[R]` `description` includes trigger phrases users might say
- [ ] `[C]` `tools` lists only the tools the agent actually needs (principle of least privilege)
- [ ] `[R]` `model` is explicitly set (not relying on inheritance when a specific model is better)
- [ ] `[R]` Read-only agents do NOT have Write, Edit, or NotebookEdit in their tools

#### Role & Identity
- [ ] `[C]` First line of body clearly defines the agent's role and expertise
- [ ] `[R]` Role is specific (includes domain, specialization, or expertise level)
- [ ] `[R]` No identity confusion (agent doesn't claim to be something its tools can't support)

#### Constraints
- [ ] `[C]` Has a clearly labeled constraints section if the agent has any restrictions
- [ ] `[C]` Constraints use strong negative framing ("**NEVER** modify any file")
- [ ] `[C]` All constraint categories are covered (not just one example)
- [ ] `[R]` Constraints are placed early in the prompt (before workflow)
- [ ] `[R]` Constraints are consistent with the `tools:` field (don't prohibit things already blocked by tool restrictions; don't allow things the tools can do but shouldn't)

#### Workflow / Strategy
- [ ] `[C]` Has a clear, numbered workflow or strategy section
- [ ] `[R]` Workflow includes conditional logic for different input types
- [ ] `[R]` Workflow specifies tool usage patterns with concrete commands/examples
- [ ] `[R]` Workflow has a logical ordering (discovery → analysis → synthesis → output)

#### Behavioral Rules
- [ ] `[R]` Covers the "no input" case (what to do when invoked without specific arguments)
- [ ] `[R]` Covers the "nothing found" case (what to report when investigation yields no results)
- [ ] `[C]` Includes uncertainty handling ("If you cannot determine..., say so explicitly")
- [ ] `[R]` Specifies scope behavior (when to go broad vs. narrow)

#### Output Format
- [ ] `[C]` Has a defined output format with named sections
- [ ] `[R]` Output format includes a sources/evidence section
- [ ] `[R]` Output format specifies what goes in each section
- [ ] `[R]` Output format is consistent with the agent's purpose

#### Examples
- [ ] `[R]` Has at least 2 concrete `<example>` blocks
- [ ] `[R]` Examples cover different scenarios (happy path + edge case)
- [ ] `[R]` Examples demonstrate the full workflow and output format
- [ ] `[R]` Examples are consistent with all stated rules and constraints

#### Prompt Quality
- [ ] `[C]` No contradictory instructions
- [ ] `[C]` No references to tools the agent can't access
- [ ] `[R]` Uses normal calibrated language (no ALLCAPS SHOUTING except for genuine safety constraints)
- [ ] `[R]` Provides motivation/context for non-obvious instructions
- [ ] `[R]` No time-sensitive content that will become outdated
- [ ] `[R]` Concise — every section earns its place in the context window

### Skill Checklist

#### YAML Frontmatter
- [ ] `[C]` `name` uses lowercase letters, numbers, and hyphens only (max 64 chars)
- [ ] `[C]` `description` is specific, includes trigger phrases, written in third person
- [ ] `[C]` `description` includes both what the skill does and when to use it
- [ ] `[R]` `description` under 1024 characters

#### Content Quality
- [ ] `[C]` SKILL.md body under 500 lines
- [ ] `[C]` Starts with a mental model or conceptual overview (not basic explanations)
- [ ] `[R]` Assumes Claude's existing knowledge — doesn't over-explain basics
- [ ] `[R]` Is opinionated — provides defaults, not lists of equal options
- [ ] `[R]` Uses consistent terminology throughout

#### Code Examples
- [ ] `[C]` Code examples are realistic and runnable (not pseudocode)
- [ ] `[C]` Code examples include imports
- [ ] `[R]` Code uses type annotations (Python)
- [ ] `[R]` Code follows modern patterns for the specified versions
- [ ] `[R]` Comments explain only non-obvious logic

#### Reference Architecture
- [ ] `[R]` Additional detail files referenced from SKILL.md (if content exceeds 500 lines)
- [ ] `[R]` All references are one level deep from SKILL.md
- [ ] `[R]` Long reference files have a table of contents
- [ ] `[R]` Files named descriptively

#### Robustness
- [ ] `[R]` No time-sensitive content
- [ ] `[R]` No Windows-style paths
- [ ] `[R]` Dependencies are explicitly listed
- [ ] `[R]` Works across Haiku, Sonnet, and Opus (not over-reliant on one model's capabilities)

---

## 6. Severity Classification for Issues

When reporting issues during review, classify them as follows:

| Severity | Definition | Action |
|---|---|---|
| **P0 — Critical** | Incorrect constraints, tool list mismatch, contradictory instructions, security risk (e.g., write-capable tools on a "read-only" agent) | Must fix before merge |
| **P1 — High** | Missing constraints section, no output format, vague description that breaks delegation, no behavioral rules | Should fix before merge |
| **P2 — Medium** | Missing examples, suboptimal workflow ordering, verbose explanations, inconsistent terminology | Fix for quality; can merge with plan to address |
| **P3 — Low** | Style nits, minor rewording suggestions, optional enhancements | Fix at author's discretion |

---

## 7. Sources

### Anthropic Official Documentation
- [Prompt Engineering Overview](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview)
- [Prompting Best Practices for Claude 4.x](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices)
- [Giving Claude a Role (System Prompts)](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/system-prompts)
- [Use XML Tags to Structure Prompts](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/use-xml-tags)
- [Use Examples (Multishot Prompting)](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/multishot-prompting)
- [Skill Authoring Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Create Custom Subagents](https://code.claude.com/docs/en/sub-agents)
- [Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)

### Industry Research
- [LLM Agent Design Patterns (Prompt Engineering Guide)](https://www.promptingguide.ai/research/llm-agents)
- [Agent System Design Patterns (Databricks)](https://docs.databricks.com/aws/en/generative-ai/guide/agent-system-design-patterns)
- [Patterns and Anti-Patterns for Building with LLMs](https://medium.com/marvelous-mlops/patterns-and-anti-patterns-for-building-with-llms-42ea9c2ddc90)
- [A Taxonomy of Prompt Defects in LLM Systems (arXiv)](https://arxiv.org/html/2509.14404v1)
- [The Prompt Engineering Playbook for Programmers](https://addyo.substack.com/p/the-prompt-engineering-playbook-for)
- [Claude Code Best Practices for Subagents](https://www.pubnub.com/blog/best-practices-for-claude-code-sub-agents/)
