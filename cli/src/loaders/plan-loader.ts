import { homedir } from "os";
import { basename, resolve } from "path";
import type { PlanMeta } from "../schemas/plan.js";

export async function loadPlans(): Promise<PlanMeta[]> {
	const basePath = resolve(homedir(), ".claude/plans");
	const results: PlanMeta[] = [];

	try {
		const glob = new Bun.Glob("*.md");
		for await (const entry of glob.scan({
			cwd: basePath,
			absolute: true,
		})) {
			try {
				const content = await Bun.file(entry).text();
				const slug = basename(entry, ".md");

				// Extract title from first heading line
				let title = slug;
				for (const line of content.split(/\r?\n/)) {
					if (line.startsWith("# ")) {
						title = line.slice(2).trim();
						break;
					}
				}

				results.push({ slug, filePath: entry, title, content });
			} catch {}
		}
	} catch {
		// Directory doesn't exist — return empty
		return [];
	}

	return results;
}
