import {
	cancel,
	intro,
	isCancel,
	log,
	multiselect,
	note,
	outro,
} from "@clack/prompts";
import type { CheckCategory, CheckResult, FixResult } from "./types.js";

interface FixOptions {
	yes: boolean;
	dryRun: boolean;
	only?: string;
}

const CATEGORY_LABELS: Record<CheckCategory, string> = {
	auth: "Authentication",
	environment: "Environment",
	git: "Git",
	volumes: "Volumes",
	wsl: "WSL",
};

const categoryMap: Record<string, CheckCategory> = {
	auth: "auth",
	env: "environment",
	environment: "environment",
	git: "git",
	volumes: "volumes",
	wsl: "wsl",
};

function categoryLabel(cat: CheckCategory): string {
	return CATEGORY_LABELS[cat];
}

function groupByCategory(
	checks: CheckResult[],
): Map<CheckCategory, CheckResult[]> {
	const map = new Map<CheckCategory, CheckResult[]>();
	for (const check of checks) {
		const existing = map.get(check.category) ?? [];
		existing.push(check);
		map.set(check.category, existing);
	}
	return map;
}

async function applyFixes(fixes: CheckResult[]): Promise<void> {
	const results: { check: CheckResult; result: FixResult }[] = [];
	const advisories: { check: CheckResult; result: FixResult }[] = [];

	for (const check of fixes) {
		const result = await check.fix!.apply();
		if (result.advisory) {
			advisories.push({ check, result });
		} else {
			results.push({ check, result });
		}
	}

	const applied = results.filter((r) => r.result.applied);
	if (applied.length > 0) {
		log.success(
			`Applied ${applied.length} fix${applied.length !== 1 ? "es" : ""}:`,
		);
		for (const { result } of applied) {
			log.message(`  ${result.message}`);
		}
	}

	if (advisories.length > 0) {
		const needsManual = advisories.length;
		log.info(
			`${needsManual} fix${needsManual !== 1 ? "es" : ""} require${needsManual === 1 ? "s" : ""} manual action:`,
		);
		for (const { check, result } of advisories) {
			note(result.advisory!, check.fix!.label);
		}
	}

	const rebuildFixes = fixes.filter((f) => f.fix!.requiresRebuild);
	if (rebuildFixes.length > 0) {
		const needsFull = rebuildFixes.some(
			(f) => f.fix!.rebuildType === "full",
		);
		if (needsFull) {
			log.warn(
				"Some changes require a full container rebuild (no cache) to take effect.\n" +
					"  From VS Code: Ctrl+Shift+P → 'Dev Containers: Rebuild Without Cache'\n" +
					"  From host terminal: codeforge container rebuild --no-cache",
			);
		} else {
			log.warn(
				"Some changes require a container rebuild to take effect.\n" +
					"  From VS Code: Ctrl+Shift+P → 'Dev Containers: Rebuild Container'\n" +
					"  From host terminal: codeforge container rebuild",
			);
		}
	}
}

export async function runFixMode(
	checks: CheckResult[],
	options: FixOptions,
): Promise<void> {
	const fixable = checks.filter((c) => c.fix != null);
	if (fixable.length === 0) {
		log.info("No fixable issues found.");
		return;
	}

	if (!options.yes && !process.stdout.isTTY) {
		console.error(
			"Error: --fix requires an interactive terminal. Use --fix --yes for non-interactive mode.",
		);
		process.exit(1);
	}

	let candidates = fixable;
	if (options.only) {
		const cat = categoryMap[options.only];
		if (!cat) {
			console.error(
				`Unknown category: ${options.only}. Valid: auth, env, git, volumes, wsl`,
			);
			process.exit(1);
		}
		candidates = fixable.filter((c) => c.category === cat);
	}

	if (options.dryRun) {
		log.info(
			`Found ${candidates.length} fixable issue${candidates.length !== 1 ? "s" : ""}:`,
		);
		for (const check of candidates) {
			log.message(`  ${check.fix!.label} (${check.fix!.impact})`);
		}
		return;
	}

	if (options.yes) {
		await applyFixes(candidates);
		return;
	}

	intro("CodeForge Doctor — Fix Mode");

	const selectedFixes: CheckResult[] = [];
	const categories = groupByCategory(candidates);

	for (const [category, fixes] of Array.from(categories)) {
		const result = await multiselect({
			message: `${categoryLabel(category)} (${fixes.length} fix${fixes.length !== 1 ? "es" : ""})`,
			options: fixes.map((f) => ({
				value: f.name,
				label: f.fix!.label,
				hint: f.fix!.impact,
			})),
			initialValues: fixes.map((f) => f.name),
			required: false,
		});

		if (isCancel(result)) {
			cancel("Fix mode cancelled.");
			process.exit(0);
		}

		const selected = fixes.filter((f) => (result as string[]).includes(f.name));
		selectedFixes.push(...selected);
	}

	if (selectedFixes.length === 0) {
		outro("No fixes selected.");
		return;
	}

	await applyFixes(selectedFixes);
	outro("Done!");
}
