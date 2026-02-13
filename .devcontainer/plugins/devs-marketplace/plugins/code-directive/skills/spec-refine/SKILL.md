---
name: spec-refine
description: >-
  This skill should be used when the user asks to "refine a spec",
  "review spec assumptions", "validate spec decisions", "question the
  spec", "iterate on the spec", "check spec for assumptions", "approve
  the spec", "walk me through the spec", or needs iterative
  user-driven refinement of a specification through structured
  questioning rounds.
version: 0.1.0
---

# Iterative Spec Refinement

## Mental Model

A draft spec is a hypothesis, not a commitment. Every requirement, tech decision, and scope boundary in a draft is an assumption until the user explicitly validates it. This skill systematically mines a spec for unvalidated assumptions, presents each to the user for review via structured questions, and iterates until every decision has explicit user approval.

No implementation begins on a spec with `**Approval:** draft`. This skill is the gate.

---

## Workflow

### Step 1: Load & Inventory

Find the target spec:
- If `$ARGUMENTS` contains a path or feature name, use it directly
- Otherwise, glob `.specs/**/*.md` and ask the user which spec to refine

Read the full spec. Catalog:
- Every section and whether it has content
- The `**Approval:**` status (should be `draft`)
- All requirements and their current markers (`[assumed]` vs `[user-approved]`)
- The `## Open Questions` section (if any)
- The `## Resolved Questions` section (if any)

If the spec is already `**Approval:** user-approved` and all requirements are `[user-approved]`, report this and ask if the user wants to re-review anyway.

### Step 2: Assumption Mining

Scan each section systematically for unvalidated decisions. Look for:

| Category | What to look for |
|----------|-----------------|
| **Tech decisions** | Database choices, auth mechanisms, API formats, libraries, protocols |
| **Scope boundaries** | What's included/excluded without stated rationale |
| **Performance targets** | Numbers (response times, limits, thresholds) that were assumed |
| **Architecture choices** | Where logic lives, service boundaries, data flow patterns |
| **Behavioral defaults** | Error handling, retry logic, fallback behavior, timeout values |
| **Unstated dependencies** | Systems, services, or libraries the spec assumes exist |
| **Security assumptions** | Auth requirements, data sensitivity, access control patterns |

For each assumption found, prepare a question with 2-4 alternatives including the current assumption.

Present findings via `AskUserQuestion` in rounds of 1-4 questions. Group related assumptions together. Example:

```
Question: "Which authentication mechanism should this feature use?"
Options:
- JWT with refresh tokens (current assumption)
- Session cookies with httpOnly flag
- OAuth2 with external provider
```

Record each answer. After the user responds, check: did any answer reveal new assumptions or contradictions? If yes, add follow-up questions to the queue.

### Step 3: Requirement Validation

Walk through every requirement tagged `[assumed]`:

1. **Read the requirement** aloud to the user (via the question text)
2. **Assess** — is it specific? testable? complete?
3. **Present via AskUserQuestion** with options:
   - Approve as-is
   - Needs revision (user provides direction via "Other")
   - Remove (not needed)
   - Defer to Open Questions (not decidable yet)

Process requirements in batches of 1-4 per question round. Prioritize:
- Requirements with the most ambiguity first
- Requirements that other requirements depend on
- Requirements involving tech decisions or external systems

For approved requirements, update the marker from `[assumed]` to `[user-approved]`.
For revised requirements, rewrite per user direction and mark `[user-approved]`.
For removed requirements, delete them.
For deferred requirements, move to `## Open Questions`.

### Step 4: Acceptance Criteria Review

For each acceptance criterion:
1. Is it measurable and testable?
2. Does it map to a specific requirement?
3. Are there requirements without corresponding criteria?

Present gaps to the user:
- Missing criteria for existing requirements
- Criteria that don't map to any requirement
- Criteria with vague or unmeasurable outcomes

Get approval on each criterion or batch of related criteria.

### Step 5: Scope & Dependency Audit

Review the spec from four perspectives:

**User perspective:**
- Does the feature solve the stated problem?
- Are there user needs not addressed?
- Is the scope too broad or too narrow?

**Developer perspective:**
- Is this implementable with the current architecture?
- Are the key files accurate?
- Are there missing technical constraints?

**Security perspective:**
- Are there data sensitivity issues?
- Is authentication/authorization addressed?
- Are there input validation gaps?

**Operations perspective:**
- Deployment considerations?
- Monitoring and observability needs?
- Rollback strategy needed?

Surface any missing items via `AskUserQuestion`. Get explicit decisions on scope boundaries and dependency completeness.

### Step 6: Final Approval

1. Present a summary of all changes made during refinement:
   - Assumptions resolved (count)
   - Requirements approved/revised/removed
   - New criteria added
   - Scope changes

2. Ask for final approval via `AskUserQuestion`:
   - "Approve spec — all decisions validated, ready for implementation"
   - "More refinement needed — specific concerns remain"

3. On approval:
   - Set `**Approval:** user-approved`
   - Update `**Last Updated:**` to today
   - Verify all requirements are tagged `[user-approved]`
   - Populate `## Resolved Questions` with the decision trail from this session

4. On "more refinement needed":
   - Ask what concerns remain
   - Loop back to the relevant phase

---

## Convergence Rules

- After each phase, check: did answers from this phase raise new questions? If yes, run another questioning round before advancing.
- The skill does NOT terminate until ALL of:
  - Every `[assumed]` requirement is resolved (approved, revised, removed, or deferred)
  - All acceptance criteria are reviewed
  - The user gives explicit final approval
- If the user wants to stop early, leave `**Approval:** draft` and note remaining items in `## Open Questions`.

---

## Resolved Questions Format

Each resolved question follows this format:

```markdown
1. **[Decision topic]** — [Chosen option] (user-approved, YYYY-MM-DD)
   - Options considered: [list]
   - Rationale: [brief user reasoning or context]
```

Keep entries concise — decision + options + rationale in 2-3 lines each.

---

## Ambiguity Policy

- If the spec has no `**Approval:**` field, treat it as `draft` and add the field.
- If requirements lack `[assumed]`/`[user-approved]` tags, treat all as `[assumed]`.
- If the user says "approve everything" without reviewing individual items, warn that blanket approval defeats the purpose — offer to fast-track by presenting summaries of each batch.
- If the spec is very short (< 30 lines), the full 6-phase process may be unnecessary. Adapt: merge phases 2-4 into a single review pass. Still require explicit final approval.
- If the user provides a feature name that matches multiple specs, list them and ask which to refine.

---

## Anti-Patterns

- **Rubber-stamping**: Presenting assumptions and immediately suggesting "approve all." Every assumption gets its own question with real alternatives.
- **Leading questions**: "Should we use JWT as planned?" is leading. Present alternatives neutrally: "Which auth mechanism should this feature use? Options: JWT, sessions, OAuth2."
- **Skipping phases**: Every phase surfaces different types of assumptions. Don't skip phases even if earlier phases had few findings.
- **Silent upgrades**: Never change `[assumed]` to `[user-approved]` without presenting the item to the user first.
