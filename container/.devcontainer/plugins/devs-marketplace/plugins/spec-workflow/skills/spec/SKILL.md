---
name: spec
description: >-
  Creates and refines feature specifications as directory-based "spec packages"
  with AI-driven decision-making. Handles the full pre-implementation lifecycle:
  codebase analysis, spec drafting, decision surfacing, human refinement, and
  approval. Auto-bootstraps .specs/ and Constitution on first use.
  USE WHEN the user asks to "create a spec", "spec this feature", "new spec",
  "plan a feature", "refine the spec", "approve the spec", "set up specs",
  "create a constitution", or works with .specs/ directory and feature planning.
  DO NOT USE for implementing specs (use /build) or checking spec health
  (use /specs).
version: 1.0.0
argument-hint: "[feature-name] or [constitution]"
effort: max
---

# Create & Refine Spec Package

## Mental Model

A spec package is a directory containing everything needed to implement a feature without human intervention during build. The human's job is to provide intent, make trade-off decisions, and confirm scope. The AI's job is everything else: drafting acceptance criteria, writing examples, identifying invariants, designing schema, and planning parallel decomposition.

The spec package has two audiences:
- **Human** reads `index.md` (~50-80 lines): intent, decisions, AC summary, scope
- **AI** reads everything: `context.md` (invariants, schema, integration details) + `groups/*.md` (full ACs with examples)

Every spec is a directory. No exceptions.

```
.specs/{domain}/{feature-name}/
  index.md              # Human entry point
  context.md            # AI-facing shared context
  groups/
    a-{name}.md         # AC group with frontmatter
    b-{name}.md
    ...
```

---

## Workflow

### Step 0: Bootstrap Check

Before anything else, check if `.specs/` exists at the project root.

**If missing:** Create it silently with:
- `.specs/CONSTITUTION.md` — from `references/constitution-template.md`
- `.specs/BACKLOG.md` — from `references/backlog-template.md`

Inform the user: "Created `.specs/` with a Constitution template and Backlog. The Constitution captures project-level decisions so feature specs don't repeat them. Fill it in when you're ready — `/spec constitution` can help."

**If `.specs/CONSTITUTION.md` exists but is still the empty template:** Note this for Step 3 — the AI will need to infer cross-cutting decisions from the codebase instead.

### Step 1: Parse Intent

If `$ARGUMENTS` is `constitution`:
- Jump to the **Constitution Flow** (below)

Otherwise, extract the feature name from `$ARGUMENTS` or conversation:
- Normalize to kebab-case (e.g., `webhook delivery` → `webhook-delivery`)
- If missing, ask the user what they want to build

Check if a spec package already exists at `.specs/*/{feature-name}/`:
- If yes: load it and enter **Refinement Mode** (Step 5)
- If no: proceed to **Creation Mode** (Step 2)

### Step 2: Codebase Analysis

Before drafting anything, build context:

1. **Read Constitution** (if populated) — extract all cross-cutting decisions
2. **Scan codebase** for:
   - Existing patterns: file structure, naming conventions, frameworks in use
   - Related code: files that touch the feature's domain
   - Dependencies: services, models, utilities the feature will likely use
   - Test patterns: existing test structure and conventions
3. **Read existing specs** — scan `.specs/` for related features to avoid conflicts

This analysis informs every subsequent step. The AI doesn't ask the human questions it could answer by reading the codebase.

### Step 3: Draft Spec Package

Create the full directory structure in one pass:

**Determine domain:** Infer from the feature name + existing `.specs/` domains. Confirm with user if ambiguous.

**Create `.specs/{domain}/{feature-name}/`** with all files:

#### 3a: Draft `index.md`

Use `references/index-template.md`. Fill in:

- **Frontmatter:** feature name, domain, status=planned, approval=draft, size estimate, group list
- **Intent:** Draft 2-3 sentences from the user's description
- **Decisions — Needs Your Input:** Identify genuine trade-offs where the human's judgment matters. These are decisions where:
  - Multiple viable options exist with different trade-offs
  - The choice affects user experience or business logic
  - The AI cannot determine the right answer from codebase context alone
- **Decisions — Already Decided:** Decisions the AI made because:
  - Only one sane option exists (e.g., HMAC-SHA256 for webhook signing)
  - The Constitution already specifies the choice
  - The codebase already establishes a pattern
- **AC Summary Table:** One-liner per acceptance criterion — enough for the human to check completeness
- **Out of Scope:** Explicit non-goals

**Decision surfacing is the critical skill here.** The AI must distinguish "this has real trade-offs the human should weigh" from "this is obvious and I should just decide it." Err on the side of deciding — the human can always override in the "Already Decided" section.

#### 3b: Draft `context.md`

Use `references/context-template.md`. Fill in:

- **Invariants:** Things that must ALWAYS be true regardless of which AC is being implemented
- **Anti-Patterns:** Explicit "do NOT" examples that prevent specification gaming
- **Integration Context:** Dependency details inline — methods, object shapes, behavioral notes from related code discovered in Step 2
- **Schema Intent:** Data model design — column names, types, constraints, indexes. NOT DDL.
- **Constraints:** File paths grouped by area, pattern references, prohibitions, dependencies

#### 3c: Draft Group Files

Use `references/group-template.md`. For each logical group:

