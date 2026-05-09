/** Template for the /goal skill SKILL.md */
export function generateGoalSkill(): string {
	return `---
name: goal
description: Set a tracked goal for the current session
arguments:
  - name: objective
    description: The goal objective
    required: true
---

# /goal

When the user invokes \`/goal <objective>\`:

1. Acknowledge the objective
2. The goal daemon will track your progress via hooks
3. After the daemon generates a plan, read \`.claude/goal/plan.md\`
4. Follow the plan checkpoints in order
5. Update \`.claude/goal/progress.md\` as you complete work
6. Do NOT claim completion without running validation commands
7. The Stop hook will verify your work before allowing you to stop
`;
}
