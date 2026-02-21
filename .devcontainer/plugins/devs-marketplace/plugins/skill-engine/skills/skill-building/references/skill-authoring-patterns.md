# Skill Authoring Patterns

This reference describes five skill authoring patterns, ordered by complexity. Select the pattern that matches the skill's requirements. Simpler patterns are preferred when they suffice -- complexity should be justified by the task.

---

## Pattern 1: Instruction-Only

### When to Use
The skill provides knowledge and guidelines without requiring external files, scripts, or templates. Pure procedural knowledge that changes model behavior through instructions alone.

### Characteristics
- SKILL.md only -- no references/, scripts/, or assets/
- Typically 800-1,500 words
- Knowledge the model does not possess by default
- No deterministic operations required

### Structure
```
skill-name/
└── SKILL.md
```

### Example: Code Review Standards

```yaml
---
name: Code Review Standards
description: >-
  This skill should be used when the user asks to "review code",
  "check this PR", "audit code quality", or discusses code review
  criteria, review comments, or approval standards.
version: 0.1.0
---
```

```markdown
# Code Review Standards

This skill establishes code review criteria for consistent, actionable feedback.

## Review Priorities (ordered)

1. **Correctness** -- Does the code do what it claims?
2. **Security** -- Are there injection, auth, or data exposure risks?
3. **Maintainability** -- Can another developer understand and modify this?
4. **Performance** -- Are there obvious inefficiencies? (Do not micro-optimize.)

## Comment Format

Structure every review comment as:

**[Category] File:Line -- Observation**
> Suggestion with rationale.

Example:
**[Security] auth.py:42 -- User input passed directly to SQL query**
> Use parameterized queries to prevent SQL injection. The `execute()`
> method accepts parameters as a second argument.

## Approval Criteria

Approve when:
- No correctness or security issues remain
- All maintainability concerns are either addressed or acknowledged with justification
- Performance concerns are documented for follow-up if not blocking

Request changes when:
- Any correctness bug exists
- Any security vulnerability exists
- Code is not understandable without the author explaining it verbally
```

### Guidance
- Keep it lean. If the body exceeds 1,500 words, consider whether a reference file is warranted, which would promote the skill to Pattern 2.
- Focus on knowledge the model lacks, not general best practices it already follows.
- Instruction-Only skills are the easiest to maintain. Prefer this pattern unless the skill genuinely needs external resources.

---

## Pattern 2: Asset Utilization

### When to Use
The skill requires reference material, documentation, or templates that are too large for the SKILL.md body, or that change independently from the core instructions.

### Characteristics
- SKILL.md + references/ and/or assets/
- SKILL.md stays lean (1,500-2,000 words), detail lives in references/
- Reference material loaded on demand, not on every activation
- Assets used in output but not loaded into context

### Structure
```
skill-name/
├── SKILL.md
├── references/
│   ├── api-schema.md
│   └── domain-glossary.md
└── assets/
    └── template/
        ├── index.html
        └── styles.css
```

### Example: API Integration Skill

**SKILL.md** contains core workflow (authenticate, construct request, handle response) and a table pointing to reference files:

```markdown
## API Reference

| Endpoint Group | Reference File | Search Pattern |
|---|---|---|
| User management | `references/api-users.md` | "POST /users" |
| Billing | `references/api-billing.md` | "GET /invoices" |
| Webhooks | `references/api-webhooks.md` | "Event: payment." |
```

### Guidance
- Include search patterns for large reference files (>5,000 words) so the model can grep for specific sections.
- Avoid duplicating reference content in SKILL.md. Summarize and point.
- Assets are not loaded into context -- they are copied or modified during output generation. Include a manifest or description of assets in SKILL.md so the model knows what is available.

---

## Pattern 3: Few-Shot

### When to Use
The output format, style, or structure is critical and cannot be reliably specified through rules alone. The model needs to see concrete input-output examples to calibrate.

### Characteristics
- SKILL.md contains 2-5 high-quality input-output examples
- Examples demonstrate the full range of expected behaviors
- Each example illustrates a distinct aspect (not redundant variations)
- May combine with other patterns (e.g., Few-Shot + Asset Utilization)

### Structure
```
skill-name/
├── SKILL.md          # Contains inline examples
└── references/
    └── examples.md   # Additional examples if needed
```

### Example: Changelog Generator

````markdown
## Examples

### Example 1: Feature Addition

**Input (commit log):**
```
feat(auth): add OAuth2 PKCE flow for mobile clients
feat(auth): add refresh token rotation
fix(auth): handle expired tokens during active session
```

**Output (changelog entry):**
```markdown
### Authentication
- **Added** OAuth2 PKCE flow for mobile clients, enabling secure
  authentication without client secrets
- **Added** Refresh token rotation to prevent token replay attacks
- **Fixed** Expired token handling during active sessions -- users
  are now seamlessly re-authenticated instead of logged out
```

### Example 2: Breaking Change

**Input (commit log):**
```
feat(api)!: change response envelope from {data} to {result, meta}
migration(api): add v1-to-v2 response adapter
docs(api): update API migration guide
```

**Output (changelog entry):**
```markdown
### API (Breaking)
- **Changed** Response envelope from `{data}` to `{result, meta}`.
  See migration guide for adapter utilities.
  **Migration:** Use `v1-to-v2` adapter for backward compatibility.
```
````

### Guidance
- Each example should teach something the others do not. Example 1 shows standard features; Example 2 shows breaking changes. Redundant examples waste tokens.
- Place the 2-3 most important examples in SKILL.md. Move additional examples to `references/examples.md` if more are needed.
- Include edge cases in examples: empty inputs, ambiguous inputs, error cases.
- Few-shot is the most reliable way to enforce output format. Rules like "use bold for action verbs" are less reliably followed than examples that demonstrate the format.

