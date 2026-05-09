/** Template for the /goal-clear skill SKILL.md */
export function generateGoalClearSkill(): string {
	return `---
name: goal-clear
description: Clear the current goal and stop tracking
---

# /goal-clear

When the user invokes \`/goal-clear\`:

1. Inform the user that the current goal is being cleared
2. The goal daemon will handle the state transition via hooks
3. Goal artifacts in \`.claude/goal/\` will be preserved for reference
4. Use \`codeforge goal reset --purge\` from the terminal to also remove artifacts
5. Use \`/goal <objective>\` to start a new goal
`;
}
