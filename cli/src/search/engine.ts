import type {
	SearchableMessage,
	SessionMessage,
} from "../schemas/session-message.js";
import {
	isSearchableType,
	toSearchableMessage,
} from "../schemas/session-message.js";
import { discoverSessionFiles } from "../utils/glob.js";
import { parseTime } from "../utils/time.js";
import { createFilter, type FilterOptions } from "./filter.js";
import { evaluate, parse } from "./query-parser.js";

export interface SearchOptions {
	pattern?: string;
	query?: string;
	role?: string;
	project?: string;
	since?: string;
	after?: string;
	before?: string;
	sessionId?: string;
	limit?: number;
}

export interface SearchStats {
	totalMatches: number;
	totalFilesSearched: number;
	messagesByRole: Record<string, number>;
	uniqueSessions: number;
	timeRange: { earliest: string; latest: string } | null;
}

export interface SearchResult {
	messages: SearchableMessage[];
	stats: SearchStats;
	durationMs: number;
}

function resolveTimeFilter(options: SearchOptions): {
	after?: Date;
	before?: Date;
} {
	let after: Date | undefined;
	let before: Date | undefined;

	if (options.since) {
		const parsed = parseTime(options.since);
		if (parsed) after = parsed;
	}
	if (options.after) {
		const parsed = parseTime(options.after);
		if (parsed) after = parsed;
	}
	if (options.before) {
		const parsed = parseTime(options.before);
		if (parsed) before = parsed;
	}

	return { after, before };
}

export async function* readLines(filePath: string): AsyncGenerator<string> {
	const file = Bun.file(filePath);
	const stream = file.stream();
	const decoder = new TextDecoder();
	let buffer = "";

	for await (const chunk of stream) {
		buffer += decoder.decode(chunk, { stream: true });
		const lines = buffer.split("\n");
		// Keep the last partial line in the buffer
		buffer = lines.pop() || "";
		for (const line of lines) {
			if (line.trim()) yield line.replace(/\r$/, "");
		}
	}

	// Flush remaining buffer
	const remaining = buffer + decoder.decode();
	if (remaining.trim()) {
		yield remaining.replace(/\r$/, "");
	}
}

export async function search(options: SearchOptions): Promise<SearchResult> {
	const startTime = performance.now();
	const limit = options.limit ?? 200;

	// Discover files
	const files = await discoverSessionFiles(options.pattern);

	// Parse query
	const queryNode = options.query ? parse(options.query) : null;

	// Build filter
	const { after, before } = resolveTimeFilter(options);
	const filterOpts: FilterOptions = {
		role: options.role,
		project: options.project,
		after,
		before,
		sessionId: options.sessionId,
	};
	const filter = createFilter(filterOpts);

	// Collect matches
	const matches: SearchableMessage[] = [];
	const roleCount: Record<string, number> = {};
	const sessionSet = new Set<string>();
	let totalFilesSearched = 0;

	for (const filePath of files) {
		totalFilesSearched++;

		try {
			for await (const line of readLines(filePath)) {
				let raw: SessionMessage;
				try {
					raw = JSON.parse(line) as SessionMessage;
				} catch {
					// Skip malformed JSON lines
					continue;
				}

				// Must have required fields
				if (!raw.type || !raw.sessionId || !raw.uuid || !raw.timestamp) {
					continue;
				}

				// Skip non-searchable types (progress, queue-operation, etc.)
				if (!isSearchableType(raw.type)) {
					continue;
				}

				const msg = toSearchableMessage(raw, filePath);

				// Apply filters
				if (!filter(msg)) continue;

				// Apply query evaluation
				if (queryNode && !evaluate(queryNode, msg.content)) continue;

				// Track stats
				roleCount[msg.type] = (roleCount[msg.type] || 0) + 1;
				sessionSet.add(msg.sessionId);

				matches.push(msg);

				// Early exit if we have enough matches
				if (matches.length >= limit) break;
			}
		} catch {
			// Skip files we can't read
			continue;
		}

		if (matches.length >= limit) break;
	}

	// Sort by timestamp descending (newest first)
	matches.sort((a, b) => {
		const ta = new Date(a.timestamp).getTime();
		const tb = new Date(b.timestamp).getTime();
		return tb - ta;
	});

	// Trim to limit after sorting
	const results = matches.slice(0, limit);

	// Compute time range
	let timeRange: { earliest: string; latest: string } | null = null;
	if (results.length > 0) {
		// Results are sorted newest-first
		timeRange = {
			earliest: results[results.length - 1].timestamp,
			latest: results[0].timestamp,
		};
	}

	const stats: SearchStats = {
		totalMatches: results.length,
		totalFilesSearched,
		messagesByRole: roleCount,
		uniqueSessions: sessionSet.size,
		timeRange,
	};

	return {
		messages: results,
		stats,
		durationMs: performance.now() - startTime,
	};
}
