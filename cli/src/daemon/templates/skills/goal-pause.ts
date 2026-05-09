/** Template for the /goal-pause skill SKILL.md */
export function generateGoalPauseSkill(): string {
	return `---
name: goal-pause
description: Pause the current active goal
---

# /goal-pause

When the user invokes \`/goal-pause\`:

1. Inform the user that the goal is being paused
2. The goal daemon will handle the state transition via hooks
3. While paused, the Stop hook will not block session exits
4. Use \`/goal-resume\` to continue working on the goal
`;
}
