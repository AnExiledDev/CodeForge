import chalk from "chalk";
import type {
	ReviewFindingWithPass,
	ReviewResult,
	Severity,
} from "../schemas/review.js";

const SEPARATOR = "\u2501".repeat(60);

const SEVERITY_COLORS: Record<Severity, (text: string) => string> = {
	critical: (t) => chalk.red.bold(t),
	high: (t) => chalk.red(t),
	medium: (t) => chalk.yellow(t),
	low: (t) => chalk.blue(t),
	info: (t) => chalk.dim(t),
};

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDuration(ms: number): string {
	return `${Math.round(ms / 1000)}s`;
}

function formatCost(usd: number): string {
	return `$${usd.toFixed(2)}`;
}

function severityTag(severity: Severity): string {
	const label = `[${severity.toUpperCase()}]`;
	return SEVERITY_COLORS[severity](label);
}

function formatPassLine(
	index: number,
	name: string,
	costUsd: number,
	durationMs: number,
	error?: string,
): string {
	const label = `Pass ${index + 1}: ${capitalize(name)}`;
	const stats = `${formatCost(costUsd)}  ${formatDuration(durationMs)}`;

	if (error) {
		const errorNote = chalk.yellow(` \u26A0 ${error}`);
		return `${label.padEnd(50)}${stats}${errorNote}`;
	}

	return `${label.padEnd(50)}${stats}`;
}

function formatFinding(finding: ReviewFindingWithPass): string[] {
	const lines: string[] = [];
	const location = finding.line
		? `${finding.file}:${finding.line}`
		: finding.file;

	lines.push(`${severityTag(finding.severity)} ${location}`);

	const desc =
		finding.description && finding.description !== finding.title
			? `${finding.title} \u2014 ${finding.description}`
			: finding.title;
	lines.push(`  ${desc}`);

	if (finding.suggestion) {
		lines.push(`  \u2192 ${finding.suggestion}`);
	}

	lines.push(`  ${chalk.dim(`(${finding.passName})`)}`);

	return lines;
}

function formatSeverityCounts(findings: ReviewFindingWithPass[]): string {
	const counts: Record<Severity, number> = {
		critical: 0,
		high: 0,
		medium: 0,
		low: 0,
		info: 0,
	};
	for (const f of findings) counts[f.severity]++;

	const parts: string[] = [];
	const entries: [Severity, number][] = [
		["critical", counts.critical],
		["high", counts.high],
		["medium", counts.medium],
		["low", counts.low],
		["info", counts.info],
	];

	for (const [severity, count] of entries) {
		if (count > 0) {
			parts.push(SEVERITY_COLORS[severity](`${count} ${severity}`));
		}
	}

	return parts.join("  ");
}

export function formatReviewText(
	result: ReviewResult,
	options?: { noColor?: boolean },
): string {
	if (options?.noColor) chalk.level = 0;

	const lines: string[] = [];

	// Header
	if (result.scope === "full") {
		lines.push(chalk.bold("Full codebase review"));
	} else {
		lines.push(
			chalk.bold(
				`Review of ${result.base}..${result.head} (${result.filesChanged} files changed)`,
			),
		);
	}
	lines.push("");

	// Pass summary lines
	for (const [i, pass] of result.passes.entries()) {
		lines.push(
			formatPassLine(i, pass.name, pass.costUsd, pass.durationMs, pass.error),
		);
	}

	lines.push("");
	lines.push(SEPARATOR);
	lines.push("");

	// Findings
	if (result.findings.length === 0) {
		lines.push(chalk.green("No issues found."));
	} else {
		for (const [i, finding] of result.findings.entries()) {
			lines.push(...formatFinding(finding));
			if (i < result.findings.length - 1) lines.push("");
		}
	}

	lines.push("");
	lines.push(SEPARATOR);

	// Footer
	const score = chalk.bold(`Score: ${result.score}/10`);
	const counts = formatSeverityCounts(result.findings);
	const cost = `Total: ${formatCost(result.totalCostUsd)}`;

	const footerParts = [score];
	if (counts) footerParts.push(counts);
	footerParts.push(cost);
	lines.push(footerParts.join("  \u2502  "));

	return lines.join("\n");
}

export function formatReviewJson(result: ReviewResult): string {
	const output = {
		base: result.base,
		head: result.head,
		scope: result.scope,
		filesChanged: result.filesChanged,
		score: result.score,
		findings: result.findings.map((f) => ({
			file: f.file,
			line: f.line,
			severity: f.severity,
			category: f.category,
			pass: f.pass,
			passName: f.passName,
			title: f.title,
			description: f.description,
			suggestion: f.suggestion,
		})),
		summary: result.summary,
		cost: {
			total_usd: result.totalCostUsd,
			passes: result.passes.map((p) => ({
				name: p.name,
				cost_usd: p.costUsd,
				duration_ms: p.durationMs,
				findings: p.findings.length,
				...(p.error ? { error: p.error } : {}),
			})),
		},
	};

	return JSON.stringify(output, null, 2);
}
