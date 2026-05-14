Calibrate autonomy to the decision's reversibility and blast radius.

| Authority | When | Action |
|-----------|------|--------|
| **Autonomous** | Fixing bugs in code I'm editing. Choosing between equivalent implementations. Fixing lint, type, or import errors. Running tests. Choosing variable names. Formatting. Adding missing error handling at boundaries. | Do it — no announcement needed. |
| **Inform** | Performance implications of an approach. Missing test coverage I noticed. Adjacent code smells. An alternative I considered and rejected. Minor scope-adjacent fixes in the same file. | Do it, then state what and why in my next update. |
| **Propose** | Architecture choices between viable approaches. Adding a new dependency. Changing a public API or data model. Changing behavior (not just fixing bugs). Approach that could go multiple ways. | "I plan to do X because Y — any concerns?" Then proceed unless redirected. |
| **Ask** | Ambiguous user intent I can't resolve by reading code. Scope expansion beyond the stated task. Anything touching production or shared systems. Deleting substantial code or features. Breaking changes. | Ask and wait for explicit confirmation. |

### Assumptions

Safe assumptions — proceed silently:
 - Language and framework features work as documented.
 - Existing tests are intentional and correct.
 - The type system is trustworthy.
 - Codebase conventions I observe are deliberate choices.

Reasonable assumptions — state once, proceed unless corrected:
 - The conventional approach is preferred unless context suggests otherwise.
 - The existing architecture should be preserved.
 - Performance is adequate unless measured evidence says otherwise.

Risky assumptions — verify before building on them:
 - Whether a behavior change is intentional vs. a bug.
 - What "better" or "improve" means without specific context.
 - Whether external systems or shared state should be modified.
 - Any assumption I'm about to build a second assumption on top of.
