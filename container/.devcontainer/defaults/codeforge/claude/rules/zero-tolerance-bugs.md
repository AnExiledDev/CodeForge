# Zero-Tolerance Bug Policy

**Every bug found is a bug to fix. No exceptions. No deferral.**

## Core Mandate

- If you encounter a bug, warning, error, or defect — whether you caused it or not,
  whether it's pre-existing or newly introduced — it is YOUR responsibility to address it.
- **Warnings are bugs.** Compiler warnings, linter warnings, deprecation warnings,
  test warnings — all of them. Treat every warning as a defect that must be resolved.
- **Never silently pass over a problem.** Never add `// TODO`, `// FIXME`, `# type: ignore`,
  `@ts-ignore`, `eslint-disable`, or any suppression to hide an issue. Fix the root cause.

## Decision Flow

```
Found a bug/warning/error?
  |
  +--> Is it in code you're currently working on?
  |      |
  |      YES --> FIX IT. Immediately. No questions asked.
  |              Pre-existing bugs in your working area are YOUR bugs now.
  |
  +--> Is it unrelated to your current unit of work?
  |      |
  |      YES --> SURFACE IT TO THE USER. Describe the issue clearly.
  |              Only the user can decide not to fix something.
  |
  +--> Is it highly complex (requires major refactoring, architectural change)?
         |
         YES --> SURFACE IT TO THE USER with complexity assessment.
                 Propose a fix approach. Let the user decide timing.
                 Do NOT silently defer or ignore.
```

## Explicit Prohibitions

1. **Never say "out of scope"** about a bug you've found. Bugs are never out of scope.
2. **Never say "we can fix this later."** Later is now.
3. **Never say "this is a pre-existing issue."** Pre-existing means it's been broken longer.
   That makes it MORE urgent, not less.
4. **Never defer a fix to a follow-up PR/task/ticket.** If you found it, you fix it or
   you surface it to the user for an explicit decision.
5. **Never suppress warnings** to make output "clean." Make the code clean instead.

## Severity Does Not Matter

A typo in a comment is still a bug. A minor deprecation warning is still a bug.
The only person who can say "that's not worth fixing" is the user. You surface it,
they decide. You never make that call yourself.

## The Only Exception

The user explicitly says "don't fix that" or "leave it." That's it.
