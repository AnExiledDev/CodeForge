import { statSync } from "fs";
import { homedir } from "os";
import { resolve } from "path";

const DEFAULT_PATTERN = "**/*.jsonl";
const DEFAULT_BASE_DIR = ".claude/projects";

export async function discoverSessionFiles(
	pattern?: string,
): Promise<string[]> {
	let globPattern: string;
	let scanPath: string;

	if (pattern) {
		// Expand ~ to home directory
		const expanded = pattern.startsWith("~")
			? pattern.replace(/^~/, process.env.HOME || homedir())
			: pattern;
		// Resolve to absolute path
		globPattern = resolve(expanded);

		// Split into base directory and glob portion
		// Find the first segment containing a glob character
		const parts = globPattern.split("/");
		const baseparts: string[] = [];
		const globParts: string[] = [];
		let foundGlob = false;
		for (const part of parts) {
			if (!foundGlob && !/[*?{}[\]]/.test(part)) {
				baseparts.push(part);
			} else {
				foundGlob = true;
				globParts.push(part);
			}
		}

		scanPath = baseparts.join("/") || "/";
		globPattern = globParts.join("/") || "**/*.jsonl";
	} else {
		const home = process.env.HOME || homedir();
		scanPath = resolve(home, DEFAULT_BASE_DIR);
		globPattern = DEFAULT_PATTERN;
	}

	const glob = new Bun.Glob(globPattern);
	const files: { path: string; mtime: number }[] = [];

	for await (const entry of glob.scan({ cwd: scanPath, absolute: true })) {
		try {
			const stat = statSync(entry);
			files.push({ path: entry, mtime: stat.mtimeMs });
		} catch {
			// Skip files we can't stat
		}
	}

	// Sort by modification time, newest first
	files.sort((a, b) => b.mtime - a.mtime);

	return files.map((f) => f.path);
}