---

## Pattern 4: Procedural Logic

### When to Use
The skill involves a multi-step deterministic workflow where steps must execute in order and some steps benefit from being implemented as scripts rather than generated each time.

### Characteristics
- SKILL.md defines the workflow and step ordering
- scripts/ contains deterministic steps
- The model orchestrates: deciding when to invoke scripts and handling branching logic
- References may supplement with documentation

### Structure
```
skill-name/
├── SKILL.md
├── scripts/
│   ├── validate-input.sh
│   ├── transform-data.py
│   └── generate-report.py
├── references/
│   └── format-specification.md
└── assets/
    └── report-template.html
```

### Example: Data Pipeline Skill

**SKILL.md** defines the workflow:

```markdown
## Workflow

Execute these steps in order:

1. **Validate Input**
   Run `scripts/validate-input.sh <file>` to verify format and schema.
   If validation fails, report errors to the user and stop.

2. **Transform Data**
   Run `scripts/transform-data.py --input <file> --output <temp>`.
   The script normalizes date formats, deduplicates records, and
   applies business rules defined in `references/format-specification.md`.

3. **Review Transformation**
   Read the transformation summary from stdout. Present key statistics
   to the user: records processed, duplicates removed, format corrections.
   Await confirmation before proceeding.

4. **Generate Report**
   Run `scripts/generate-report.py --data <temp> --template assets/report-template.html`.
   Output the report path to the user.

## Error Recovery

- **Validation failure:** Present the specific validation errors. Suggest corrections. Offer to auto-fix common issues (date formats, encoding).
- **Transformation failure:** Read the error log. Diagnose whether the issue is data quality or script bug. For data quality issues, present options to the user.
- **Report failure:** Fall back to plain-text summary if template rendering fails.
```

### Guidance
- Scripts should be self-contained and testable independently. Each script handles one step.
- The model's role is orchestration: deciding branching, handling errors, presenting results. Keep deterministic logic in scripts.
- Document each script's inputs, outputs, and exit codes in SKILL.md so the model can invoke them correctly.
- Include error recovery for each step. Multi-step workflows fail at steps, and the model needs to know how to recover.

---

## Pattern 5: Complex Orchestration

### When to Use
The skill coordinates multiple tools, external services, or sub-workflows with conditional branching, parallel execution, or state management across steps.

### Characteristics
- Multiple scripts and reference files working together
- Conditional branching based on intermediate results
- May involve external tool calls (APIs, databases, file systems)
- State management across steps
- Comprehensive error handling and rollback

### Structure
```
skill-name/
├── SKILL.md
├── scripts/
│   ├── discover-environment.sh
│   ├── run-analysis.py
│   ├── apply-changes.py
│   └── verify-results.sh
├── references/
│   ├── architecture.md
│   ├── rollback-procedures.md
│   └── environment-matrix.md
└── assets/
    └── config-templates/
        ├── production.yaml
        └── staging.yaml
```

### Example: Deployment Skill

**SKILL.md** defines the orchestration:

```markdown
## Deployment Workflow

### Phase 1: Environment Discovery
Run `scripts/discover-environment.sh` to detect:
- Current branch and latest commit
- Target environment (from user input or branch convention)
- Required configuration (from `references/environment-matrix.md`)

### Phase 2: Pre-flight Checks
Execute in sequence:
1. Verify all tests pass in CI (check GitHub Actions status)
2. Run `scripts/run-analysis.py --type security` for vulnerability scan
3. Run `scripts/run-analysis.py --type compatibility` for breaking change detection

**Branch on results:**
- All checks pass: proceed to Phase 3
- Security issues found: present findings, await user decision (fix/accept/abort)
- Breaking changes detected: present migration requirements, await approval

### Phase 3: Deployment
1. Select configuration template from `assets/config-templates/`
2. Run `scripts/apply-changes.py --env <target> --config <template>`
3. Monitor deployment output for errors

### Phase 4: Verification
1. Run `scripts/verify-results.sh --env <target>`
2. Present health check results
3. If verification fails, consult `references/rollback-procedures.md` and present rollback options

## State Management
Track deployment state across phases. If interrupted:
- Phase 1-2: Safe to restart from beginning
- Phase 3: Check partial deployment state before retrying
- Phase 4: Do not re-deploy; verify current state first

## Rollback Policy
Consult `references/rollback-procedures.md` for environment-specific rollback procedures. Present the rollback plan to the user before executing.
```

### Guidance
- Complex Orchestration skills are the hardest to maintain. Use this pattern only when the workflow genuinely requires it. Many workflows that seem complex can be decomposed into multiple simpler skills.
- Define state management explicitly. The model needs to know what happens when the workflow is interrupted at each phase.
- Include rollback procedures for destructive operations.
- Test the full workflow end-to-end, not just individual scripts.
- Consider whether the skill should be split into multiple skills (one per phase) that compose together. Composition often produces better results than monolithic orchestration.

---

## Pattern Selection Guide

| Question | If Yes | If No |
|---|---|---|
| Does the skill need external files? | Pattern 2+ | Pattern 1 |
| Is output format critical? | Pattern 3 | Continue |
| Are there multi-step deterministic operations? | Pattern 4 | Continue |
| Are there conditional branches or state management? | Pattern 5 | Continue |
| Is the scope well-defined and narrow? | Selected pattern is appropriate | Split into multiple skills |

**Default to the simplest pattern that covers the requirements.** Escalate only when a simpler pattern demonstrably fails to capture the skill's needs.
