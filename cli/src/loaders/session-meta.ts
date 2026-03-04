import type {
	SessionMessage,
	ToolUseBlock,
} from "../schemas/session-message.js";
import { readLines } from "../search/engine.js";

export interface SessionMeta {
	sessionId: string;
	slug?: string;
	teamName?: string;
	cwd?: string;
	gitBranch?: string;
	filesRead: string[];
	filesWritten: string[];
	filesEdited: string[];
	messageCount: number;
	timeRange: { start: string; end: string } | null;
}

const SEARCHABLE_TYPES = new Set(["user", "assistant", "system", "summary"]);
const MAX_FILE_PATHS = 500;

export async function extractSessionMeta(
	filePath: string,
): Promise<SessionMeta> {
	let sessionId = "";
	let slug: string | undefined;
	let teamName: string | undefined;
	let cwd: string | undefined;
	let gitBranch: string | undefined;
	const filesRead = new Set<string>();
	const filesWritten = new Set<string>();
	const filesEdited = new Set<string>();
	let messageCount = 0;
	let earliest: string | null = null;
	let latest: string | null = null;

	for await (const line of readLines(filePath)) {
		let raw: Record<string, unknown>;
		try {
			raw = JSON.parse(line) as Record<string, unknown>;
		} catch {
			continue;
		}

		// Extract sessionId from first valid message
		if (!sessionId && typeof raw.sessionId === "string") {
			sessionId = raw.sessionId;
		}

		// Extract slug (first found)
		if (!slug && typeof raw.slug === "string") {
			slug = raw.slug;
		}

		// Extract teamName (first found)
		if (!teamName && typeof raw.teamName === "string") {
			teamName = raw.teamName;
		}

		// Extract cwd (first found)
		if (!cwd && typeof raw.cwd === "string") {
			cwd = raw.cwd;
		}

		// Extract gitBranch (first found)
		if (!gitBranch && typeof raw.gitBranch === "string") {
			gitBranch = raw.gitBranch;
		}

		// Track time range
		if (typeof raw.timestamp === "string") {
			if (!earliest || raw.timestamp < earliest) {
				earliest = raw.timestamp;
			}
			if (!latest || raw.timestamp > latest) {
				latest = raw.timestamp;
			}
		}

		// Count searchable messages
		if (typeof raw.type === "string" && SEARCHABLE_TYPES.has(raw.type)) {
			messageCount++;
		}

		// Extract file paths from assistant tool_use blocks
		if (raw.type === "assistant") {
			const msg = raw as unknown as SessionMessage;
			if (msg.type === "assistant" && Array.isArray(msg.message?.content)) {
				for (const block of msg.message.content) {
					if (block.type !== "tool_use") continue;
					const toolBlock = block as ToolUseBlock;
					const input = toolBlock.input as Record<string, unknown> | null;
					if (!input || typeof input.file_path !== "string") continue;
					const fp = input.file_path;

					if (toolBlock.name === "Read" && filesRead.size < MAX_FILE_PATHS) {
						filesRead.add(fp);
					} else if (
						toolBlock.name === "Write" &&
						filesWritten.size < MAX_FILE_PATHS
					) {
						filesWritten.add(fp);
					} else if (
						toolBlock.name === "Edit" &&
						filesEdited.size < MAX_FILE_PATHS
					) {
						filesEdited.add(fp);
					}
				}
			}
		}
	}

	return {
		sessionId,
		slug,
		teamName,
		cwd,
		gitBranch,
		filesRead: [...filesRead],
		filesWritten: [...filesWritten],
		filesEdited: [...filesEdited],
		messageCount,
		timeRange: earliest && latest ? { start: earliest, end: latest } : null,
	};
}
