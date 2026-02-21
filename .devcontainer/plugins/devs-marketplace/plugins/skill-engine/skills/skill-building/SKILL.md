---
name: skill-building
description: >-
  This skill should be used when the user asks to "build a skill", "write a
  SKILL.md", "create a Claude Code skill", "design skill instructions",
  "improve a skill description", "optimize skill content", "write effective
  prompts for skills", or discusses skill authoring best practices, progressive
  disclosure, or cross-vendor prompt engineering principles for Claude Code
  plugins.
version: 0.1.0
---

# Skill Building for Claude Code Plugins

This skill provides cross-vendor principles and actionable guidance for building effective Claude Code plugin skills. It synthesizes best practices from Anthropic, OpenAI, and Google/Gemini into a unified methodology applicable to any LLM-backed skill system.

## Mental Model

Think of a skill as onboarding material for a brilliant new hire with zero context. The hire possesses strong general reasoning but lacks project-specific knowledge, procedural workflows, and institutional conventions. The skill bridges that gap with precise, lean instructions -- not a textbook, but a field manual.

Every token loaded into context consumes attention budget. Maximize signal-to-noise ratio. Include only what changes behavior; omit what the model already knows.

## Skill Creation Process

### Step 1: Define Concrete Use Cases

Before writing anything, enumerate 5-10 concrete user requests that should trigger the skill. These examples anchor every subsequent decision.

Example prompts for an image-editor skill:
- "Remove red-eye from this photo"
- "Crop and resize this image to 1200x630"
- "Convert this PNG to WebP"

Apply the Intern Test: hand these examples to someone with no context. Could they determine what the skill covers and what falls outside its scope? If not, refine until the boundary is crisp.

### Step 2: Identify Reusable Resources

Analyze each use case. Determine what gets repeated across invocations:

| Repeated Element | Solution |
|---|---|
| Same code rewritten each time | `scripts/` -- deterministic, token-efficient |
| Same reference material consulted | `references/` -- loaded on demand |
| Same boilerplate copied | `assets/` -- templates, not context |

### Step 3: Create Directory Structure

```
skill-name/
├── SKILL.md              # Core instructions (1,500-2,000 words)
├── references/           # Detailed knowledge, loaded as needed
├── scripts/              # Deterministic operations
└── assets/               # Output templates, not loaded into context
```

Create only the directories the skill actually requires.

### Step 4: Write the Description Field

The description is the most critical field. It controls semantic routing -- determining WHEN the skill activates, not just WHAT it does.

**Structure:** Third-person, trigger-phrase-rich, specific.

```yaml
description: >-
  This skill should be used when the user asks to "exact phrase 1",
  "exact phrase 2", "exact phrase 3", or discusses topic-area.
  Provides concise-summary-of-capability.
```

**Rules for effective descriptions:**
- Include 5-8 specific trigger phrases users would actually say
- Use quoted phrases for exact match triggers
- State the capability domain, not implementation details
- Communicate WHEN to activate, not HOW the skill works internally
- Avoid vague language ("helps with", "provides guidance on")
- Never use second person

**Test the description** by reading it alongside other skill descriptions. Would the routing system correctly select this skill for the target use cases and correctly reject it for unrelated requests? Overlap between skill descriptions wastes reasoning capacity on disambiguation.

### Step 5: Write the SKILL.md Body

#### Altitude Calibration

Aim for the Goldilocks zone: specific enough to guide behavior, flexible enough to allow model heuristics. Overly prescriptive instructions cause brittle behavior. Overly vague instructions produce generic output.

**Too high (vague):**
```
Handle errors appropriately.
```

**Too low (brittle):**
```
Catch ValueError on line 42. Log to stderr with format "ERR-{timestamp}-{code}". Retry exactly 3 times with 1.5s backoff. Then raise SystemExit(1).
```

**Goldilocks:**
```
Handle errors at domain boundaries. Log with enough context to diagnose without reproduction. Retry transient failures with backoff. Fail fast on unrecoverable errors.
```

#### Writing Principles

1. **Imperative form.** Write "Validate inputs before processing" not "You should validate inputs." Every instruction begins with a verb.

2. **Positive framing.** State what to DO, not what NOT to do. Negations cause over-indexing -- the model fixates on the prohibited behavior. Transform "Do not use hardcoded paths" into "Use `${CLAUDE_PLUGIN_ROOT}` for all file references."

3. **Why before what.** Explain the reason behind each instruction. An instruction with rationale is followed more reliably than a bare command, because the model can apply the underlying principle to novel situations.

4. **Concrete examples over verbose rules.** A single well-chosen example communicates more than three paragraphs of explanation. Use 2-3 high-relevance examples rather than many low-relevance ones.

5. **Eliminate contradictions.** Contradictory instructions waste reasoning capacity. When two instructions conflict, the model must choose -- and may choose wrong. Audit for consistency before finalizing.

