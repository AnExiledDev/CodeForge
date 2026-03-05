import type { SearchableMessage } from "../schemas/session-message.js";
import { normalizePath } from "../utils/platform.js";

export interface FilterOptions {
	role?: string;
	project?: string;
	after?: Date;
	before?: Date;
	sessionId?: string;
}

export function createFilter(
	options: FilterOptions,
): (msg: SearchableMessage) => boolean {
	const filters: ((msg: SearchableMessage) => boolean)[] = [];

	if (options.role) {
		const role = options.role.toLowerCase();
		filters.push((msg) => msg.type.toLowerCase() === role);
	}

	if (options.project) {
		// Normalize: convert backslashes and strip trailing separators
		const project = normalizePath(options.project).replace(/[/\\]+$/, "");
		filters.push((msg) => {
			if (!msg.cwd) return false;
			const dir = normalizePath(msg.cwd).replace(/[/\\]+$/, "");
			return dir === project || dir.startsWith(project + "/");
		});
	}

	if (options.after) {
		const after = options.after.getTime();
		filters.push((msg) => {
			const ts = new Date(msg.timestamp).getTime();
			return !isNaN(ts) && ts >= after;
		});
	}

	if (options.before) {
		const before = options.before.getTime();
		filters.push((msg) => {
			const ts = new Date(msg.timestamp).getTime();
			return !isNaN(ts) && ts <= before;
		});
	}

	if (options.sessionId) {
		const sid = options.sessionId;
		filters.push((msg) => msg.sessionId === sid);
	}

	// Return composed filter: all conditions must pass
	if (filters.length === 0) {
		return () => true;
	}

	return (msg) => {
		for (const fn of filters) {
			if (!fn(msg)) return false;
		}
		return true;
	};
}
