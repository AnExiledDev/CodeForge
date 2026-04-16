import chalk from "chalk";
import type { Command } from "commander";
import { stat } from "fs/promises";
import { basename, isAbsolute, resolve } from "path";
import { readLines } from "../../search/engine.js";
import { discoverSessionFiles } from "../../utils/glob.js";
import { parseRelativeTime, parseTime } from "../../utils/time.js";

interface TokensCommandOptions {
	project?: string;
	since?: string;
	until?: string;
	model?: string;
	format: string;
	color?: boolean;
}

interface AssistantMessage {
	type: "assistant";
	timestamp: string;
	sessionId: string;
	message: {
		role: "assistant";
		model?: string;
		content: Array<{ type: string; thinking?: string; text?: string }>;
		usage?: { output_tokens?: number };
	};
}

export interface SessionTokenStats {
	sessionId: string;
	filePath: string;
	project?: string;
	model: string;
	isSubagent: boolean;
	parentProject?: string;
	turns: number;
	turnsWithThinking: number; // Turns that have thinking blocks
	outputTokens: number; // Exact billed tokens from API
	thinkingChars: number; // Visible thinking content
	textChars: number; // Visible text content
	toolChars: number; // Tool use JSON content
}

export interface ModelSummary {
	model: string;
	sessions: number;
	turns: number;
	turnsWithThinking: number;
	outputTokens: number;
	thinkingChars: number;
	textChars: number;
	toolChars: number;
	// Derived metrics
	thinkingDensity: number; // % of turns with thinking
	avgThinkingWhenPresent: number; // Avg chars per thinking turn
	// Session breakdown by intensity
	sessionsNoThinking: number;
	sessionsLight: number; // <5K chars
	sessionsMedium: number; // 5K-50K chars
	sessionsHeavy: number; // 50K+ chars
}

export interface TokenAnalysisResult {
	mainSessions: SessionTokenStats[];
	subagentSessions: SessionTokenStats[];
	modelSummaries: ModelSummary[];
	totalSessions: number;
	totalTurns: number;
	totalOutputTokens: number;
}

function extractProjectFromPath(filePath: string): string | undefined {
	// Path format: ~/.claude/projects/{project-slug}/{session}.jsonl
	// or ~/.claude/projects/{project-slug}/subagents/{session}.jsonl
	const parts = filePath.split("/");
	const projectsIdx = parts.indexOf("projects");
	if (projectsIdx >= 0 && projectsIdx + 1 < parts.length) {
		return parts[projectsIdx + 1];
	}
	return undefined;
}

/**
 * Normalize a user-provided --project value for matching against Claude's
 * on-disk project slugs.
 *
 * Claude encodes project cwds by replacing `/` and `.` with `-`, e.g.
 *   /workspaces/projects/CodeForge  -> -workspaces-projects-CodeForge
 *   /workspaces/.devcontainer       -> -workspaces--devcontainer
 *
 * Behavior:
 * - Absolute paths are converted to slug form.
 * - Relative paths beginning with `./` or `../` are resolved against cwd first.
 * - Plain substrings without separators pass through unchanged so users can
 *   filter with `--project CodeForge` against the slug (backwards-compatible).
 */
export function pathToProjectSlug(input: string): string {
	const looksLikePath =
		isAbsolute(input) || input.startsWith("./") || input.startsWith("../");
	if (looksLikePath) {
		const abs = isAbsolute(input) ? input : resolve(input);
		// Normalize Windows separators so the slug logic (which encodes `/` and
		// `.` as `-`) produces identical output on all platforms. Without this,
		// `resolve("./foo")` on Windows returns `D:\...\foo` and the backslashes
		// leak through unchanged.
		const normalized = abs.replace(/\\/g, "/");
		return normalized.replace(/\/+$/, "").replace(/[./]/g, "-");
	}
	return input;
}

/**
 * Pure check for whether a file's last-modified time falls within an optional
 * [since, until] window. Exported for direct unit testing without fixtures.
 *
 * Semantics:
 * - `since`: mtime must be >= since (inclusive)
 * - `until`: mtime must be <= until (inclusive)
 * - If both bounds are omitted, always returns true.
 */
