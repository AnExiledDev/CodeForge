import { existsSync } from "node:fs";
import path from "node:path";
import type { PassName } from "../schemas/review.js";

export type PromptMode = "sequential" | "parallel";

export interface PassPrompts {
	systemPromptFile: string;
	userPrompt: string;
}

function findPackageRoot(from: string): string {
	let dir = from;
	while (dir !== path.dirname(dir)) {
		if (existsSync(path.join(dir, "package.json"))) return dir;
		dir = path.dirname(dir);
	}
	return from;
}

const PROMPTS_DIR = path.join(
	findPackageRoot(import.meta.dir),
	"prompts",
	"review",
);

function getUserPromptFilename(pass: PassName, mode: PromptMode): string {
	if (pass === "correctness") return "correctness.user.md";
	if (mode === "parallel") return `${pass}.user.md`;
	return `${pass}-resume.user.md`;
}

function interpolate(
	template: string,
	variables: Record<string, string>,
): string {
	let content = template;
	for (const [key, value] of Object.entries(variables)) {
		content = content.replaceAll(`{{${key}}}`, value);
	}
	return content;
}

export async function getPassPrompts(
	pass: PassName,
	mode: PromptMode,
	variables: Record<string, string>,
): Promise<PassPrompts> {
	const systemPromptFile = path.join(PROMPTS_DIR, `${pass}.system.md`);
	const userPromptFile = path.join(
		PROMPTS_DIR,
		getUserPromptFilename(pass, mode),
	);

	const rawContent = await Bun.file(userPromptFile).text();
	const userPrompt = interpolate(rawContent, variables);

	return { systemPromptFile, userPrompt };
}

export function getFullScopePrompt(pass: PassName, include?: string): string {
	const scopeInstruction = include
		? `Scan files matching the pattern: ${include}`
		: "Scan the project codebase";

	return `${scopeInstruction} and identify ${pass} issues.

Use Read, Glob, and Grep tools to explore the codebase. Do not review node_modules, dist, or build output directories.

For each finding, specify the exact file path and line number.`;
}
