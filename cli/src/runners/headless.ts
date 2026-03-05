import path from "node:path";

export interface HeadlessOptions {
	prompt: string;
	model?: string;
	maxTurns?: number;
	maxBudgetUsd?: number;
	allowedTools?: string[];
	disallowedTools?: string[];
	permissionMode?: "plan" | "acceptEdits" | "default";
	systemPromptFile?: string;
	resume?: string;
	jsonSchema?: object;
	cwd?: string;
}

export interface HeadlessResult {
	result: string;
	sessionId: string;
	isError: boolean;
	subtype: string;
	totalCostUsd: number;
	numTurns: number;
	durationMs: number;
	structuredOutput?: unknown;
}

interface ClaudeJsonOutput {
	type: string;
	subtype: string;
	is_error: boolean;
	result: string;
	session_id: string;
	total_cost_usd: number;
	num_turns: number;
}

async function discoverClaudeBinary(): Promise<string> {
	if (process.env.CLAUDE_BIN) {
		const exists = await Bun.file(process.env.CLAUDE_BIN).exists();
		if (exists) return process.env.CLAUDE_BIN;
	}

	const localPath = path.join(process.env.HOME ?? "", ".local/bin/claude");
	if (await Bun.file(localPath).exists()) return localPath;

	const proc = Bun.spawn(["which", "claude"], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const stdout = await new Response(proc.stdout).text();
	await proc.exited;
	const trimmed = stdout.trim();
	if (trimmed) return trimmed;

	throw new Error(
		"Claude CLI not found. Set CLAUDE_BIN environment variable or install Claude Code.",
	);
}

function buildArgs(binary: string, options: HeadlessOptions): string[] {
	const args = [binary, "-p", options.prompt, "--output-format", "json"];

	if (options.model) args.push("--model", options.model);
	if (options.maxTurns) args.push("--max-turns", String(options.maxTurns));
	if (options.maxBudgetUsd !== undefined) {
		args.push("--max-budget-usd", options.maxBudgetUsd.toFixed(2));
	}
	if (options.permissionMode) {
		args.push("--permission-mode", options.permissionMode);
	}
	if (options.systemPromptFile) {
		args.push("--system-prompt-file", options.systemPromptFile);
	}
	if (options.resume) args.push("--resume", options.resume);
	if (options.jsonSchema) {
		args.push("--json-schema", JSON.stringify(options.jsonSchema));
	}
	if (options.allowedTools?.length) {
		args.push("--allowedTools", ...options.allowedTools);
	}
	if (options.disallowedTools?.length) {
		args.push("--disallowedTools", ...options.disallowedTools);
	}

	return args;
}

export async function runHeadless(
	options: HeadlessOptions,
): Promise<HeadlessResult> {
	const binary = await discoverClaudeBinary();
	const args = buildArgs(binary, options);
	const startTime = Date.now();

	const proc = Bun.spawn(args, {
		cwd: options.cwd,
		stdout: "pipe",
		stderr: "pipe",
	});

	const stdout = await new Response(proc.stdout).text();
	const stderr = await new Response(proc.stderr).text();
	const exitCode = await proc.exited;
	const durationMs = Date.now() - startTime;

	let parsed: ClaudeJsonOutput;
	try {
		parsed = JSON.parse(stdout) as ClaudeJsonOutput;
	} catch {
		if (exitCode !== 0) {
			throw new Error(
				`Claude process exited with code ${exitCode}: ${stderr || stdout}`,
			);
		}
		return {
			result: stdout,
			sessionId: "",
			isError: true,
			subtype: "parse_error",
			totalCostUsd: 0,
			numTurns: 0,
			durationMs,
		};
	}

	let structuredOutput: unknown;
	if (options.jsonSchema && !parsed.is_error) {
		try {
			structuredOutput = JSON.parse(parsed.result);
		} catch {
			// structured output parse failed — text result still available
		}
	}

	return {
		result: parsed.result,
		sessionId: parsed.session_id,
		isError: parsed.is_error,
		subtype: parsed.subtype,
		totalCostUsd: parsed.total_cost_usd ?? 0,
		numTurns: parsed.num_turns ?? 0,
		durationMs,
		structuredOutput,
	};
}
