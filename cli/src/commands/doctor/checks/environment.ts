import { homedir } from "node:os";
import { join } from "node:path";
import type { CheckResult } from "../types.js";
import { SLOW_FS_TYPES, spawn } from "../util.js";

export async function checkWorkspaceFs(): Promise<CheckResult> {
	const target = process.env.WORKSPACE_ROOT || "/workspaces";
	const { stdout, exitCode } = await spawn("stat", ["-f", "-c", "%T", target]);
	if (exitCode !== 0) {
		return {
			name: "Workspace filesystem",
			category: "environment",
			status: "info",
			message: "unable to detect (stat -f unavailable)",
		};
	}
	const fsType = stdout.toLowerCase();
	const isSlow = SLOW_FS_TYPES.some((s) => fsType.includes(s));
	if (isSlow) {
		return {
			name: "Workspace filesystem",
			category: "environment",
			status: "warn",
			message: `${fsType} (slow)`,
			hint: "Move project to WSL filesystem for faster I/O: \\\\wsl$\\<distro>\\home\\...",
		};
	}
	return {
		name: "Workspace filesystem",
		category: "environment",
		status: "pass",
		message: `${fsType} (fast)`,
	};
}

export async function checkTmpdir(): Promise<CheckResult> {
	const tmpdir = process.env.TMPDIR;
	if (!tmpdir) {
		return {
			name: "TMPDIR location",
			category: "environment",
			status: "pass",
			message: "unset (using container /tmp)",
		};
	}
	if (tmpdir === "/tmp" || tmpdir.startsWith("/tmp/")) {
		return {
			name: "TMPDIR location",
			category: "environment",
			status: "pass",
			message: `${tmpdir} (fast)`,
		};
	}
	// Check if TMPDIR is on a slow filesystem
	const { stdout, exitCode } = await spawn("stat", ["-f", "-c", "%T", tmpdir]);
	if (exitCode === 0) {
		const fsType = stdout.toLowerCase();
		const isSlow = SLOW_FS_TYPES.some((s) => fsType.includes(s));
		if (isSlow) {
			return {
				name: "TMPDIR location",
				category: "environment",
				status: "warn",
				message: `${tmpdir} on ${fsType} (slow)`,
				hint: "Unset TMPDIR to use container /tmp",
				fix: {
					label: "Move TMPDIR to /tmp",
					detail:
						"Sets TMPDIR=/tmp so temporary files use the container's fast tmpfs instead of the slow bind mount.",
					impact: "1 env var change, no rebuild needed",
					requiresRebuild: false,
					apply: async () => {
						// Write to shell profile to persist
						const profilePath = join(homedir(), ".bashrc");
						const line = "\nexport TMPDIR=/tmp\n";
						await Bun.write(
							profilePath,
							(await Bun.file(profilePath).text()) + line,
						);
						process.env.TMPDIR = "/tmp";
						return { applied: true, message: "Added TMPDIR=/tmp to ~/.bashrc" };
					},
				},
			};
		}
	}
	return {
		name: "TMPDIR location",
		category: "environment",
		status: "info",
		message: `${tmpdir}`,
	};
}

export async function checkCacheDirs(): Promise<CheckResult> {
	const home = homedir();
	const dirs = [
		{ path: join(home, ".cache"), label: "~/.cache" },
		{ path: join(home, ".npm"), label: "~/.npm" },
		{ path: join(home, ".bun/install/cache"), label: "~/.bun/install/cache" },
	];

	const results = await Promise.all(
		dirs.map(async ({ path, label }) => {
			const { stdout, exitCode } = await spawn("mountpoint", ["-q", path]);
			return { label, isMount: exitCode === 0 };
		}),
	);

	const onVolume = results.filter((r) => r.isMount).map((r) => r.label);
	const notOnVolume = results.filter((r) => !r.isMount).map((r) => r.label);

	if (onVolume.length === dirs.length) {
		return {
			name: "Cache directories on volumes",
			category: "environment",
			status: "pass",
			message: "all volume-backed",
		};
	}
	if (onVolume.length > 0) {
		return {
			name: "Cache directories on volumes",
			category: "environment",
			status: "info",
			message: `volume: ${onVolume.join(", ")}; local: ${notOnVolume.join(", ")}`,
		};
	}
	return {
		name: "Cache directories on volumes",
		category: "environment",
		status: "info",
		message: "none volume-backed",
	};
}

export async function checkDockerMemory(): Promise<CheckResult> {
	// Try cgroup v2 first, then v1
	for (const path of [
		"/sys/fs/cgroup/memory.max",
		"/sys/fs/cgroup/memory/memory.limit_in_bytes",
	]) {
		try {
			const file = Bun.file(path);
			const text = (await file.text()).trim();
			if (text === "max" || text === "9223372036854771712") {
				return {
					name: "Container memory",
					category: "environment",
					status: "info",
					message: "unlimited",
				};
			}
			const bytes = parseInt(text, 10);
			if (!isNaN(bytes)) {
				const gb = (bytes / (1024 * 1024 * 1024)).toFixed(1);
				return {
					name: "Container memory",
					category: "environment",
					status: "info",
					message: `${gb}GB`,
				};
			}
		} catch {}
	}
	return {
		name: "Container memory",
		category: "environment",
		status: "info",
		message: "unable to detect",
	};
}
