// --- Content Block types ---

export interface TextBlock {
	type: "text";
	text: string;
}

export interface ToolUseBlock {
	type: "tool_use";
	id: string;
	name: string;
	input: unknown;
}

export interface ToolResultBlock {
	type: "tool_result";
	tool_use_id: string;
	content: string | unknown[];
}

export interface ThinkingBlock {
	type: "thinking";
	thinking: string;
}

export type ContentBlock =
	| TextBlock
	| ToolUseBlock
	| ToolResultBlock
	| ThinkingBlock;

// --- Raw JSONL message shape (as stored by Claude Code) ---
// All message types share these base fields.

export interface MessageBase {
	parentUuid?: string | null;
	sessionId: string;
	uuid: string;
	timestamp: string;
	cwd?: string;
	userType?: string;
	version?: string | number;
	isSidechain?: boolean;
	type: string;
}

// User messages: content is inside a `message` wrapper
export interface UserMessage extends MessageBase {
	type: "user";
	message: {
		role: "user";
		content: string;
	};
}

// Assistant messages: content blocks inside a `message` wrapper
export interface AssistantMessage extends MessageBase {
	type: "assistant";
	message: {
		role: "assistant";
		model?: string;
		content: ContentBlock[];
		[key: string]: unknown;
	};
}

// System messages: variable structure, may have subtype/hookInfos/etc.
export interface SystemMessage extends MessageBase {
	type: "system";
	subtype?: string;
	isMeta?: boolean;
	// System messages don't have a consistent content field
	[key: string]: unknown;
}

// Summary messages
export interface SummaryMessage extends MessageBase {
	type: "summary";
	summary: string;
	leafUuid: string;
}

// Types we skip during search (no searchable content)
// progress, queue-operation, file-history-snapshot

// Discriminated union of searchable types
export type SessionMessage =
	| UserMessage
	| AssistantMessage
	| SystemMessage
	| SummaryMessage;

// --- Searchable message (normalized for output) ---

export interface SearchableMessage {
	type: string;
	content: string;
	sessionId: string;
	timestamp: string;
	cwd?: string;
	filePath: string;
	uuid: string;
}

// --- Text extraction ---

function extractContentBlockText(block: ContentBlock): string {
	switch (block.type) {
		case "text":
			return block.text;
		case "tool_use":
			return typeof block.input === "string"
				? block.input
				: JSON.stringify(block.input);
		case "tool_result":
			return typeof block.content === "string"
				? block.content
				: JSON.stringify(block.content);
		case "thinking":
			return block.thinking;
		default:
			return "";
	}
}

// Searchable message types — skip progress, queue-operation, file-history-snapshot
const SEARCHABLE_TYPES = new Set(["user", "assistant", "system", "summary"]);

export function isSearchableType(type: string): boolean {
	return SEARCHABLE_TYPES.has(type);
}

export function extractSearchableText(msg: SessionMessage): string {
	switch (msg.type) {
		case "summary":
			return msg.summary ?? "";
		case "system":
			// System messages have no consistent content field
			// Extract subtype for minimal searchability
			return msg.subtype ?? "";
		case "user":
			return msg.message?.content ?? "";
		case "assistant": {
			const blocks = msg.message?.content;
			if (!Array.isArray(blocks)) return "";
			return blocks.map(extractContentBlockText).filter(Boolean).join("\n");
		}
		default:
			return "";
	}
}

// --- Conversion ---

export function toSearchableMessage(
	msg: SessionMessage,
	filePath: string,
): SearchableMessage {
	return {
		type: msg.type,
		content: extractSearchableText(msg),
		sessionId: msg.sessionId,
		timestamp: msg.timestamp,
		cwd: msg.cwd,
		filePath,
		uuid: msg.uuid,
	};
}
