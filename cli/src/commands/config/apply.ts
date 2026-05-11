import chalk from "chalk";
import { spawnSync } from "child_process";
import type { Command } from "commander";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "fs";
import { homedir } from "os";
import { basename, dirname, resolve } from "path";
import {
	loadFileManifest,
	resolveManifestSource,
} from "../../loaders/config-loader.js";

interface ConfigApplyOptions {
	dryRun?: boolean;
	force?: boolean;
	color?: boolean;
}

function findWorkspaceRoot(): string | null {
	let dir = process.cwd();

	while (true) {
		if (
			existsSync(resolve(dir, ".codeforge")) ||
			existsSync(resolve(dir, ".devcontainer/defaults/codeforge"))
		) {
			return dir;
		}
		const parent = resolve(dir, "..");
		if (parent === dir) return null;
		dir = parent;
	}
}

function expandVariables(path: string): string {
	return path
		.replace(/\$\{WORKSPACE_ROOT\}/g, findWorkspaceRoot() ?? process.cwd())
		.replace(
			/\$\{CODEFORGE_DIR\}/g,
			resolve(findWorkspaceRoot() ?? process.cwd(), ".codeforge"),
		)
		.replace(/\$\{HOME\}/g, homedir());
}

function filesAreIdentical(a: string, b: string): boolean {
	try {
		const contentA = readFileSync(a);
		const contentB = readFileSync(b);
		return contentA.equals(contentB);
	} catch {
		return false;
	}
}

function mergeSettingsForDeploy(srcPath: string, destPath: string): boolean {
	try {
		const srcContent = readFileSync(srcPath, "utf-8");
		const destContent = readFileSync(destPath, "utf-8");
		const srcSettings = JSON.parse(srcContent);
		const destSettings = JSON.parse(destContent);

		if (!destSettings.enabledPlugins) return false;

		// Start with source, overlay user's false values for enabledPlugins
		const merged = { ...srcSettings };
		if (!merged.enabledPlugins) merged.enabledPlugins = {};

		for (const [key, value] of Object.entries(destSettings.enabledPlugins)) {
			if (value === false) {
				merged.enabledPlugins[key] = false;
			}
		}

		writeFileSync(destPath, JSON.stringify(merged, null, 2) + "\n");
		return true;
	} catch {
		return false;
	}
}

export function registerConfigApplyCommand(parent: Command): void {
	parent
		.command("apply")
		.description("Deploy configuration files from workspace to system")
		.option("--dry-run", "Show what would happen without writing files")
		.option("--force", "Override overwrite strategy and deploy all files")
		.option("--no-color", "Disable colored output")
		.action(async (options: ConfigApplyOptions) => {
			try {
				if (!options.color) {
					chalk.level = 0;
				}

				const workspaceRoot = findWorkspaceRoot();
				if (!workspaceRoot) {
					console.error(
						"Error: Could not find CodeForge workspace in any parent",
					);
					process.exit(1);
				}

				const generator = resolve(
					workspaceRoot,
					".devcontainer/scripts/generate-settings-profiles.js",
				);
				if (existsSync(generator)) {
					const result = spawnSync("node", [generator, "--if-stale"], {
						stdio: "inherit",
						env: {
							...process.env,
							WORKSPACE_ROOT: workspaceRoot,
							CODEFORGE_DIR: resolve(workspaceRoot, ".codeforge"),
						},
					});
					if (result.status !== 0) {
						process.exit(result.status ?? 1);
					}
				}

				const manifest = await loadFileManifest(workspaceRoot);
				if (manifest.length === 0) {
					console.log("No files in manifest.");
					return;
				}

				console.log(
					options.dryRun
						? "Dry run — no files will be written:\n"
						: "Deploying configuration files...\n",
				);

				let updated = 0;
				let unchanged = 0;
				let skipped = 0;

				for (const entry of manifest) {
					if (entry.enabled === false) {
						skipped++;
						continue;
					}

					const src = resolveManifestSource(workspaceRoot, entry.src);
					if (!src) {
						skipped++;
						console.log(
							`  ${chalk.yellow("\u2717")} ${entry.src} (source missing)`,
						);
						continue;
					}
					const destDir = expandVariables(entry.dest);
					const destFilename = entry.destFilename ?? basename(entry.src);
					const dest = resolve(destDir, destFilename);

					const displayDest = dest
						.replace(homedir(), "~")
						.replace(/\/\//g, "/");

					const destExists = existsSync(dest);

					if (!options.force) {
						if (entry.overwrite === "never" && destExists) {
							skipped++;
							console.log(
								`  ${chalk.yellow("\u2717")} ${entry.src} \u2192 ${displayDest} (skipped, never overwrite)`,
							);
							continue;
						}

						// Note: TOCTOU race possible if file changes between check and copy.
						// Acceptable for config deployment — files are not security-sensitive.
						if (
							entry.overwrite === "if-changed" &&
							destExists &&
							filesAreIdentical(src, dest)
						) {
							unchanged++;
							console.log(
								`  ${chalk.dim("\u25CB")} ${entry.src} \u2192 ${displayDest} (unchanged)`,
							);
							continue;
						}
					}

					if (options.dryRun) {
						updated++;
						console.log(
							`  ${chalk.green("\u2713")} ${entry.src} \u2192 ${displayDest} (would update)`,
						);
					} else {
						mkdirSync(dirname(dest), { recursive: true });
						if (
							entry.id.startsWith("claude.settings") &&
							destExists &&
							mergeSettingsForDeploy(src, dest)
						) {
							updated++;
							console.log(
								`  ${chalk.green("\u2713")} ${entry.src} \u2192 ${displayDest} (merged)`,
							);
						} else {
							copyFileSync(src, dest);
							updated++;
							console.log(
								`  ${chalk.green("\u2713")} ${entry.src} \u2192 ${displayDest} (updated)`,
							);
						}
					}
				}

				const total = updated + unchanged + skipped;
				const parts: string[] = [];
				if (updated > 0) parts.push(`${updated} updated`);
				if (unchanged > 0) parts.push(`${unchanged} unchanged`);
				if (skipped > 0) parts.push(`${skipped} skipped`);

				console.log(`\n${total} files processed (${parts.join(", ")})`);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				console.error(`Error: ${message}`);
				process.exit(1);
			}
		});
}
