import { existsSync, statSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import type { Command } from "commander";
import { readMountsJson, writeMountsJson } from "../doctor/mounts.js";

function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

export function registerMountAddCommand(parent: Command): void {
	parent
		.command("add <path>")
		.description(
			"Register a directory for Docker volume mounting (e.g., projects/my-app/node_modules)",
		)
		.action(async (rawPath: string) => {
			const workspaceRoot = process.env.WORKSPACE_ROOT || "/workspaces";

			// Resolve the path — accept both absolute and relative
			let absPath: string;
			if (isAbsolute(rawPath)) {
				absPath = rawPath;
			} else {
				absPath = join(workspaceRoot, rawPath);
			}

			// Validate the path exists and is a directory
			if (!existsSync(absPath)) {
				console.error(`Error: path does not exist: ${absPath}`);
				process.exit(1);
			}

			const stat = statSync(absPath);
			if (!stat.isDirectory()) {
				console.error(`Error: path is not a directory: ${absPath}`);
				process.exit(1);
			}

			// Convert to relative path from workspace root
			const relPath = relative(workspaceRoot, absPath).replaceAll("\\", "/");
			if (relPath.startsWith("..")) {
				console.error(
					`Error: path must be within workspace root (${workspaceRoot})`,
				);
				process.exit(1);
			}

			// Read existing mounts.json
			const codeforgeDir = join(workspaceRoot, ".codeforge");
			const mountsPath = join(codeforgeDir, "mounts.json");

			if (!existsSync(codeforgeDir)) {
				await mkdir(codeforgeDir, { recursive: true });
			}

			const mounts = await readMountsJson(mountsPath);

			// Check for duplicates
			const existing = mounts.volumes.find((v) => v.path === relPath);
			if (existing) {
				console.log(
					`Already registered: ${relPath} (source: ${existing.source}, added: ${existing.added})`,
				);
				return;
			}

			// Add the entry
			mounts.volumes.push({
				path: relPath,
				source: "user",
				signal: "manual",
				added: todayIso(),
			});

			await writeMountsJson(mountsPath, mounts);

			console.log(`Added ${relPath} to .codeforge/mounts.json`);
			console.log("");
			console.log(
				"A container rebuild is needed for volume mounts to take effect.",
			);
			console.log(
				"  From VS Code: Ctrl+Shift+P → 'Dev Containers: Rebuild Container'",
			);
			console.log(
				"  From host terminal: codeforge container rebuild",
			);
		});
}
