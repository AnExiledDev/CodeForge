import { mkdirSync } from "fs";
import { homedir } from "os";
import { resolve } from "path";
import type { ManifestEntry, SettingsJson } from "../schemas/config.js";

export async function loadSettings(path: string): Promise<SettingsJson> {
	try {
		return await Bun.file(path).json();
	} catch {
		return {};
	}
}

export async function writeSettings(
	path: string,
	settings: SettingsJson,
): Promise<void> {
	const dir = resolve(path, "..");
	mkdirSync(dir, { recursive: true });
	await Bun.write(path, JSON.stringify(settings, null, 2) + "\n");
}

export function findDeployedSettings(): string {
	return resolve(homedir(), ".claude/settings.json");
}

export async function loadFileManifest(
	workspaceRoot: string,
): Promise<ManifestEntry[]> {
	try {
		return await Bun.file(
			resolve(workspaceRoot, ".codeforge/file-manifest.json"),
		).json();
	} catch {
		return [];
	}
}
