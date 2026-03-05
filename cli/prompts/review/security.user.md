Review this git diff for SECURITY issues only.

Apply taint analysis systematically to each changed file:

1. **Identify all sources of external input.** In the changed code, find every place where user-controlled or external data enters: function parameters from HTTP handlers, environment variables, file reads, CLI arguments, database results, parsed config. Mark each as a taint source.
2. **Trace tainted data through the diff.** Follow each source through assignments, function calls, string operations, and returns. Does it reach a security-sensitive sink (SQL query, shell command, file path, HTML output, eval, redirect, HTTP header)?
3. **Check for sanitization.** Between each source and sink, is the data validated, escaped, or constrained? Is the sanitization appropriate for the sink type?
4. **Check trust boundaries.** Does data cross from an untrusted to a trusted context (client→server, user→database, external→internal) without validation?
5. **Apply the full taxonomy.** Beyond taint analysis, check for: hardcoded secrets, weak crypto, missing auth checks, overly permissive configurations, sensitive data in logs, unsafe deserialization, prototype pollution.
6. **Verify each finding.** For every potential issue, articulate the concrete attack: who is the attacker, what do they control, how do they exploit it, and what do they gain? If you cannot answer all four, discard the finding.

Do NOT flag correctness bugs, style issues, or performance concerns. Those are handled by separate review passes.

Only report vulnerabilities with a concrete attack path. Do not speculate.

<diff>
{{DIFF}}
</diff>
