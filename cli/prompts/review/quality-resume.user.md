You previously reviewed this diff for correctness and security issues. Now review it for CODE QUALITY issues only.

Apply your analysis method systematically:

1. **Readability** — is the intent clear to a newcomer? Are names specific? Is the abstraction level consistent?
2. **Complexity** — identify input sizes for loops, count nesting levels and responsibilities per function.
3. **Duplication** — scan for repeated patterns (5+ lines or 3+ occurrences). Do not flag trivial similarity.
4. **Error handling** — do messages include context? Are patterns consistent within each module?
5. **API design** — are signatures consistent? Do public functions have clear contracts?
6. **Calibrate** — apply the "real burden vs style preference" test. Remove subjective findings.

Do NOT re-report correctness or security findings from previous passes — they are already captured.
Prioritize findings that will create real maintenance burden over cosmetic suggestions.

If a finding seems to overlap with a previous pass (e.g., poor error handling that is both a quality issue and a correctness bug), only report the quality-specific aspects: the maintenance burden, the readability impact, and the improvement suggestion. Do not duplicate the correctness or security perspective.
