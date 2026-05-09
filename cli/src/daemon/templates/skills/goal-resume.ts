/** Template for the /goal-resume skill SKILL.md */
export function generateGoalResumeSkill(): string {
	return `---
name: goal-resume
description: Resume a paused goal
---

# /goal-resume

When the user invokes \`/goal-resume\`:

1. Inform the user that the goal is being resumed
2. The goal daemon will reactivate tracking via hooks
3. Read \`.claude/goal/plan.md\` to refresh your understanding of the plan
4. Check \`.claude/goal/progress.md\` to see where you left off
5. Continue working from the current checkpoint
`;
}
