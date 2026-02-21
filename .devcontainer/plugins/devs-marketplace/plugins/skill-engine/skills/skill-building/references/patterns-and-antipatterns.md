# Skill Writing Patterns and Antipatterns

This reference provides concrete before/after examples of effective and ineffective skill writing. Each section demonstrates a specific principle with real examples.

---

## 1. Description Field

### Antipattern: Vague Description

```yaml
---
name: Code Helper
description: Provides guidance for coding tasks and helps with development.
---
```

**Problem:** No trigger phrases. Vague scope. Would activate (or fail to activate) unpredictably. Competes with every other development skill.

### Pattern: Trigger-Rich Description

```yaml
---
name: Django Migration Builder
description: >-
  This skill should be used when the user asks to "create a Django migration",
  "write a database migration", "add a model field", "alter a table in Django",
  or discusses Django ORM schema changes, migration dependencies, or
  RunPython operations. Provides step-by-step migration authoring with
  dependency resolution.
---
```

**Why it works:** Specific trigger phrases match actual user language. Scope is narrow and clear. Other skills can coexist without overlap.

---

## 2. Altitude Calibration

### Antipattern: Too Vague (Too High)

```markdown
## Error Handling
Handle errors well. Make sure the code is robust.
```

**Problem:** No actionable guidance. The model already "tries" to handle errors. This instruction changes nothing.

### Antipattern: Too Specific (Too Low)

```markdown
## Error Handling
On line 15 of the handler, wrap the database call in try/except.
Catch psycopg2.OperationalError specifically.
Log the error with format: "DB_ERR | {timestamp} | {query} | {error}".
Sleep for 2 seconds, then retry up to 3 times.
If all retries fail, raise a custom DatabaseUnavailableError with code 503.
```

**Problem:** Brittle. Only applies to one specific file and one specific database driver. Breaks when anything changes.

### Pattern: Goldilocks Zone

```markdown
## Error Handling
Handle errors at domain boundaries (API endpoints, service interfaces, CLI entry points).
Log with enough context to diagnose the issue without requiring reproduction:
include the operation attempted, relevant identifiers, and the error category.
Retry transient failures (network timeouts, temporary locks) with exponential backoff.
Fail fast on unrecoverable errors (missing configuration, invalid schemas).
```

**Why it works:** Specific enough to change behavior. Flexible enough to apply across any file, framework, or database. The model can apply these principles to novel situations.

---

## 3. Positive Framing

### Antipattern: Negative Instructions

```markdown
## Rules
- Do not use hardcoded file paths
- Do not skip input validation
- Do not commit directly to main
- Never use `rm -rf` without confirmation
- Do not write functions longer than 50 lines
- Avoid nested callbacks more than 3 levels deep
```

**Problem:** Each "do not" draws attention to the prohibited behavior. The model may over-index on these restrictions, becoming overly cautious or paradoxically more likely to think about the prohibited action.

### Pattern: Positive Directives

```markdown
## Standards
- Use `${CLAUDE_PLUGIN_ROOT}` for all file path references
- Validate all inputs at function boundaries before processing
- Create feature branches; merge to main via pull request
- Confirm destructive file operations with the user before execution
- Extract functions when they exceed a single screen of logic (~40 lines)
- Flatten nested callbacks using async/await or promise chains
```

**Why it works:** Each instruction states what to do. The model builds a positive mental model of correct behavior rather than a catalog of prohibited actions.

---

## 4. Why Before What

### Antipattern: Bare Commands

```markdown
Always run `npm audit` before deploying.
Pin dependency versions in package.json.
Use lockfile in CI builds.
```

**Problem:** Instructions are followed mechanically. When a novel situation arises (e.g., a monorepo with multiple package.json files), the model has no principle to apply.

### Pattern: Rationale-Attached Instructions

```markdown
Run `npm audit` before deploying -- supply chain attacks through
compromised dependencies are the most common vector for Node.js
applications. Pin dependency versions in package.json to prevent
unexpected breaking changes from upstream patches. Use lockfile
in CI builds to ensure reproducible deployments; without it,
CI and production may run different dependency trees.
```

**Why it works:** The model understands the underlying security principle. In novel situations (e.g., a Python project), it can apply the same principle by running `pip-audit` and pinning versions in `requirements.txt`.

---

## 5. Examples Over Rules

### Antipattern: Rules Without Examples

```markdown
## Commit Messages
Write commit messages that are clear and descriptive.
Use the imperative mood. Keep the subject line under 72 characters.
Include a body when the change is non-trivial.
Reference related issues.
```

**Problem:** "Clear and descriptive" is subjective. Different models will interpret these rules differently.

### Pattern: Few-Shot Examples

````markdown
## Commit Messages

Follow this format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Examples:**

```
fix(auth): prevent session fixation on password reset

The reset flow was reusing the existing session ID, allowing an
attacker who set the initial session to maintain access after
the victim resets their password. Generate a new session ID
after successful password reset.

Closes #2847
```

```
feat(api): add rate limiting to public endpoints

Public endpoints were unbounded, enabling abuse via automated
requests. Apply 100 req/min per IP with 429 responses and
Retry-After headers.

Refs #3012
```

```
refactor(db): extract connection pooling into shared module

Three services duplicated connection pool configuration with
minor variations. Consolidate into shared module with
per-service overrides via environment variables.
```
````

**Why it works:** Three examples communicate format, tone, detail level, and rationale style simultaneously. No ambiguity about what "clear and descriptive" means in this context.

