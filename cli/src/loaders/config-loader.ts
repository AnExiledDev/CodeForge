import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { isAbsolute, relative, resolve } from "path";
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
	const defaultManifest = resolve(
		workspaceRoot,
		".devcontainer/defaults/codeforge/file-manifest.json",
	);
	if (!existsSync(defaultManifest)) {
		return [];
	}

	const defaultEntries = await readManifest(defaultManifest);
	const userEntries = await readManifest(
		resolve(workspaceRoot, ".codeforge/file-manifest.json"),
	);

	return mergeManifestEntries(defaultEntries, userEntries);
}

export function resolveManifestSource(
	workspaceRoot: string,
	src: string,
): string | null {
	for (const root of [
		resolve(workspaceRoot, ".codeforge"),
		resolve(workspaceRoot, ".devcontainer/.generated/codeforge"),
		resolve(workspaceRoot, ".devcontainer/defaults/codeforge"),
	]) {
		const candidate = resolve(root, src);
		if (!isPathWithin(root, candidate)) {
			continue;
		}
		if (existsSync(candidate)) {
			return candidate;
		}
	}
	return null;
}

async function readManifest(path: string): Promise<ManifestEntry[]> {
	if (!existsSync(path)) {
		return [];
	}
	return await Bun.file(path).json();
}

function mergeManifestEntries(
	defaultEntries: ManifestEntry[],
	userEntries: ManifestEntry[],
): ManifestEntry[] {
	const byId = new Map<string, ManifestEntry>();
	for (const entry of [...defaultEntries, ...userEntries]) {
		const id = entry.id || entry.src;
		if (!id) {
			continue;
		}
		const previous = byId.get(id);
		const merged = {
			...(previous ?? {}),
			...entry,
			id,
			overwrite: entry.overwrite ?? previous?.overwrite ?? "if-changed",
		};
		if (entry.disabled === true) {
			merged.enabled = false;
		}
		byId.set(id, merged);
	}
	return [...byId.values()];
}

function isPathWithin(root: string, candidate: string): boolean {
	const rel = relative(resolve(root), resolve(candidate));
	return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}
