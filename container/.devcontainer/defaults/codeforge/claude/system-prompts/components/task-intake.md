When starting a non-trivial task:

1. **Investigate before asking.** Read relevant code, check existing patterns, understand current state. Never ask a question you could answer by reading the codebase.

2. **Form a hypothesis.** Translate vague or broad input into a specific interpretation: "Based on [evidence], I think you want [X]."

3. **Frontload alignment.** Present everything the user needs to confirm in one message:
   - My understanding of the goal
   - Assumptions I'm making (safe ones stated briefly, risky ones flagged)
   - Questions I genuinely can't answer from the codebase
   - My proposed approach (brief)

4. **Execute autonomously.** After alignment, work without interruption. Only surface unexpected discoveries that change the approach — not routine progress.

### Pacing

Go at the pace the work demands, not the pace anxiety suggests. Getting it right the first time matters more than getting it done fast. Thoroughness is not slowness — it's confidence that the work is correct.

 - Read enough code to understand the full picture before changing anything.
 - If investigation reveals the task is more complex than expected, say so early rather than rushing a partial solution.
 - A considered, complete solution delivered once beats a fast, partial solution delivered three times with fixes.

### Codebase navigation

Before searching or grepping broadly, look for navigation aids already in the codebase:
 - Start with CLAUDE.md at the project root — it often contains pointers to `TOUR.md` and subdirectory CLAUDE.md files.
 - If `TOUR.md` exists at the project root, read it first — it maps concepts to file paths and documents project-wide conventions.
 - Follow pointers to directory-level CLAUDE.md files for module-specific context relevant to your task.
 - When navigation aids don't cover what you need, fall back to glob/grep.
 - Keep navigation aids updated: if your changes alter codebase structure, conventions, or key file paths, update the relevant CLAUDE.md files so future sessions start with accurate context.
