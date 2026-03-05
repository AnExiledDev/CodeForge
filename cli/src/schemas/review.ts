export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type ReviewScope = "diff" | "staged" | "full";
export type PassName = "correctness" | "security" | "quality";

export interface ReviewFinding {
	file: string;
	line: number | null;
	severity: Severity;
	category: string;
	title: string;
	description: string;
	suggestion: string | null;
}

export interface PassResult {
	name: PassName;
	findings: ReviewFinding[];
	costUsd: number;
	durationMs: number;
	sessionId: string;
	error?: string;
}

export interface ReviewResult {
	base: string;
	head: string;
	filesChanged: number;
	scope: ReviewScope;
	score: number;
	findings: ReviewFindingWithPass[];
	summary: string;
	passes: PassResult[];
	totalCostUsd: number;
}

export interface ReviewFindingWithPass extends ReviewFinding {
	pass: number;
	passName: PassName;
}

/** JSON schema sent to claude --json-schema for structured output */
export const findingsJsonSchema = {
	type: "object" as const,
	required: ["findings", "summary"],
	properties: {
		findings: {
			type: "array" as const,
			items: {
				type: "object" as const,
				required: ["file", "severity", "category", "title", "description"],
				properties: {
					file: { type: "string" as const },
					line: { type: ["number", "null"] as const },
					severity: {
						type: "string" as const,
						enum: ["critical", "high", "medium", "low", "info"],
					},
					category: { type: "string" as const },
					title: { type: "string" as const },
					description: { type: "string" as const },
					suggestion: { type: ["string", "null"] as const },
				},
			},
		},
		summary: { type: "string" as const },
	},
};