export function isFileWithinTimeRange(
	mtime: Date,
	since?: Date,
	until?: Date,
): boolean {
	if (since && mtime < since) return false;
	if (until && mtime > until) return false;
	return true;
}

function isSubagentPath(filePath: string): boolean {
	return filePath.includes("/subagents/");
}

function getParentProject(filePath: string): string | undefined {
	if (!isSubagentPath(filePath)) return undefined;
	// subagents folder is inside the project folder
	return extractProjectFromPath(filePath);
}

async function analyzeSessionTokens(
	filePath: string,
): Promise<SessionTokenStats | null> {
	const sessionId = basename(filePath, ".jsonl");
	const project = extractProjectFromPath(filePath);
	const isSubagent = isSubagentPath(filePath);
	const parentProject = getParentProject(filePath);

	let model = "unknown";
	let turns = 0;
	let turnsWithThinking = 0;
	let outputTokens = 0;
	let thinkingChars = 0;
	let textChars = 0;
	let toolChars = 0;

	try {
		for await (const line of readLines(filePath)) {
			let raw: Record<string, unknown>;
			try {
				raw = JSON.parse(line) as Record<string, unknown>;
			} catch {
				continue;
			}

			if (raw.type !== "assistant") continue;

			const msg = raw as unknown as AssistantMessage;
			const message = msg.message;
			if (!message) continue;

			// Extract model (use first found)
			if (message.model && model === "unknown") {
				model = normalizeModelName(message.model);
			}

			// Extract usage
			const usage = message.usage;
			if (usage?.output_tokens) {
				turns++;
				outputTokens += usage.output_tokens;
			}

			// Count visible content by type
			let turnHasThinking = false;
			if (Array.isArray(message.content)) {
				for (const block of message.content) {
					if (block.type === "thinking" && typeof block.thinking === "string") {
						thinkingChars += block.thinking.length;
						if (block.thinking.length > 0) {
							turnHasThinking = true;
						}
					}
					if (block.type === "text" && typeof block.text === "string") {
						textChars += block.text.length;
					}
					if (block.type === "tool_use") {
						const toolBlock = block as { input?: unknown };
						if (toolBlock.input) {
							toolChars += JSON.stringify(toolBlock.input).length;
						}
					}
				}
			}
			if (turnHasThinking) {
				turnsWithThinking++;
			}
		}
	} catch {
		return null;
	}

	if (turns === 0) return null;

	return {
		sessionId,
		filePath,
		project,
		model,
		isSubagent,
		parentProject,
		turns,
		turnsWithThinking,
		outputTokens,
		thinkingChars,
		textChars,
		toolChars,
	};
}

function normalizeModelName(model: string): string {
	// Extract the base model name for comparison
	// claude-3-5-sonnet-20241022 -> sonnet-3-5
	// claude-opus-4-5-20250101 -> opus-4-5
	// claude-sonnet-4-6-20250201 -> sonnet-4-6

	const match = model.match(
		/claude[-_]?(opus|sonnet|haiku)[-_]?(\d+)[-_]?(\d+)?/i,
	);
	if (match) {
		const [, variant, major, minor] = match;
		return minor ? `${variant}-${major}-${minor}` : `${variant}-${major}`;
	}

	// Fallback: try claude-3-5-sonnet pattern
	const altMatch = model.match(
		/claude[-_](\d+)[-_](\d+)?[-_]?(opus|sonnet|haiku)/i,
	);
	if (altMatch) {
		const [, major, minor, variant] = altMatch;
		return minor ? `${variant}-${major}-${minor}` : `${variant}-${major}`;
	}

	// Return shortened version
	return model.replace(/[-_]\d{8}$/, "").slice(0, 20);
}

