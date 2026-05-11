import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import { readMountsJson } from "../doctor/mounts.js";

const TIP =
	"Tip: use 'codeforge mount add <path>' to register a directory for volume mounting.";

interface ComposeVolume {
	name: string;
	mountPath: string;
}

function readComposeVolumes(workspaceRoot: string): ComposeVolume[] {
	const composePath = join(
		workspaceRoot,
		".devcontainer",
		"docker-compose.yml",
	);
	try {
		const content = readFileSync(composePath, "utf-8");
		const volumes: ComposeVolume[] = [];

		// Match named volume mount lines: "- volume-name:/path"
		// Named volumes start with a letter (not . or / like bind mounts)
		const regex = /^\s+-\s+([a-zA-Z][a-zA-Z0-9_.-]*):(\/.+)$/gm;
		let match = regex.exec(content);
		while (match !== null) {
			volumes.push({ name: match[1], mountPath: match[2] });
			match = regex.exec(content);
		}

		return volumes;
	} catch {
		return [];
	}
}

interface DisplayRow {
	path: string;
	source: string;
	signal: string;
	added: string;
}

export function registerMountListCommand(parent: Command): void {
	parent
		.command("list")
		.description("List configured volume mount directories")
		.option("--format <format>", "Output format: text or json", "text")
		.action(async (options) => {
			const workspaceRoot = process.env.WORKSPACE_ROOT || "/workspaces";
			const mountsPath = join(workspaceRoot, ".codeforge", "mounts.json");
			const mounts = await readMountsJson(mountsPath);
			const composeVolumes = readComposeVolumes(workspaceRoot);

			if (options.format === "json") {
				const output = {
					...mounts,
					composeVolumes: composeVolumes.map((v) => ({
						path: v.mountPath,
						source: "compose" as const,
						volumeName: v.name,
					})),
				};
				console.log(JSON.stringify(output, null, "\t"));
				console.log("");
				console.log(TIP);
				return;
			}

			const rows: DisplayRow[] = [
				...composeVolumes.map((v) => ({
					path: v.mountPath,
					source: "compose",
					signal: v.name,
					added: "—",
				})),
				...mounts.volumes.map((v) => ({
					path: v.path,
					source: v.source,
					signal: v.signal,
					added: v.added,
				})),
			];

			if (rows.length === 0) {
				console.log("No mounts configured.");
				console.log("");
				console.log(TIP);
				return;
			}

			// Column widths — compute dynamically from data
			const headers = {
				path: "PATH",
				source: "SOURCE",
				signal: "SIGNAL",
				added: "ADDED",
			};
			const widths = {
				path: Math.max(
					headers.path.length,
					...rows.map((r) => r.path.length),
				),
				source: Math.max(
					headers.source.length,
					...rows.map((r) => r.source.length),
				),
				signal: Math.max(
					headers.signal.length,
					...rows.map((r) => r.signal.length),
				),
				added: Math.max(
					headers.added.length,
					...rows.map((r) => r.added.length),
				),
			};

			const row = (p: string, s: string, sig: string, a: string) =>
				`${p.padEnd(widths.path)}  ${s.padEnd(widths.source)}  ${sig.padEnd(widths.signal)}  ${a}`;

			console.log(
				row(headers.path, headers.source, headers.signal, headers.added),
			);
			for (const r of rows) {
				console.log(row(r.path, r.source, r.signal, r.added));
			}
			console.log("");
			console.log(TIP);
		});
}
