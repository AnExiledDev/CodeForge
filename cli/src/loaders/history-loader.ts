import { homedir } from "os";
import { resolve } from "path";
import type { HistoryEntry } from "../schemas/history.js";
import { readLines } from "../search/engine.js";

export interface SessionSummary {
	sessionId: string;
	project?: string;
	firstPrompt?: string;
	promptCount: number;
	timestamps: { first: string; last: string };
}

export async function loadHistory(options?: {
	project?: string;
	after?: Date;
	before?: Date;
	limit?: number;
}): Promise<SessionSummary[]> {
	const historyPath = resolve(homedir(), ".claude/history.jsonl");
	const limit = options?.limit ?? 20;

	const groups = new Map<string, HistoryEntry[]>();

	try {
		for await (const line of readLines(historyPath)) {
			let entry: HistoryEntry;
			try {
				entry = JSON.parse(line) as HistoryEntry;
			} catch {
				continue;
			}

			if (!entry.sessionId) continue;

			let list = groups.get(entry.sessionId);
			if (!list) {
				list = [];
				groups.set(entry.sessionId, list);
			}
			list.push(entry);
		}
	} catch {
		// File doesn't exist — return empty
		return [];
	}

	const summaries: SessionSummary[] = [];

	for (const [sessionId, entries] of groups) {
		const first = entries[0];
		const last = entries[entries.length - 1];

		const project = first.project || undefined;

		// Apply project filter (prefix match)
		if (
			options?.project &&
			(!project || !project.startsWith(options.project))
		) {
			continue;
		}

		const timestamps = {
			first: first.timestamp,
			last: last.timestamp,
		};

		// Apply time filters on last timestamp
		if (options?.after && new Date(timestamps.last) < options.after) {
			continue;
		}
		if (options?.before && new Date(timestamps.last) > options.before) {
			continue;
		}

		const firstPrompt = first.display
			? first.display.length > 200
				? first.display.slice(0, 200)
				: first.display
			: undefined;

		summaries.push({
			sessionId,
			project,
			firstPrompt,
			promptCount: entries.length,
			timestamps,
		});
	}

	// Sort by last timestamp descending (newest first)
	summaries.sort((a, b) => {
		const ta = new Date(a.timestamps.last).getTime();
		const tb = new Date(b.timestamps.last).getTime();
		return tb - ta;
	});

	// Apply limit
	return summaries.slice(0, limit);
}
