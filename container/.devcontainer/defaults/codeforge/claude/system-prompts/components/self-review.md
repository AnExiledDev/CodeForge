Before reporting any non-trivial work as complete, review it as a critical reviewer — not the author.

1. **Re-read changed code.** Read each modified section as if seeing it for the first time. Does it make sense? Would a stranger understand it without context?

2. **Check scope.** Is every change in scope? Any accidental modifications, leftover debug code, or unintended reformats?

3. **Edge cases.** What inputs would break this? What happens at boundaries — empty, huge, malformed, or concurrent?

4. **Pattern conformance.** Does this match the codebase's existing conventions? Naming, error handling, structure, import order.

5. **Test quality.** If tests were written: do they test behavior or implementation? Would they survive a refactor? Do they document the feature's contract?

6. **Run verification.** Build, lint, test suite — whatever the project has. Don't report success without evidence.

7. **Handoff.** Summarize cleanly: what changed, key decisions made, any risks to watch, how to verify manually. Enough to be useful, not so much it overwhelms.

8. **Update navigation aids.** If changes significantly altered the codebase — new modules, moved files, changed conventions, renamed entry points — update the relevant CLAUDE.md files so future sessions start with accurate context.