---

## 6. Progressive Disclosure

### Antipattern: Everything in SKILL.md

```markdown
---
name: API Client
description: This skill should be used when building API clients.
---

# API Client Skill

[2,000 words of core instructions]

## Authentication Patterns
[1,500 words on OAuth, API keys, JWT, HMAC]

## Error Handling Reference
[1,200 words on retry strategies, circuit breakers]

## Rate Limiting Guide
[800 words on rate limit headers, backoff algorithms]

## API Schema Reference
[3,000 words of endpoint documentation]

Total: ~8,500 words -- loaded every time the skill activates
```

**Problem:** 8,500 words loaded on every activation. Most invocations need only the core instructions. Authentication details, rate limiting guides, and schema references are needed occasionally but consume context budget on every activation.

### Pattern: Tiered Distribution

**SKILL.md (~1,800 words):**
```markdown
---
name: API Client
description: This skill should be used when the user asks to "build an API client", "create an HTTP integration", "implement API authentication", or "handle API errors".
---

# API Client Skill

[1,500 words of core instructions]

## Quick Reference

| Task | See |
|---|---|
| Authentication | `references/auth-patterns.md` |
| Error handling | `references/error-handling.md` |
| Rate limiting | `references/rate-limiting.md` |
| API schemas | `references/api-schema.md` (search: "GET /endpoint") |

## Additional Resources

- **`references/auth-patterns.md`** -- OAuth, API keys, JWT, HMAC patterns
- **`references/error-handling.md`** -- Retry strategies, circuit breakers
- **`references/rate-limiting.md`** -- Rate limit headers, backoff algorithms
- **`references/api-schema.md`** -- Complete endpoint documentation
```

**Why it works:** Core instructions load on every activation (1,800 words). Detailed references load only when the specific topic arises. Total content available is the same; context cost on typical invocations drops by ~75%.

---

## 7. Ambiguity Policy

### Antipattern: No Ambiguity Policy

```markdown
## Instructions
Process the user's request and generate appropriate code.
```

**Problem:** When the user says "build a login page," should the skill assume React or ask? Should it include password reset or just login? Should it use session cookies or JWT? Without policy, behavior is unpredictable.

### Pattern: Explicit Ambiguity Handling

```markdown
## Ambiguity Policy

- **Framework:** If the project contains framework markers (package.json with React, settings.py with Django), use the detected framework. Otherwise, ask.
- **Scope:** Present the interpreted scope and await confirmation before implementing. Example: "Interpretation: login page with email/password, session-based auth, no password reset. Proceed?"
- **Style:** Default to the project's existing code style. If no precedent exists, follow the language community's dominant convention.
- **Dependencies:** Prefer dependencies already in the project. Propose new dependencies with justification before adding.
```

**Why it works:** Each category of ambiguity has a clear resolution strategy. Behavior becomes predictable. The model knows when to assume and when to ask.

---

## 8. Contradictions

### Antipattern: Contradictory Instructions

```markdown
Keep responses concise and to the point.

...

Always provide comprehensive explanations with full context,
background, and step-by-step reasoning for every decision.
```

**Problem:** "Concise" contradicts "comprehensive with full context." The model must choose, and the choice is unpredictable. Different invocations may resolve the contradiction differently.

### Pattern: Context-Dependent Instructions

```markdown
## Response Calibration

Match response depth to request complexity:
- **Quick questions** (factual lookups, syntax queries): Direct answer, 1-3 sentences.
- **Implementation tasks** (build X, fix Y): Present approach, await approval, then implement with inline rationale for non-obvious decisions.
- **Architecture discussions** (design X, evaluate tradeoffs): Comprehensive analysis with tradeoffs, recommendations, and reasoning.
```

**Why it works:** No contradiction. Response depth is a function of request type. The model applies the appropriate level for each interaction.

---

## 9. Skill Scope

### Antipattern: Kitchen Sink Skill

```yaml
---
name: Development Helper
description: This skill should be used when the user asks about coding, testing, deployment, database management, API design, code review, documentation, CI/CD, security, or performance optimization.
---
```

**Problem:** Activates on nearly every development query. Competes with every other skill. Instructions are necessarily shallow across all domains.

### Pattern: Focused Skill

```yaml
---
name: Database Migration Builder
description: This skill should be used when the user asks to "create a migration", "alter a database table", "add a column", "write a schema change", or discusses migration dependencies, rollback strategies, or data migration scripts. Covers SQL and ORM-based migrations.
---
```

**Why it works:** Narrow trigger surface. Activates precisely when needed. Instructions can be deep and specific because the scope is constrained.

---

## 10. Agentic Persistence

### Antipattern: No Persistence Guidance

```markdown
Complete the requested task.
```

**Problem:** The model may stop at the first obstacle, produce a partial result, or ask the user for help when it could resolve the issue independently with available tools.

### Pattern: Explicit Persistence Policy

```markdown
## Task Completion

Persist until the task is fully complete:
- When encountering errors, diagnose using available tools before asking the user.
- When a file is not found, search the project structure before reporting failure.
- When tests fail, read the failure output, identify the cause, and fix.
- When blocked by missing information that cannot be inferred or discovered, state what is needed and ask.

Stop conditions:
- All acceptance criteria are met
- Tests pass (if applicable)
- The user explicitly requests a stop
- A genuine blocker exists that requires user input
```

**Why it works:** Clear persistence policy with explicit stop conditions. The model knows when to keep working and when to stop. Reduces premature termination without causing infinite loops.
