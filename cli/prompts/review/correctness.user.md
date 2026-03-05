Review this git diff for correctness issues ONLY.

Apply your analysis method systematically to each changed file:

1. **Read beyond the diff.** Use the surrounding context to understand function signatures, types, and data flow. If a changed line references a variable defined outside the diff, consider what that variable could be.
2. **Trace inputs through the changes.** Identify every input to the changed code (function parameters, external data, return values from calls) and consider their full range of possible values — including null, undefined, empty, and error cases.
3. **Walk each execution path.** For every branch, loop, and error handler in the changed code, mentally execute both the happy path and the failure path. Ask: what state is the program in after each path?
4. **Apply the issue taxonomy.** Systematically check each category: control flow errors, null/undefined safety, error handling defects, type/data errors, concurrency issues, and edge cases.
5. **Calibrate severity.** Use the severity definitions from your instructions. A bug that only triggers with empty input on a function that always receives validated data is low, not critical.
6. **Self-check before reporting.** For each potential finding, verify: Can I point to the exact line? Can I describe how it fails? If not, discard it.

Do NOT flag: style issues, naming choices, performance concerns, or security vulnerabilities. Those are handled by separate review passes.

Only report issues with concrete evidence from the code. Do not speculate.

<diff>
{{DIFF}}
</diff>
