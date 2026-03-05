Review this git diff for CODE QUALITY issues only.

Apply your analysis method systematically to each changed file:

1. **Readability check.** Read each changed function as a newcomer. Is the intent clear? Are names specific enough? Is the abstraction level consistent within the function?
2. **Complexity check.** For each loop, identify the input size and algorithm. For each function, count nesting levels and responsibilities. Flag functions that do multiple unrelated things.
3. **Duplication check.** Scan the entire diff for repeated patterns — 5+ lines appearing in multiple places, or the same structure with different data. Only flag substantial repetition, not 2-3 similar lines.
4. **Error handling check.** Do error messages include context (what failed, why, what to do)? Are error patterns consistent within each module?
5. **API design check.** Are function signatures consistent? Do public functions have clear contracts (parameter types, return types, error behavior)?
6. **Calibrate against real impact.** For each potential finding, apply the "real burden vs style preference" test from your instructions. Remove findings that are subjective preferences or marginal improvements.

Do NOT flag correctness bugs or security vulnerabilities. Those are handled by separate review passes.

Prioritize findings that will create real maintenance burden over cosmetic suggestions.

Only report issues with concrete evidence of quality impact. Do not flag style preferences.

<diff>
{{DIFF}}
</diff>
