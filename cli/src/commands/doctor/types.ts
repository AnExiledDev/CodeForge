export type CheckCategory = "auth" | "environment" | "volumes" | "wsl";

export interface FixResult {
	applied: boolean;
	message: string;
	advisory?: string; // for fixes that can't auto-apply (Defender, .wslconfig)
}

export interface FixAction {
	label: string; // shown in TUI: "Move TMPDIR to /tmp"
	detail: string; // full explanation
	impact: string; // "1 env var change" or "requires rebuild"
	requiresRebuild: boolean;
	apply: () => Promise<FixResult>;
}

export interface CheckResult {
	name: string;
	category: CheckCategory;
	status: "pass" | "warn" | "fail" | "info";
	message: string;
	hint?: string;
	fix?: FixAction;
}

export interface DoctorReport {
	checks: CheckResult[];
	passed: number;
	failed: number;
	warnings: number;
}