function computeModelSummaries(sessions: SessionTokenStats[]): ModelSummary[] {
	const byModel = new Map<
		string,
		{
			sessions: number;
			turns: number;
			turnsWithThinking: number;
			outputTokens: number;
			thinkingChars: number;
			textChars: number;
			toolChars: number;
			sessionsNoThinking: number;
			sessionsLight: number;
			sessionsMedium: number;
			sessionsHeavy: number;
		}
	>();

	for (const s of sessions) {
		const existing = byModel.get(s.model) ?? {
			sessions: 0,
			turns: 0,
			turnsWithThinking: 0,
			outputTokens: 0,
			thinkingChars: 0,
			textChars: 0,
			toolChars: 0,
			sessionsNoThinking: 0,
			sessionsLight: 0,
			sessionsMedium: 0,
			sessionsHeavy: 0,
		};
		existing.sessions++;
		existing.turns += s.turns;
		existing.turnsWithThinking += s.turnsWithThinking;
		existing.outputTokens += s.outputTokens;
		existing.thinkingChars += s.thinkingChars;
		existing.textChars += s.textChars;
		existing.toolChars += s.toolChars;

		// Categorize session by thinking intensity
		if (s.thinkingChars === 0) {
			existing.sessionsNoThinking++;
		} else if (s.thinkingChars < 5000) {
			existing.sessionsLight++;
		} else if (s.thinkingChars < 50000) {
			existing.sessionsMedium++;
		} else {
			existing.sessionsHeavy++;
		}

		byModel.set(s.model, existing);
	}

	const summaries: ModelSummary[] = [];
	for (const [model, data] of byModel) {
		const thinkingDensity =
			data.turns > 0 ? data.turnsWithThinking / data.turns : 0;
		const avgThinkingWhenPresent =
			data.turnsWithThinking > 0
				? Math.round(data.thinkingChars / data.turnsWithThinking)
				: 0;

		summaries.push({
			model,
			sessions: data.sessions,
			turns: data.turns,
			turnsWithThinking: data.turnsWithThinking,
			outputTokens: data.outputTokens,
			thinkingChars: data.thinkingChars,
			textChars: data.textChars,
			toolChars: data.toolChars,
			thinkingDensity,
			avgThinkingWhenPresent,
			sessionsNoThinking: data.sessionsNoThinking,
			sessionsLight: data.sessionsLight,
			sessionsMedium: data.sessionsMedium,
			sessionsHeavy: data.sessionsHeavy,
		});
	}

	// Sort by total output tokens descending
	summaries.sort((a, b) => b.outputTokens - a.outputTokens);
	return summaries;
}

async function analyzeTokens(options: {
	project?: string;
	since?: Date;
	until?: Date;
	model?: string;
}): Promise<TokenAnalysisResult> {
	const files = await discoverSessionFiles();

	const mainSessions: SessionTokenStats[] = [];
	const subagentSessions: SessionTokenStats[] = [];

	const projectNeedle = options.project
		? pathToProjectSlug(options.project)
		: undefined;

	const hasTimeFilter = !!(options.since || options.until);

	for (const filePath of files) {
		// Filter by project (slug-to-slug match; absolute paths are encoded).
		if (projectNeedle) {
			const project = extractProjectFromPath(filePath);
			if (!project?.includes(projectNeedle)) continue;
		}

		// Filter by file mtime (session activity time) before the expensive
		// per-file parse. Sessions outside the window are skipped without reads.
		if (hasTimeFilter) {
			try {
				const st = await stat(filePath);
				if (!isFileWithinTimeRange(st.mtime, options.since, options.until)) {
					continue;
				}
			} catch {
				continue;
			}
		}

		const stats = await analyzeSessionTokens(filePath);
		if (!stats) continue;

		// Filter by model
		if (options.model && !stats.model.includes(options.model)) continue;

		if (stats.isSubagent) {
			subagentSessions.push(stats);
		} else {
			mainSessions.push(stats);
		}
	}

	// Sort by output tokens descending
	mainSessions.sort((a, b) => b.outputTokens - a.outputTokens);
	subagentSessions.sort((a, b) => b.outputTokens - a.outputTokens);

	const allSessions = [...mainSessions, ...subagentSessions];
	const modelSummaries = computeModelSummaries(allSessions);

	return {
		mainSessions,
		subagentSessions,
		modelSummaries,
		totalSessions: allSessions.length,
		totalTurns: allSessions.reduce((sum, s) => sum + s.turns, 0),
		totalOutputTokens: allSessions.reduce((sum, s) => sum + s.outputTokens, 0),
	};
}

function formatNumber(n: number): string {
	if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
	if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
	return n.toString();
}

