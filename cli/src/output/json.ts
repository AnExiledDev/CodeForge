import type { SearchResult } from "../search/engine.js";

export function formatJson(result: SearchResult): string {
	const output = {
		results: result.messages,
		summary: {
			totalMatches: result.stats.totalMatches,
			totalFilesSearched: result.stats.totalFilesSearched,
			messagesByRole: result.stats.messagesByRole,
			uniqueSessions: result.stats.uniqueSessions,
			timeRange: result.stats.timeRange,
			searchDurationMs: result.durationMs,
		},
	};

	return JSON.stringify(output, null, 2);
}
