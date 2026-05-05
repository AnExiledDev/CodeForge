import chalk from "chalk";
import type { CheckCategory, CheckResult, DoctorReport } from "./types.js";

export function formatText(report: DoctorReport, useColor: boolean): string {
	const c = {
		bold: useColor ? chalk.bold : (s: string) => s,
		green: useColor ? chalk.green : (s: string) => s,
		yellow: useColor ? chalk.yellow : (s: string) => s,
		red: useColor ? chalk.red : (s: string) => s,
		blue: useColor ? chalk.blue : (s: string) => s,
	};

	function icon(status: CheckResult["status"]): string {
		switch (status) {
			case "pass":
				return c.green("✓");
			case "warn":
				return c.yellow("⚠");
			case "fail":
				return c.red("✗");
			case "info":
				return c.blue("ℹ");
		}
	}

	const lines: string[] = [];
	lines.push(c.bold("CodeForge Doctor"));
	lines.push("━━━━━━━━━━━━━━━━");
	lines.push("");

	const categoryConfig: { key: CheckCategory; label: string }[] = [
		{ key: "auth", label: "Authentication" },
		{ key: "environment", label: "Environment" },
		{ key: "volumes", label: "Volumes" },
		{ key: "wsl", label: "WSL" },
	];

	for (const { key, label } of categoryConfig) {
		const checks = report.checks.filter((ch) => ch.category === key);
		if (checks.length === 0) continue;
		lines.push(`${c.bold(label)}:`);
		for (const check of checks) {
			lines.push(`  ${icon(check.status)} ${check.name} (${check.message})`);
			if (check.hint) {
				lines.push(`    → ${check.hint}`);
			}
		}
		lines.push("");
	}

	lines.push("━━━━━━━━━━━━━━━━");
	const parts = [`${report.passed} passed`];
	if (report.failed > 0) parts.push(`${report.failed} failed`);
	if (report.warnings > 0)
		parts.push(`${report.warnings} warning${report.warnings !== 1 ? "s" : ""}`);
	lines.push(`  ${parts.join(", ")}`);

	return lines.join("\n");
}

export function formatJson(report: DoctorReport): string {
	return JSON.stringify(
		{
			checks: report.checks.map(({ fix, ...rest }) => rest),
			summary: {
				passed: report.passed,
				failed: report.failed,
				warnings: report.warnings,
			},
		},
		null,
		2,
	);
}
