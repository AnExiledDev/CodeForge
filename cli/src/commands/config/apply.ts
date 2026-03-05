import chalk from "chalk";
import type { Command } from "commander";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { homedir } from "os";
import { basename, dirname, resolve } from "path";
import { loadFileManifest } from "../../loaders/config-loader.js";

interface ConfigApplyOptions {
	dryRun?: boolean;
	force?: boolean;
	color?: boolean;
}

function findWorkspaceRoot(): string | null {
	let dir = process.cwd();

	while (true) {
		if (existsSync(resolve(dir, ".codeforge"))) {
			return dir;
		}
		const parent = resolve(dir, "..");
		if (parent === dir) return null;
		dir = parent;
	}
}

function expandVariables(path: string): string {
	return path
		.replace(/\$\{CLAUDE_CONFIG_DIR\}/g, resolve(homedir(), ".claude"))
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
						"Error: Could not find .codeforge/ directory in any parent",
					);
					process.exit(1);
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

					const src = resolve(workspaceRoot, ".codeforge", entry.src);
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
						copyFileSync(src, dest);
						updated++;
						console.log(
							`  ${chalk.green("\u2713")} ${entry.src} \u2192 ${displayDest} (updated)`,
						);
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
