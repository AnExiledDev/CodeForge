import { readFile, writeFile } from "node:fs/promises";

export interface MountsJson {
	version: number;
	volumes: MountEntry[];
}

export interface MountEntry {
	path: string;
	source: "auto" | "user";
	signal: string;
	added: string;
}

export async function readMountsJson(filePath: string): Promise<MountsJson> {
	try {
		const raw = await readFile(filePath, "utf-8");
		const parsed = JSON.parse(raw) as MountsJson;
		if (parsed.version === 1 && Array.isArray(parsed.volumes)) {
			return parsed;
		}
	} catch {
		// file doesn't exist or is invalid
	}
	return { version: 1, volumes: [] };
}

export async function writeMountsJson(
	filePath: string,
	data: MountsJson,
): Promise<void> {
	await writeFile(filePath, JSON.stringify(data, null, "\t") + "\n", "utf-8");
}
