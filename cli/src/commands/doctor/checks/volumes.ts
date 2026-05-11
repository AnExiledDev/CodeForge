import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { readMountsJson, writeMountsJson } from "../mounts.js";
import type { MountEntry } from "../mounts.js";
import type { CheckResult } from "../types.js";
import { SLOW_FS_TYPES, spawn } from "../util.js";

interface VolumeCandidate {
	pattern: string;
	contextFiles: string[];
}


const VOLUME_CANDIDATES: VolumeCandidate[] = [
	{ pattern: "node_modules", contextFiles: ["package.json"] },
	{
		pattern: ".next",
		contextFiles: ["next.config.js", "next.config.ts", "next.config.mjs"],
	},
	{ pattern: ".nuxt", contextFiles: ["nuxt.config.ts", "nuxt.config.js"] },
	{
		pattern: ".svelte-kit",
		contextFiles: ["svelte.config.js", "svelte.config.ts"],
	},
	{
		pattern: ".venv",
		contextFiles: ["pyproject.toml", "requirements.txt"],
	},
	{
		pattern: "venv",
		contextFiles: ["pyproject.toml", "requirements.txt"],
	},
	{ pattern: "target", contextFiles: ["Cargo.toml"] },
	{ pattern: ".turbo", contextFiles: ["turbo.json"] },
];

const CANDIDATE_NAMES = VOLUME_CANDIDATES.map((c) => c.pattern);

function hasContextFile(
	dirPath: string,
	contextFiles: string[],
): string | null {
	const parent = dirname(dirPath);
	for (const cf of contextFiles) {
		if (existsSync(join(dirname(dirPath), cf))) {
			return cf;
		}
		if (existsSync(join(parent, "..", cf))) {
			return cf;
		}
	}
	return null;
}

async function isMountpoint(dirPath: string): Promise<boolean> {
	const { exitCode } = await spawn("mountpoint", ["-q", dirPath]);
	return exitCode === 0;
}

async function getFsType(dirPath: string): Promise<string> {
	const { stdout, exitCode } = await spawn("stat", ["-f", "-c", "%T", dirPath]);
	if (exitCode !== 0) return "unknown";
	return stdout;
}

function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

function sanitizeName(name: string): string {
	return name.replace(/[^a-zA-Z0-9-]/g, "-").replace(/^-+|-+$/g, "");
}

export async function checkVolumeCandidates(
	workspaceRoot: string,
): Promise<CheckResult[]> {
	const nameArgs = CANDIDATE_NAMES.flatMap((n) => ["-name", n, "-o"]);
	// Remove trailing -o
	nameArgs.pop();

	const { stdout, exitCode } = await spawn("find", [
		workspaceRoot,
		"-maxdepth",
		"8",
		"-type",
		"d",
		"(",
		...nameArgs,
		")",
		"-not",
		"-path",
		"*/node_modules/*/node_modules",
	]);

	if (exitCode !== 0 || !stdout) {
		return [
			{
				name: "Volume candidates",
				category: "volumes",
				status: "pass",
				message: "no slow bind-mounted directories detected",
			},
		];
	}

	const dirs = stdout.split("\n").filter(Boolean);
	const results: CheckResult[] = [];

	for (const dirPath of dirs) {
		const dirName = basename(dirPath);
		const candidate = VOLUME_CANDIDATES.find((c) => c.pattern === dirName);
		if (!candidate) continue;

		const contextFile = hasContextFile(dirPath, candidate.contextFiles);
		if (!contextFile) continue;

		const [mounted, fsType] = await Promise.all([
			isMountpoint(dirPath),
			getFsType(dirPath),
		]);

		if (mounted) continue;
		const isSlow = SLOW_FS_TYPES.some((s) => fsType.includes(s));
		if (!isSlow) continue;

		const relPath = relative(workspaceRoot, dirPath);
		const sanitized = sanitizeName(relPath);
		const mountsPath = join(workspaceRoot, ".codeforge", "mounts.json");

		results.push({
			name: `Volume candidate: ${relPath}`,
			category: "volumes",
			status: "warn",
			message: `${dirName} on ${fsType} (slow bind mount)`,
			hint: "Add as Docker volume for faster I/O",
			fix: {
				label: `Add ${relPath} as Docker volume`,
				detail: `Registers ${relPath} in .codeforge/mounts.json so CodeForge can mount it as a Docker volume instead of a bind mount, significantly improving I/O performance.`,
				impact: "requires rebuild",
				requiresRebuild: true,
				rebuildType: "normal",
				apply: async (): Promise<{
					applied: boolean;
					message: string;
				}> => {
					const codeforgeDir = join(workspaceRoot, ".codeforge");
					if (!existsSync(codeforgeDir)) {
						await mkdir(codeforgeDir, { recursive: true });
					}

					const mounts = await readMountsJson(mountsPath);

					const existing = mounts.volumes.findIndex((v) => v.path === relPath);
					const entry: MountEntry = {
						path: relPath,
						source: "auto",
						signal: contextFile,
						added: todayIso(),
					};

					if (existing >= 0) {
						// Preserve user entries, update auto entries
						if (mounts.volumes[existing].source === "user") {
							return {
								applied: false,
								message: `${relPath} already has a user-defined mount entry`,
							};
						}
						mounts.volumes[existing] = entry;
					} else {
						mounts.volumes.push(entry);
					}

					await writeMountsJson(mountsPath, mounts);

					// Check if Docker Compose infrastructure exists
					const composeExists = existsSync(
						join(workspaceRoot, ".devcontainer", "docker-compose.yml"),
					);

					if (composeExists) {
						return {
							applied: true,
							message: `Added ${relPath} to .codeforge/mounts.json. Volumes will auto-apply on next container rebuild.`,
						};
					}

					const volumeSnippet = JSON.stringify(
						{
							source: `codeforge-vol-${sanitized}`,
							target: `/workspaces/${relPath}`,
							type: "volume",
						},
						null,
						"  ",
					);

					return {
						applied: true,
						message: `Added ${relPath} to .codeforge/mounts.json.\nTo apply manually in devcontainer.json, add to "mounts":\n${volumeSnippet}`,
					};
				},
			},
		});
	}

	if (results.length === 0) {
		return [
			{
				name: "Volume candidates",
				category: "volumes",
				status: "pass",
				message: "no slow bind-mounted directories detected",
			},
		];
	}

	return results;
}
