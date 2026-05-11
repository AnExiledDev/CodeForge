import chalk from "chalk";
import type { Command } from "commander";
import { existsSync, mkdirSync } from "fs";
import { relative, resolve } from "path";
import {
	closeDatabase,
	deleteFileAndSymbols,
	insertFiles,
	insertSymbols,
	openDatabase,
	rebuildFts,
	upsertFolders,
} from "../../indexer/db.js";
import { checkSgInstalled, extractSymbols } from "../../indexer/extractor.js";
import { extractFolderDocs } from "../../indexer/folders.js";
import {
	collectDirectories,
	getLanguageForExtension,
	hashFileContent,
	scanDirectory,
} from "../../indexer/scanner.js";
import { formatBuildJson } from "../../output/index-json.js";
import { formatBuildSummary } from "../../output/index-text.js";
import type { IndexedFile } from "../../schemas/index.js";

interface BuildCommandOptions {
	format: string;
	color?: boolean;
}

function findWorkspaceRoot(): string | null {
	let dir = process.cwd();
	while (true) {
		if (existsSync(resolve(dir, ".codeforge"))) return dir;
		const parent = resolve(dir, "..");
		if (parent === dir) return null;
		dir = parent;
	}
}

export function registerIndexBuildCommand(parent: Command): void {
	parent
		.command("build")
		.description("Build or incrementally update the codebase symbol index")
		.argument("[path]", "Target directory (defaults to workspace root)")
		.option("-f, --format <format>", "Output format: text|json", "text")
		.option("--no-color", "Disable colored output")
		.action(async (path: string | undefined, options: BuildCommandOptions) => {
			try {
				if (!options.color) chalk.level = 0;

				const start = Date.now();
				const workspaceRoot = findWorkspaceRoot();
				if (!workspaceRoot) {
					console.error(
						"Error: No .codeforge directory found. Are you in a CodeForge workspace?",
					);
					process.exit(1);
				}

				const targetPath = path ? resolve(process.cwd(), path) : workspaceRoot;
				const dataDir = resolve(workspaceRoot, ".codeforge", "data");
				mkdirSync(dataDir, { recursive: true });

				const dbPath = resolve(dataDir, "code-index.db");

				console.error(chalk.dim("Checking ast-grep installation..."));
				const sgInstalled = await checkSgInstalled();
				if (!sgInstalled) {
					console.error(
						"Error: ast-grep (sg) is not installed. Install it with: npm i -g @ast-grep/cli",
					);
					process.exit(1);
				}

				console.error(chalk.dim("Scanning files..."));
				const db = openDatabase(dbPath);
				const scanned = await scanDirectory(targetPath, db, workspaceRoot);

				const filesToProcess = [...scanned.newFiles, ...scanned.changedFiles];
				let totalSymbols = 0;

				if (filesToProcess.length > 0) {
					// Group files by language
					const byLang = new Map<string, string[]>();
					for (const relPath of filesToProcess) {
						const ext = "." + (relPath.split(".").pop() ?? "");
						const lang = getLanguageForExtension(ext);
						if (lang) {
							const group = byLang.get(lang) ?? [];
							group.push(relPath);
							byLang.set(lang, group);
						}
					}

					// Read all file content BEFORE any DB mutations
					const fileData = new Map<
						string,
						{ hash: string; content: string; ext: string; lang: string }
					>();
					for (const relPath of filesToProcess) {
						const absPath = resolve(workspaceRoot, relPath);
						const ext = "." + (relPath.split(".").pop() ?? "");
						const lang = getLanguageForExtension(ext) ?? "unknown";
						const hash = await hashFileContent(absPath);
						const content = await Bun.file(absPath).text();
						fileData.set(relPath, { hash, content, ext, lang });
					}

					// Delete old data for changed + deleted files
					for (const file of [
						...scanned.changedFiles,
						...scanned.deletedFiles,
					]) {
						deleteFileAndSymbols(db, file);
					}

					// Insert file records using cached data
					const fileRecords: IndexedFile[] = [];
					for (const relPath of filesToProcess) {
						const data = fileData.get(relPath)!;
						const lineCount = data.content.split("\n").length;
						const size = Buffer.byteLength(data.content, "utf-8");
						fileRecords.push({
							path: relPath,
							hash: data.hash,
							size,
							language: data.lang,
							lineCount,
							lastIndexed: new Date()
								.toISOString()
								.replace("T", " ")
								.substring(0, 19),
						});
					}
					insertFiles(db, fileRecords);

					console.error(chalk.dim("Extracting symbols..."));
					for (const [lang, relPaths] of byLang) {
						const absPaths = relPaths.map((r) => resolve(workspaceRoot, r));
						const symbols = await extractSymbols(absPaths, lang);
						if (symbols.length > 0) {
							const remapped = symbols.map((s: (typeof symbols)[number]) => ({
								...s,
								filePath: relative(workspaceRoot, s.filePath),
							}));
							insertSymbols(db, remapped);
							totalSymbols += symbols.length;
						}
					}
				} else {
					// Still handle deletions
					for (const file of scanned.deletedFiles) {
						deleteFileAndSymbols(db, file);
					}
				}

				console.error(chalk.dim("Updating folder index..."));
				const directories = await collectDirectories(targetPath, workspaceRoot);
				const folderDocs = await extractFolderDocs(directories, workspaceRoot);
				upsertFolders(db, folderDocs);

				console.error(chalk.dim("Rebuilding search index..."));
				rebuildFts(db);
				closeDatabase(db);

				const durationMs = Date.now() - start;
				const buildResult = { scanned, symbolCount: totalSymbols, durationMs };

				if (options.format === "json") {
					console.log(formatBuildJson(buildResult));
				} else {
					console.log(formatBuildSummary(buildResult));
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				console.error(`Error: ${message}`);
				process.exit(1);
			}
		});
}
