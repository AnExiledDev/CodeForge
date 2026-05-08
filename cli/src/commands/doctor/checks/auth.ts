import type { CheckResult } from "../types.js";
import { spawn } from "../util.js";

export async function checkGhAuth(): Promise<CheckResult> {
	const { stdout, exitCode } = await spawn("gh", ["auth", "status"]);
	if (exitCode === 0) {
		const userMatch = stdout.match(/Logged in to [^ ]+ as ([^\s(]+)/);
		const user = userMatch?.[1] ?? "unknown";
		return {
			name: "GitHub CLI authenticated",
			category: "auth",
			status: "pass",
			message: `user: ${user}`,
		};
	}
	return {
		name: "GitHub CLI authenticated",
		category: "auth",
		status: "warn",
		message: "not authenticated",
		hint: "Run: gh auth login",
	};
}

export async function checkGitUser(): Promise<CheckResult> {
	const [nameResult, emailResult] = await Promise.all([
		spawn("git", ["config", "user.name"]),
		spawn("git", ["config", "user.email"]),
	]);
	const name = nameResult.stdout;
	const email = emailResult.stdout;
	if (name && email) {
		return {
			name: "Git user configured",
			category: "auth",
			status: "pass",
			message: `${name} <${email}>`,
		};
	}
	const missing = [!name && "user.name", !email && "user.email"]
		.filter(Boolean)
		.join(", ");
	return {
		name: "Git user configured",
		category: "auth",
		status: "warn",
		message: `missing: ${missing}`,
		hint: "Run: git config --global user.name 'Name' && git config --global user.email 'email'",
	};
}
