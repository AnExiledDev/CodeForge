---
name: documentation-patterns
description: >-
  This skill should be used when the user asks to "write a README",
  "write documentation", "add docstrings", "add JSDoc", "document the API",
  "create architecture docs", "documentation template", "update the docs",
  or discusses docstring formats, README structure, API documentation,
  inline comments, or technical writing patterns.
version: 0.1.0
---

# Documentation Patterns

## Mental Model

Documentation has **audiences**. README for new users, API docs for integrators, architecture docs for maintainers, inline docs for contributors. Wrong audience = wrong documentation. Before writing, identify who will read it and what they need to accomplish.

**Key principles:**
- **Accuracy over completeness.** Inaccurate documentation is worse than missing documentation. Only document behavior verified by reading code. Mark uncertainty with `TODO: verify`.
- **Audience determines format.** A README walks someone through getting started. An API reference lists every parameter with types. An architecture doc explains why decisions were made. Don't mix formats.
- **Code is the source of truth.** Never copy code into documentation — reference file paths instead. Copied snippets rot as soon as the source changes.
- **Concise, specific, active voice.** "Returns a list of users" not "A list of users is returned by this function." Cut filler words entirely.
- **Show, don't tell.** A working example communicates more than three paragraphs of explanation.

---

## Documentation Types and Audiences

| Type | Audience | Purpose | Format |
|------|----------|---------|--------|
| **README** | New users, evaluators | What is this? How do I use it? | Markdown, top-level |
| **API Reference** | Integrators, consumers | Every endpoint/function with types and examples | Markdown or OpenAPI |
| **Architecture** | Maintainers, new team members | How the system works and why | Markdown with diagrams |
| **Inline (docstrings)** | Contributors, IDE users | What this function does, parameters, returns | Language-specific format |
| **Changelog** | Users, upgraders | What changed between versions | Markdown, keep-a-changelog format |
| **Configuration** | Operators, deployers | All config options with types and defaults | Markdown table or .env.example |

---

## README Structure

Answer five questions, in order:

### 1. What is this?

One paragraph. Project name, what it does, who it is for. No jargon. If someone reads only this paragraph, they should know whether to keep reading.

### 2. How do I install it?

Prerequisites (with exact versions), installation steps, environment setup. Copy-pasteable commands.

### 3. How do I use it?

Quick start example. Show the simplest possible usage that produces a visible result. Include the expected output.

### 4. How do I configure it?

Table of configuration options: name, type, required/optional, default, description. Environment variables, config files, CLI flags.

### 5. How do I contribute?

Development setup, how to run tests, how to submit changes. Link to CONTRIBUTING.md for details.

---

## Sizing Rules

Documentation files consumed by AI tools (CLAUDE.md, specs, architecture docs) should be **≤200 lines** each. Split large documents by concern. Each file should be independently useful.

For human-facing docs (README, API reference), there is no hard limit, but prefer shorter docs that link to detailed sub-pages over monolithic documents.

---

## Style Principles

1. **Concise** — "To configure..." not "In order to configure...". Cut "basically", "simply", "just", "actually".
2. **Specific** — Use exact types, values, and names. "`api_key` (string, required)" not "pass a key."
3. **Accurate** — Document only verified behavior. Mark uncertainty with `TODO: verify`.
4. **Active voice** — "The function returns a list" not "A list is returned."
5. **Show, don't tell** — Code examples over prose explanations.
6. **Consistent** — Match the project's existing documentation style for tense, format, and conventions.
7. **Audience-appropriate** — README uses everyday language. API docs use technical precision. Architecture docs explain rationale.

---

## Inline Documentation Strategy

### When to Document

Document every **public** function, class, and module. Skip private/internal helpers unless their behavior is non-obvious.

Priority order:
1. Public API functions and methods
2. Class/module-level docstrings
3. Complex algorithms (inline comments explaining *why*)
4. Configuration and constants with non-obvious values

### Style Detection

Before adding docstrings, check which style the project already uses:

```
# Python — look for existing patterns
Grep: """    → Google-style or NumPy-style
Grep: :param → Sphinx/reStructuredText
Grep: Parameters\n----------  → NumPy-style

# JavaScript/TypeScript
Grep: @param → JSDoc/TSDoc
Grep: @returns → JSDoc/TSDoc

# Go
Grep: ^// [A-Z].*function → godoc convention

# Rust
Grep: /// → rustdoc
Grep: //! → module-level rustdoc
```

Follow the existing style. If no docstrings exist, use the language's recommended default.

---

## Verification

Before finalizing documentation:

1. **Every command is correct** — Try running install commands, API examples, and code snippets against the actual project.
2. **Every path exists** — Reference only files that actually exist in the codebase.
3. **Every parameter matches the code** — Check function signatures against the documented parameters.
4. **Links work** — Verify internal references and external URLs.
5. **Version numbers are current** — Check package versions in install commands.

---

## Ambiguity Policy

| Ambiguity | Default |
|-----------|---------|
| **Audience not specified** | Write for the most common audience for the doc type (README → new users, docstrings → contributors) |
| **Scope not specified** | Document the public API surface; skip internals |
| **Format not specified** | Follow existing project conventions; fall back to language defaults |
| **Level of detail** | Include parameters, return values, and one example per function |
| **Behavior uncertain** | Mark with `TODO: verify — [specific question]` rather than guessing |

---

## Reference Files

| File | Contents |
|------|----------|
| [Docstring Formats](references/docstring-formats.md) | Complete templates for Python (Google, NumPy, Sphinx), TypeScript/JavaScript (JSDoc, TSDoc), Go (godoc), and Rust (rustdoc) with detection patterns |
| [API Doc Templates](references/api-doc-templates.md) | REST endpoint documentation template, request/response examples, parameter tables, error documentation, OpenAPI annotation patterns, and Mermaid diagram quick reference |
