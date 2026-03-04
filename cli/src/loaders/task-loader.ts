import { homedir } from "os";
import { basename, dirname, resolve } from "path";
import type { Task } from "../schemas/task.js";

export interface TaskWithTeam extends Task {
	team: string;
}

export async function loadTasks(options?: {
	team?: string;
	status?: string;
}): Promise<TaskWithTeam[]> {
	const basePath = resolve(homedir(), ".claude/tasks");
	const results: TaskWithTeam[] = [];

	try {
		const glob = new Bun.Glob("**/*.json");
		for await (const entry of glob.scan({
			cwd: basePath,
			absolute: true,
		})) {
			try {
				const text = await Bun.file(entry).text();
				const task = JSON.parse(text) as Task;
				const team = basename(dirname(entry));

				if (options?.team && team !== options.team) continue;
				if (options?.status && task.status !== options.status) continue;

				results.push({ ...task, team });
			} catch {}
		}
	} catch {
		// Directory doesn't exist — return empty
		return [];
	}

	return results;
}
