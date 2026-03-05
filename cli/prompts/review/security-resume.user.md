You previously reviewed this diff for correctness issues. Now review it for SECURITY issues only.

Apply taint analysis systematically to each changed file:

1. **Identify all sources of external input** in the changed code — function parameters from HTTP handlers, environment variables, file reads, CLI arguments, database results, parsed config.
2. **Trace tainted data** through assignments, function calls, and transformations to security-sensitive sinks (SQL queries, shell commands, file paths, HTML output, eval, redirects, HTTP headers).
3. **Check for sanitization** between each source and sink. Is it appropriate for the sink type?
4. **Check trust boundaries.** Does data cross from untrusted to trusted context without validation?
5. **Apply the full taxonomy** — hardcoded secrets, weak crypto, missing auth, overly permissive config, sensitive data in logs, unsafe deserialization, prototype pollution.
6. **Verify each finding** — articulate the concrete attack vector. If you cannot describe who attacks, how, and what they gain, discard it.

Do NOT re-report correctness findings from the previous pass — they are already captured.
Do NOT flag style or performance issues. Those are handled by separate review passes.

If a finding seems to overlap with the correctness pass (e.g., an error handling issue that is both a bug and a security concern), only report the security-specific aspects: the attack vector, the exploitability, and the security impact. Do not duplicate the correctness perspective.