6. **Structure for parseability.** Place context first, instructions in the middle, constraints last. Use headers, tables, and code blocks. Make the document scannable, not a wall of prose.

7. **One skill, one capability.** Keep skills narrow and modular. A skill that tries to cover too much triggers on the wrong queries and dilutes instruction quality. Split broad skills into focused ones.

### Step 6: Apply Progressive Disclosure

Distribute content across three tiers based on loading cost and access frequency:

**Tier 1 -- Metadata (always loaded, ~100 words):**
- `name` and `description` in YAML frontmatter
- Controls routing; loaded for every conversation turn
- Optimize ruthlessly -- every word here has maximum weight

**Tier 2 -- SKILL.md body (loaded on activation, 1,500-2,000 words):**
- Core procedures, decision trees, quick references
- Essential patterns the model needs on every invocation
- Pointers to Tier 3 resources

**Tier 3 -- Bundled resources (loaded on demand, unlimited):**
- `references/` -- detailed documentation, schemas, advanced techniques
- `scripts/` -- executable code for deterministic tasks
- `assets/` -- templates and output files

**Rule of thumb:** If removing a section from SKILL.md would not degrade the most common use case, move it to `references/`. If a section contains information the model would reliably generate on its own, remove it entirely.

For large reference files (>10k words), include grep search patterns in SKILL.md so the model can locate specific sections without reading the entire file.

### Step 7: Define Ambiguity Policy

Specify explicitly when to assume defaults versus when to ask the user for clarification. Undefined ambiguity policy leads to inconsistent behavior -- sometimes the model guesses, sometimes it asks, with no predictable pattern.

```markdown
## Ambiguity Policy
- When file format is unspecified, default to the project's dominant format.
- When scope is unclear, present interpretation and await confirmation before executing.
- When multiple valid approaches exist, state the tradeoff and recommend one. Proceed only after approval.
```

### Step 8: Validate Before Finalizing

Run through this checklist:

**Structure:**
- [ ] SKILL.md has valid YAML frontmatter with `name` and `description`
- [ ] Body is 1,500-2,000 words (under 3,000 absolute maximum)
- [ ] All referenced files exist in `references/`, `scripts/`, `assets/`

**Description:**
- [ ] Third person ("This skill should be used when...")
- [ ] Contains 5-8 specific trigger phrases in quotes
- [ ] No overlap with other skills' trigger phrases
- [ ] Passes the routing test: activates for target queries, rejects unrelated ones

**Content:**
- [ ] Imperative/infinitive form throughout -- no second person
- [ ] Positive framing -- instructions state what to do, not what to avoid
- [ ] Why explained alongside what for non-obvious instructions
- [ ] Concrete examples for complex concepts
- [ ] No contradictions between instructions
- [ ] No duplicated content between SKILL.md and references/

**Progressive Disclosure:**
- [ ] Core workflow in SKILL.md
- [ ] Detailed content in references/
- [ ] SKILL.md contains explicit pointers to reference files
- [ ] Deterministic operations in scripts/

### Step 9: Iterate with Evidence

Start minimal. Observe failure modes in actual usage. Add instructions only where the model demonstrably fails without them. Resist the urge to preemptively specify every edge case -- newer models handle ambiguity better than older ones.

Track which instructions change behavior versus which are ignored or already followed by default. Remove instructions that have no measurable effect; they consume attention budget without providing value.

## Five Skill Authoring Patterns

Select the pattern that matches the skill's complexity. Consult `references/skill-authoring-patterns.md` for detailed guidance on each pattern.

| Pattern | When to Use | Example |
|---|---|---|
| Instruction-Only | Pure knowledge, no resources | Coding standards |
| Asset Utilization | Templates or reference data | Frontend boilerplate |
| Few-Shot | Output format matters | Commit message style |
| Procedural Logic | Multi-step deterministic workflow | PDF processing |
| Complex Orchestration | Multiple tools + conditional flow | Full CI/CD pipeline |

## Six Behavioral Dimensions

Evaluate skill instructions against these dimensions to ensure comprehensive coverage:

1. **Reasoning** -- How to approach problems and make decisions
2. **Diagnosis** -- How to investigate and root-cause issues
3. **Exhaustiveness** -- How thorough to be (depth vs. breadth tradeoff)
4. **Adaptability** -- How to handle novel or unexpected situations
5. **Persistence** -- When to keep trying vs. when to stop and ask
6. **Risk Assessment** -- How to evaluate and communicate risk

Not every skill needs all six. Select dimensions relevant to the skill's domain.

## Additional Resources

### Reference Files

For detailed principles and patterns, consult:

- **`references/cross-vendor-principles.md`** -- Comprehensive synthesis of Anthropic, OpenAI, and Google/Gemini prompt engineering principles organized by theme
- **`references/patterns-and-antipatterns.md`** -- Concrete before/after examples of effective and ineffective skill writing
- **`references/skill-authoring-patterns.md`** -- The five authoring patterns with implementation guidance and examples for each
