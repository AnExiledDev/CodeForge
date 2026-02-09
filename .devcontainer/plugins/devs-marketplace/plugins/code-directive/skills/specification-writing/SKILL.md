---
name: specification-writing
description: >-
  This skill should be used when the user asks to "write a specification",
  "create requirements", "define acceptance criteria", "write user stories",
  "create a feature spec", "document requirements", "use EARS format",
  "write Given/When/Then scenarios", "define edge cases for a feature",
  "structure a product requirement document",
  or discusses requirement formats, EARS templates, Gherkin syntax,
  acceptance criteria patterns, specification structure,
  or completeness checklists for feature definitions.
version: 0.1.0
---

# Specification Writing

## Mental Model

Specifications are **contracts between humans** -- between the person requesting a feature and the person building it. The goal is to eliminate ambiguity so that both parties agree on what "done" means before work begins.

A specification is not prose. It's a structured document with testable claims. Every requirement should be verifiable: can you write a test (automated or manual) that proves the requirement is met? If you can't test it, it's not a requirement -- it's a wish.

The most common source of project failure is not bad code but bad specifications. Specifically:
- **Missing edge cases** -- "What happens when the list is empty?"
- **Ambiguous language** -- "The system should respond quickly" (how quickly?)
- **Implicit assumptions** -- "Users will authenticate" (how? OAuth? Password? SSO?)
- **Missing error cases** -- "The system saves the file" (what if the disk is full?)

Write specifications with a hostile reader in mind -- someone who will interpret every ambiguity in the worst possible way. If a requirement can be misunderstood, it will be.

---

## Spec Sizing & AI Context Rules

Specifications are loaded into AI context windows with limited capacity. Design for consumption.

**Hard limit:** ≤200 lines per spec file. If a feature needs more, split into sub-specs (one per sub-feature) with a ≤50 line overview linking them.

**Reference, don't reproduce:** Never inline source code, SQL DDL, Pydantic models, or TypeScript interfaces. Reference the file path and line range instead. The code is the source of truth — duplicated snippets go stale silently.

**Structure for independent loading:** Each spec file must be useful on its own. Include: version, status, last-updated date, intent, key file paths, and acceptance criteria in every spec.

---

## EARS Requirement Formats

EARS (Easy Approach to Requirements Syntax) provides five templates that eliminate the most common ambiguities in natural-language requirements. Each template has a specific trigger pattern.

### Ubiquitous

Requirements that are always active, with no trigger condition:

```
The <system> shall <action>.
```

**Example:** The API shall return responses in JSON format.

### Event-Driven

Requirements triggered by a specific event:

```
When <event>, the <system> shall <action>.
```

**Example:** When a user submits a login form with invalid credentials, the system shall display an error message and increment the failed login counter.

### State-Driven

Requirements that apply while the system is in a specific state:

```
While <state>, the <system> shall <action>.
```

**Example:** While the system is in maintenance mode, the API shall return HTTP 503 for all non-health-check endpoints.

### Unwanted Behavior

Requirements for handling error conditions and edge cases:

```
If <condition>, then the <system> shall <action>.
```

**Example:** If the database connection pool is exhausted, then the system shall queue incoming requests for up to 30 seconds before returning HTTP 503.

### Optional Feature

Requirements that depend on a configurable feature:

```
Where <feature is enabled>, the <system> shall <action>.
```

**Example:** Where two-factor authentication is enabled, the system shall require a TOTP code after successful password verification.

> **Deep dive:** See `references/ears-templates.md` for EARS format templates with filled examples for each pattern type.

---

## Acceptance Criteria Patterns

Acceptance criteria define when a requirement is satisfied. Use these patterns to write criteria that are directly testable.

### Given/When/Then (Gherkin)

The most structured pattern. Each scenario is a test case:

```gherkin
Feature: User Login

  Scenario: Successful login with valid credentials
    Given a registered user with email "alice@example.com"
    And the user has a verified account
    When the user submits the login form with correct credentials
    Then the system returns a 200 response with an auth token
    And the auth token expires in 24 hours

  Scenario: Failed login with invalid password
    Given a registered user with email "alice@example.com"
    When the user submits the login form with an incorrect password
    Then the system returns a 401 response
    And the failed login attempt is logged
    And the response does not reveal whether the email exists
```

**When to use:** Complex workflows with multiple actors, preconditions, or state transitions. Best for user-facing features.

### Checklist

A flat list of verifiable statements. Simpler than Gherkin but less precise:

```markdown
## Acceptance Criteria: Password Reset

- [ ] User receives reset email within 60 seconds of request
- [ ] Reset link expires after 1 hour
- [ ] Reset link is single-use (invalidated after first use)
- [ ] Password must meet strength requirements (min 12 chars, 1 uppercase, 1 number)
- [ ] All existing sessions are invalidated after password change
- [ ] User receives confirmation email after successful reset
```

**When to use:** Simpler features where the preconditions are obvious and each criterion is independent.

### Table-Driven

For requirements with multiple input/output combinations:

```markdown
## Discount Rules

| Customer Type | Order Total | Discount | Notes |
|---------------|-------------|----------|-------|
| Standard      | < $50       | 0%       | |
| Standard      | >= $50      | 5%       | |
| Premium       | < $50       | 5%       | Minimum premium discount |
| Premium       | >= $50      | 10%     | |
| Premium       | >= $200     | 15%     | Max discount cap |
| Employee      | any         | 25%      | Requires valid employee ID |
```