- **Identify natural groupings** from AC dependencies and file ownership
- **Name groups** with letter prefix for ordering: `a-registration.md`, `b-delivery.md`
- **Write frontmatter:** group letter, name, criteria list, status=pending, depends_on, files_owned
- **Write full ACs** with:
  - EARS-format criterion text (When/If/While/Where patterns)
  - Given/When/Then test clarity
  - Inline examples (concrete I/O per AC)

Use `references/ears-patterns.md` for EARS format guidance.

**File ownership must not overlap between groups.** If two groups need to modify the same file, either:
- Assign the file to one group and have the other read-only
- Split the file's responsibilities more clearly
- Note the coordination requirement in both group files

### Step 4: Present to Human

Show the user `index.md` content. Frame the review around three questions:

1. **"Here are the decisions I need your input on."** Present the "Needs Your Input" table. Use `AskUserQuestion` with concrete options for each decision.

2. **"Here are the decisions I already made."** Present the "Already Decided" table. Ask: "Any of these you'd change?"

3. **"Here's what I'll build — anything missing?"** Present the AC summary table. This is a completeness check, not a detailed review.

Also present: Intent (for accuracy) and Out of Scope (for confirmation).

**Do NOT:**
- Walk through every AC in detail — the human trusts the AI to write good ACs
- Ask about decisions the Constitution already covers
- Present decisions with only one viable option as "needs your input"
- Ask multiple rounds of 15 questions — batch efficiently, 1-4 questions per round

### Step 5: Refine & Finalize

After the human responds:

1. **Update decisions** based on human input
2. **Propagate changes** to context.md and group files if decisions affect them
3. **Add new ACs** if the human identified gaps
4. **Update Resolved Questions** in index.md with the decision trail
5. **Set `approval: approved`** and update `last_updated`

If the human says "more refinement needed" — loop back to Step 4 with updated content.

If the human wants to stop early — leave `approval: draft`.

### Step 6: Completion

Print:
```
Spec package created: .specs/{domain}/{feature-name}/

  index.md     — {N} decisions, {M} acceptance criteria
  context.md   — invariants, schema, integration context
  groups/      — {K} groups ready for parallel build

Status: approved. Run /build {feature-name} to implement.
```

---

## Constitution Flow

When `$ARGUMENTS` is `constitution`:

1. Read the existing `.specs/CONSTITUTION.md` (if any)
2. Analyze the codebase comprehensively:
   - Package files (package.json, pyproject.toml, Cargo.toml, go.mod)
   - Framework usage and patterns
   - File structure and naming conventions
   - Existing test setup
   - Auth patterns
   - Error handling patterns
   - Logging setup
   - Database and ORM usage
3. Draft a Constitution from `references/constitution-template.md`, filling every section with concrete findings
4. Present to the human for review — this is the ONE document worth careful human review since it affects every future spec
5. Save to `.specs/CONSTITUTION.md`

---

## Refinement Mode

When a spec package already exists (detected in Step 1):

1. Read `index.md` frontmatter — check approval status
2. If `draft` — present current state and ask what to change
3. If `approved` — warn this is already approved, ask if they want to re-refine
4. Apply changes through the same Step 4-5 flow
5. Update `last_updated` in frontmatter

---

## Spec-Level Approval

There is NO per-requirement approval tagging. The spec is either `draft` or `approved` as a whole.

- **`draft`** — not ready for implementation. `/build` will reject it.
- **`approved`** — human has reviewed decisions and scope. Ready for `/build`.

The AI makes obvious decisions and tags them in the "Already Decided" section. The human can override any of them during refinement. Once the human says "looks good" — the whole spec is approved.

---

## AC Markers

Acceptance criteria use three states during implementation by `/build`:

| Marker | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[~]` | Implemented, not yet verified — code written, tests not confirmed |
| `[x]` | Verified — tests pass, behavior confirmed |

`/spec` creates all ACs as `[ ]`. Only `/build` changes these markers.

---

## Ambiguity Policy

- If the feature name matches an existing spec, enter Refinement Mode
- If the domain is ambiguous, present 2-3 options and ask
- If the feature scope is unclear, draft a minimal spec and flag gaps for the human
- If the Constitution is empty/template, infer cross-cutting decisions from the codebase and note them in the "Already Decided" section — suggest the user run `/spec constitution` to formalize them

---

## Anti-Patterns

- **Over-asking:** Presenting 10+ decisions that have obvious answers. The human's time is the most expensive resource. Ask only genuine trade-offs.
- **Under-deciding:** Leaving decisions vague because "the human should decide." If the codebase or Constitution gives a clear answer, just decide it.
- **Scope inflation:** Adding ACs for "nice to have" features the user didn't ask for. Stick to the stated intent.
- **Empty context.md:** If you can't identify invariants, anti-patterns, or integration context, the feature is too vague — go back to the human for clarity.
- **Overlapping file ownership:** Two groups owning the same file causes merge conflicts during parallel build. Always resolve ownership.

---

## Reference Files

| File | Contents |
|------|----------|
| `references/index-template.md` | index.md template with frontmatter schema |
| `references/context-template.md` | context.md template with all sections |
| `references/group-template.md` | Group file template with frontmatter schema |
| `references/constitution-template.md` | CONSTITUTION.md template |
| `references/backlog-template.md` | BACKLOG.md template |
| `references/ears-patterns.md` | EARS format patterns and examples |
| `references/example-webhook/` | Complete example spec package (webhook delivery system) |
