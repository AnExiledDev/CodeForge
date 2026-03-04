export interface HistoryEntry {
	display: string;
	sessionId: string;
	project: string;
	timestamp: string;
	pastedContents?: unknown;
}