**When to use:** Business rules with multiple conditions and outcomes. The table format makes gaps and overlaps visible.

> **Deep dive:** See `references/criteria-patterns.md` for acceptance criteria examples across different domains.

---

## Specification Structure

A complete specification follows this structure. Not every section is needed for every feature -- scale the document to the complexity.

Every spec file starts with metadata:

```
# Feature: [Name]
**Version:** v0.X.0
**Status:** implemented | partial | planned
**Last Updated:** YYYY-MM-DD
```

Status tells you whether to trust it, version tells you where it belongs, last-updated tells you when it was last verified.

### 1. Problem Statement
What problem does this feature solve? Who has this problem? What's the cost of not solving it? (2-3 sentences)

### 2. Scope
What's in scope and what's explicitly out of scope? Out-of-scope items prevent scope creep.

```markdown
## Scope

**In scope:**
- User-initiated password reset via email
- Password strength validation
- Session invalidation on reset

**Out of scope:**
- Admin-initiated password reset (separate spec)
- Password expiration policies
- Account recovery without email access
```

### 3. User Stories
Who are the actors and what do they want to achieve?

```markdown
As a [registered user], I want to [reset my password via email]
so that [I can regain access to my account when I forget my password].

As a [security admin], I want to [see password reset audit logs]
so that [I can detect suspicious reset patterns].
```

### 4. Functional Requirements
Use EARS format. Number each requirement for traceability:

```markdown
- FR-1: When a user requests a password reset, the system shall send a reset email
  to the registered email address within 60 seconds.
- FR-2: The reset link shall contain a cryptographically random token (min 32 bytes).
- FR-3: If the reset token is expired or already used, then the system shall display
  an error message and offer to send a new reset email.
```

### 5. Non-Functional Requirements
Performance, security, scalability, accessibility:

```markdown
- NFR-1: The password reset endpoint shall respond within 200ms (p95).
- NFR-2: Reset tokens shall be stored as bcrypt hashes, not plaintext.
- NFR-3: The reset flow shall be accessible with screen readers (WCAG 2.1 AA).
```

### 6. Edge Cases
The cases nobody thinks about until they happen:

```markdown
- What if the user requests multiple resets before using any link?
  → Only the most recent token is valid; previous tokens are invalidated.
- What if the email is associated with multiple accounts?
  → Send separate reset links for each account.
- What if the user's email provider is down?
  → The system logs the failure and retries up to 3 times over 5 minutes.
```

### 7. Out of Scope
Explicit non-goals to prevent scope creep (can reference the Scope section or expand here).

### 8. Key Files
Source files most relevant to this feature — paths an implementer should read.

### 9. Implementation Notes
Post-implementation only. Capture deviations from the original spec — what changed and why.

### 10. Discrepancies
Gaps between spec intent and actual build. Prevents the next session from re-planning decided work.

---

## Completeness Checklist

Before marking a specification as ready for implementation, verify:

**Happy path:**
- [ ] Primary use case described with acceptance criteria
- [ ] All actors identified (user, admin, system, external service)
- [ ] Success response/outcome defined

**Error cases:**
- [ ] Invalid input handled (empty, too long, wrong type, malicious)
- [ ] External service failures handled (timeout, 500, unavailable)
- [ ] Concurrent access conflicts addressed
- [ ] Rate limiting defined for public-facing endpoints

**Boundary conditions:**
- [ ] Empty collections (zero items)
- [ ] Maximum limits defined (max file size, max items, max length)
- [ ] Pagination for unbounded lists
- [ ] Time zones and date boundaries

**Performance:**
- [ ] Response time targets (p50, p95, p99)
- [ ] Throughput requirements (requests per second)
- [ ] Data volume expectations (rows, storage size)

**Security:**
- [ ] Authentication required? Which methods?
- [ ] Authorization rules per role
- [ ] Data sensitivity classification
- [ ] Audit logging requirements

**Accessibility:**
- [ ] WCAG compliance level specified
- [ ] Keyboard navigation requirements
- [ ] Screen reader compatibility

---

## Ambiguity Policy

These defaults apply when the user does not specify a preference. State the assumption when making a choice:

- **Format:** Default to EARS format for requirements and Given/When/Then for acceptance criteria. Use checklists for simple features with obvious preconditions.
- **Detail level:** Default to enough detail that a developer unfamiliar with the codebase could implement the feature without asking clarifying questions.
- **Non-functional requirements:** Always include response time targets (default: 200ms p95 for API endpoints, 3s for page loads) and note when these are assumptions.
- **Edge cases:** Always include at least: empty input, maximum input, concurrent access, and external service failure.
- **Out of scope:** Always include an out-of-scope section, even if brief, to establish boundaries.
- **Numbering:** Number all requirements (FR-1, NFR-1) for traceability in code reviews and tests.

---

## Reference Files

| File | Contents |
|------|----------|
| `references/ears-templates.md` | EARS format templates with filled examples for each pattern type, including compound requirements and requirement hierarchies |
| `references/criteria-patterns.md` | Acceptance criteria examples organized by domain: authentication, payments, file upload, search, notifications, and data import |
