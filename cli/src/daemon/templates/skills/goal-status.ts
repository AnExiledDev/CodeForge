/** Template for the /goal-status skill SKILL.md */
export function generateGoalStatusSkill(): string {
	return `---
name: goal-status
description: Show current goal progress and status
---

# /goal-status

When the user invokes \`/goal-status\`:

1. Read \`.claude/goal/state.json\` to get the current goal state
2. Read \`.claude/goal/progress.md\` to get the progress log
3. Summarize the current state:
   - Goal objective
   - Current status (active, paused, cleared, done)
   - Current checkpoint
   - Loop count / max loops
   - Recent progress entries
4. If no goal is active, inform the user and suggest using \`/goal <objective>\` to set one
`;
}