function formatTokensText(
	result: TokenAnalysisResult,
	options?: { noColor?: boolean },
): string {
	if (options?.noColor) {
		chalk.level = 0;
	}

	const lines: string[] = [];

	lines.push(chalk.bold("Session Token Analysis"));
	lines.push(chalk.dim("═".repeat(90)));
	lines.push("");
	lines.push(
		chalk.dim(
			"Output = billed tokens (exact). Think/Text/Tool = visible chars by type.",
		),
	);
	lines.push("");

	// Model Comparison (primary view — most useful for comparing models)
	if (result.modelSummaries.length > 0) {
		lines.push(chalk.bold("By Model"));
		lines.push(chalk.dim("─".repeat(90)));
		lines.push(
			chalk.dim(
				`${"Model".padEnd(15)} │ ${"Sessions".padStart(8)} │ ${"Turns".padStart(7)} │ ${"Output Tok".padStart(10)} │ ${"Think".padStart(8)} │ ${"Text".padStart(8)} │ ${"Tool".padStart(8)}`,
			),
		);
		lines.push(chalk.dim("─".repeat(90)));

		for (const m of result.modelSummaries) {
			const modelName = m.model.slice(0, 15);
			lines.push(
				`${chalk.bold(modelName.padEnd(15))} │ ${String(m.sessions).padStart(8)} │ ${String(m.turns).padStart(7)} │ ${formatNumber(m.outputTokens).padStart(10)} │ ${formatNumber(m.thinkingChars).padStart(8)} │ ${formatNumber(m.textChars).padStart(8)} │ ${formatNumber(m.toolChars).padStart(8)}`,
			);
		}
		lines.push(chalk.dim("─".repeat(90)));
		lines.push("");

		// Thinking Density table
		lines.push(chalk.bold("Thinking Density"));
		lines.push(chalk.dim("─".repeat(90)));
		lines.push(
			chalk.dim(
				`${"Model".padEnd(15)} │ ${"Turns".padStart(7)} │ ${"W/Think".padStart(7)} │ ${"Density".padStart(7)} │ ${"Avg Chars".padStart(9)} │ ${"None".padStart(6)} │ ${"Light".padStart(6)} │ ${"Med".padStart(6)} │ ${"Heavy".padStart(6)}`,
			),
		);
		lines.push(chalk.dim("─".repeat(90)));

		for (const m of result.modelSummaries) {
			const modelName = m.model.slice(0, 15);
			const density = `${Math.round(m.thinkingDensity * 100)}%`;
			lines.push(
				`${chalk.bold(modelName.padEnd(15))} │ ${String(m.turns).padStart(7)} │ ${String(m.turnsWithThinking).padStart(7)} │ ${density.padStart(7)} │ ${formatNumber(m.avgThinkingWhenPresent).padStart(9)} │ ${String(m.sessionsNoThinking).padStart(6)} │ ${String(m.sessionsLight).padStart(6)} │ ${String(m.sessionsMedium).padStart(6)} │ ${String(m.sessionsHeavy).padStart(6)}`,
			);
		}
		lines.push(chalk.dim("─".repeat(90)));
		lines.push(
			chalk.dim(
				"Density = % turns with thinking. Avg Chars = avg per thinking turn. None/Light/Med/Heavy = session count by total thinking (<5K/<50K/50K+).",
			),
		);
		lines.push("");
	}

	// Main Sessions Table
	if (result.mainSessions.length > 0) {
		lines.push(chalk.bold("Main Sessions"));
		lines.push(chalk.dim("─".repeat(95)));
		lines.push(
			chalk.dim(
				`${"Session".padEnd(24)} │ ${"Model".padEnd(12)} │ ${"Turns".padStart(5)} │ ${"W/Thnk".padStart(6)} │ ${"Density".padStart(7)} │ ${"Output".padStart(8)} │ ${"Think".padStart(8)} │ ${"Avg/Turn".padStart(8)}`,
			),
		);
		lines.push(chalk.dim("─".repeat(95)));

		for (const s of result.mainSessions.slice(0, 15)) {
			const sessionShort = s.sessionId.slice(0, 22);
			const modelShort = s.model.slice(0, 12);
			const density =
				s.turns > 0
					? `${Math.round((s.turnsWithThinking / s.turns) * 100)}%`
					: "0%";
			const avgPerTurn =
				s.turnsWithThinking > 0
					? formatNumber(Math.round(s.thinkingChars / s.turnsWithThinking))
					: "—";
			lines.push(
				`${sessionShort.padEnd(24)} │ ${chalk.cyan(modelShort.padEnd(12))} │ ${String(s.turns).padStart(5)} │ ${String(s.turnsWithThinking).padStart(6)} │ ${density.padStart(7)} │ ${formatNumber(s.outputTokens).padStart(8)} │ ${formatNumber(s.thinkingChars).padStart(8)} │ ${avgPerTurn.padStart(8)}`,
			);
		}

		if (result.mainSessions.length > 15) {
			lines.push(
				chalk.dim(`  ... and ${result.mainSessions.length - 15} more sessions`),
			);
		}
		lines.push(chalk.dim("─".repeat(95)));
		lines.push("");
	}

	// Subagent Sessions Table
	if (result.subagentSessions.length > 0) {
		lines.push(chalk.bold("Subagent Sessions"));
		lines.push(chalk.dim("─".repeat(95)));
		lines.push(
			chalk.dim(
				`${"Agent ID".padEnd(24)} │ ${"Model".padEnd(12)} │ ${"Turns".padStart(5)} │ ${"W/Thnk".padStart(6)} │ ${"Density".padStart(7)} │ ${"Output".padStart(8)} │ ${"Think".padStart(8)} │ ${"Avg/Turn".padStart(8)}`,
			),
		);
		lines.push(chalk.dim("─".repeat(95)));

		for (const s of result.subagentSessions.slice(0, 10)) {
			const agentShort = s.sessionId.slice(0, 22);
			const modelShort = s.model.slice(0, 12);
			const density =
				s.turns > 0
					? `${Math.round((s.turnsWithThinking / s.turns) * 100)}%`
					: "0%";
			const avgPerTurn =
				s.turnsWithThinking > 0
					? formatNumber(Math.round(s.thinkingChars / s.turnsWithThinking))
					: "—";
			lines.push(
				`${agentShort.padEnd(24)} │ ${chalk.yellow(modelShort.padEnd(12))} │ ${String(s.turns).padStart(5)} │ ${String(s.turnsWithThinking).padStart(6)} │ ${density.padStart(7)} │ ${formatNumber(s.outputTokens).padStart(8)} │ ${formatNumber(s.thinkingChars).padStart(8)} │ ${avgPerTurn.padStart(8)}`,
			);
		}

		if (result.subagentSessions.length > 10) {
			lines.push(
				chalk.dim(
					`  ... and ${result.subagentSessions.length - 10} more subagent sessions`,
				),
			);
		}
		lines.push(chalk.dim("─".repeat(95)));
		lines.push("");
	}

	// Summary
	lines.push(
		chalk.dim(
			`Total: ${result.totalSessions} sessions, ${result.totalTurns} turns, ${formatNumber(result.totalOutputTokens)} output tokens`,
		),
	);

	return lines.join("\n");
}

function formatTokensJson(result: TokenAnalysisResult): string {
	return JSON.stringify(result, null, 2);
}

export function registerTokensCommand(parent: Command): void {
	parent
		.command("tokens")
		.description("Analyze thinking token usage across sessions")
		.option("--project <path>", "Filter by project directory")
		.option("--since <time>", 'Start time filter (e.g. "1 week ago")')
		.option("--until <time>", "End time filter")
		.option("--model <name>", "Filter by model name (partial match)")
		.option("-f, --format <format>", "Output format: text|json", "text")
		.option("--no-color", "Disable colored output")
		.action(async (options: TokensCommandOptions) => {
			try {
				if (!options.color) {
					chalk.level = 0;
				}

				const since = options.since
					? (parseRelativeTime(options.since) ?? parseTime(options.since))
					: undefined;

				const until = options.until ? parseTime(options.until) : undefined;

				const result = await analyzeTokens({
					project: options.project,
					since: since ?? undefined,
					until: until ?? undefined,
					model: options.model,
				});

				if (options.format === "json") {
					console.log(formatTokensJson(result));
				} else {
					console.log(formatTokensText(result, { noColor: !options.color }));
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				console.error(`Error: ${message}`);
				process.exit(1);
			}
		});
}
