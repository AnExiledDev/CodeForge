import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import { Command } from "commander";
import { runFixMode } from "../src/commands/doctor/fix.js";
import {
	type CheckResult,
	type DoctorReport,
	formatJson,
	formatText,
	registerDoctorCommand,
} from "../src/commands/doctor/index.js";
import type { FixAction } from "../src/commands/doctor/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReport(checks: CheckResult[]): DoctorReport {
	return {
		checks,
		passed: checks.filter((c) => c.status === "pass").length,
		failed: checks.filter((c) => c.status === "fail").length,
		warnings: checks.filter((c) => c.status === "warn").length,
	};
}

function makeCheck(overrides: Partial<CheckResult> = {}): CheckResult {
	return {
		name: "Test check",
		category: "environment",
		status: "pass",
		message: "all good",
		...overrides,
	};
}

function makeFix(overrides: Partial<FixAction> = {}): FixAction {
	return {
		label: "Fix something",
		detail: "Detailed explanation",
		impact: "minor change",
		requiresRebuild: false,
		apply: mock(() => Promise.resolve({ applied: true, message: "Fixed it" })),
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// 1. Registration tests
// ---------------------------------------------------------------------------

describe("registerDoctorCommand", () => {
	test("registers doctor as a subcommand", () => {
		const program = new Command();
		registerDoctorCommand(program);
		const cmd = program.commands.find((c) => c.name() === "doctor");
		expect(cmd).toBeDefined();
		expect(cmd!.description()).toContain("health");
	});

	test("has --format and --no-color options", () => {
		const program = new Command();
		registerDoctorCommand(program);
		const cmd = program.commands.find((c) => c.name() === "doctor")!;
		const opts = cmd.options.map((o) => o.long);
		expect(opts).toContain("--format");
		expect(opts).toContain("--no-color");
	});

	test("has --fix, --yes, --dry-run, --only options", () => {
		const program = new Command();
		registerDoctorCommand(program);
		const cmd = program.commands.find((c) => c.name() === "doctor")!;
		const opts = cmd.options.map((o) => o.long);
		expect(opts).toContain("--fix");
		expect(opts).toContain("--yes");
		expect(opts).toContain("--dry-run");
		expect(opts).toContain("--only");
	});
});

// ---------------------------------------------------------------------------
// 2. Format tests — formatText
// ---------------------------------------------------------------------------

describe("formatText", () => {
	test("renders pass/warn/fail summary line", () => {
		const report = makeReport([
			makeCheck({
				name: "GitHub CLI authenticated",
				category: "auth",
				status: "pass",
				message: "user: test",
			}),
			makeCheck({
				name: "Git user configured",
				category: "auth",
				status: "pass",
				message: "Test <test@test.com>",
			}),
			makeCheck({
				name: "Workspace filesystem",
				category: "environment",
				status: "warn",
				message: "drvfs (slow)",
				hint: "Move to WSL",
			}),
			makeCheck({
				name: "TMPDIR location",
				category: "environment",
				status: "pass",
				message: "unset (using container /tmp)",
			}),
			makeCheck({
				name: "Cache directories on volumes",
				category: "environment",
				status: "pass",
				message: "all volume-backed",
			}),
			makeCheck({
				name: "Container memory",
				category: "environment",
				status: "info",
				message: "6.0GB",
			}),
		]);
		const output = formatText(report, false);
		expect(output).toContain("4 passed");
		expect(output).toContain("1 warning");
		expect(output).not.toContain("failed");
	});

	test("renders section headers for auth and environment categories", () => {
		const report = makeReport([
			makeCheck({
				name: "GitHub CLI authenticated",
				category: "auth",
				status: "pass",
				message: "user: test",
			}),
			makeCheck({
				name: "Git user configured",
				category: "auth",
				status: "pass",
				message: "Test <test@test.com>",
			}),
			makeCheck({
				name: "Workspace filesystem",
				category: "environment",
				status: "pass",
				message: "ext4 (fast)",
			}),
			makeCheck({
				name: "TMPDIR location",
				category: "environment",
				status: "pass",
				message: "unset (using container /tmp)",
			}),
		]);
		const output = formatText(report, false);
		expect(output).toContain("Authentication:");
		expect(output).toContain("Environment:");
	});

	test("renders Volumes category when volume checks present", () => {
		const report = makeReport([
			makeCheck({
				name: "Volume candidate: project/node_modules",
				category: "volumes",
				status: "warn",
				message: "node_modules on drvfs (slow bind mount)",
				hint: "Add as Docker volume for faster I/O",
			}),
		]);
		const output = formatText(report, false);
		expect(output).toContain("Volumes:");
	});

	test("hides WSL category when no WSL checks present", () => {
		const report = makeReport([
			makeCheck({
				name: "GitHub CLI authenticated",
				category: "auth",
				status: "pass",
				message: "user: test",
			}),
			makeCheck({
				name: "Workspace filesystem",
				category: "environment",
				status: "pass",
				message: "ext4 (fast)",
			}),
		]);
		const output = formatText(report, false);
		expect(output).not.toContain("WSL:");
	});

	test("renders WSL category when WSL checks present", () => {
		const report = makeReport([
			makeCheck({
				name: "WSL memory configuration",
				category: "wsl",
				status: "info",
				message: "32GB host RAM detected",
				hint: "Optimize WSL with a .wslconfig file",
			}),
		]);
		const output = formatText(report, false);
		expect(output).toContain("WSL:");
	});

	test("renders hints for warnings", () => {
		const report = makeReport([
			makeCheck({
				name: "GitHub CLI authenticated",
				category: "auth",
				status: "warn",
				message: "not authenticated",
				hint: "Run: gh auth login",
			}),
		]);
		const output = formatText(report, false);
		expect(output).toContain("Run: gh auth login");
	});

	test("includes title", () => {
		const report = makeReport([]);
		const output = formatText(report, false);
		expect(output).toContain("CodeForge Doctor");
	});
});

// ---------------------------------------------------------------------------
// 2. Format tests — formatJson
// ---------------------------------------------------------------------------

describe("formatJson", () => {
	test("returns valid JSON with checks and summary", () => {
		const report = makeReport([
			makeCheck({
				name: "GitHub CLI authenticated",
				category: "auth",
				status: "pass",
				message: "user: test",
			}),
			makeCheck({
				name: "Workspace filesystem",
				category: "environment",
				status: "warn",
				message: "drvfs",
				hint: "Move to WSL",
			}),
		]);
		const parsed = JSON.parse(formatJson(report));
		expect(parsed.checks).toHaveLength(2);
		expect(parsed.summary.passed).toBe(1);
		expect(parsed.summary.warnings).toBe(1);
		expect(parsed.summary.failed).toBe(0);
	});

	test("preserves hints in JSON output", () => {
		const report = makeReport([
			makeCheck({
				status: "warn",
				message: "msg",
				hint: "do this",
			}),
		]);
		const parsed = JSON.parse(formatJson(report));
		expect(parsed.checks[0].hint).toBe("do this");
	});

	test("strips fix field from JSON output", () => {
		const report = makeReport([
			makeCheck({
				name: "TMPDIR location",
				category: "environment",
				status: "warn",
				message: "not ideal",
				hint: "Move it",
				fix: makeFix(),
			}),
		]);
		const parsed = JSON.parse(formatJson(report));
		expect(parsed.checks[0].fix).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// 3. Type/structure tests
// ---------------------------------------------------------------------------

describe("type/structure", () => {
	test("CheckResult with fix action has correct shape", () => {
		const fix = makeFix({
			label: "Move TMPDIR",
			detail: "Moves TMPDIR to /tmp",
			impact: "1 env var change",
			requiresRebuild: false,
		});
		const check = makeCheck({
			name: "TMPDIR location",
			category: "environment",
			status: "warn",
			message: "on slow fs",
			hint: "Move to /tmp",
			fix,
		});

		expect(check.fix).toBeDefined();
		expect(check.fix!.label).toBe("Move TMPDIR");
		expect(check.fix!.detail).toBe("Moves TMPDIR to /tmp");
		expect(check.fix!.impact).toBe("1 env var change");
		expect(check.fix!.requiresRebuild).toBe(false);
		expect(typeof check.fix!.apply).toBe("function");
	});

	test("DoctorReport computes passed/failed/warnings correctly", () => {
		const report = makeReport([
			makeCheck({ status: "pass" }),
			makeCheck({ status: "pass" }),
			makeCheck({ status: "fail" }),
			makeCheck({ status: "warn" }),
			makeCheck({ status: "warn" }),
			makeCheck({ status: "info" }),
		]);
		expect(report.passed).toBe(2);
		expect(report.failed).toBe(1);
		expect(report.warnings).toBe(2);
	});

	test("info status does not count as passed, failed, or warning", () => {
		const report = makeReport([
			makeCheck({ status: "info" }),
			makeCheck({ status: "info" }),
		]);
		expect(report.passed).toBe(0);
		expect(report.failed).toBe(0);
		expect(report.warnings).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// 4. Volume detection tests (checks/volumes.ts)
// ---------------------------------------------------------------------------

describe("checkVolumeCandidates", () => {
	// These tests import checkVolumeCandidates which shells out to find/stat/mountpoint.
	// We test at a higher level by mocking the spawn utility.

	test("returns pass when no candidates found (find returns empty)", async () => {
		// Mock the module-level spawn so find returns nothing
		const volumesMod = await import("../src/commands/doctor/checks/volumes.js");

		// Mock the util module's spawn to simulate find returning empty
		const utilMod = await import("../src/commands/doctor/util.js");
		const originalSpawn = utilMod.spawn;

		// We can't easily mock the spawn inside volumes.ts since it's already
		// imported, so instead we call checkVolumeCandidates with a path that
		// won't have any matching directories.
		const results = await volumesMod.checkVolumeCandidates(
			"/nonexistent-test-path-that-will-not-exist",
		);

		// When find fails or returns empty, should return a single pass result
		expect(results.length).toBe(1);
		expect(results[0].status).toBe("pass");
		expect(results[0].category).toBe("volumes");
		expect(results[0].message).toContain("no slow bind-mounted");
	});
});

// ---------------------------------------------------------------------------
// 5. WSL checks tests (checks/wsl.ts)
// ---------------------------------------------------------------------------

describe("checkWslConfig", () => {
	const { checkWslConfig } = require("../src/commands/doctor/checks/wsl.js");

	test("returns null when isWsl is false", async () => {
		const result = await checkWslConfig(false);
		expect(result).toBeNull();
	});

	test("returns CheckResult with correct category when isWsl is true", async () => {
		const result = await checkWslConfig(true);
		// When isWsl is true, it always returns a CheckResult (never null)
		expect(result).not.toBeNull();
		expect(result!.category).toBe("wsl");
		expect(result!.name).toBe("WSL memory configuration");
	});

	test("returns CheckResult with RAM tier info when isWsl is true", async () => {
		const result = await checkWslConfig(true);
		expect(result).not.toBeNull();
		// Message should reference host RAM (either detected amount or info about detection)
		expect(result!.message).toMatch(/RAM|meminfo/i);
	});

	test("includes fix action with .wslconfig generation", async () => {
		const result = await checkWslConfig(true);
		expect(result).not.toBeNull();
		expect(result!.fix).toBeDefined();
		expect(result!.fix!.label).toContain(".wslconfig");

		// Apply should return advisory (cannot auto-apply from container)
		const fixResult = await result!.fix!.apply();
		expect(fixResult.applied).toBe(false);
		expect(fixResult.advisory).toBeDefined();
		expect(fixResult.advisory).toContain(".wslconfig");
	});
});

describe("checkDefenderExclusions", () => {
	const {
		checkDefenderExclusions,
	} = require("../src/commands/doctor/checks/wsl.js");

	test("returns null when isWsl is false", async () => {
		const result = await checkDefenderExclusions(false);
		expect(result).toBeNull();
	});

	test("returns CheckResult with correct category when isWsl is true", async () => {
		const result = await checkDefenderExclusions(true);
		expect(result).not.toBeNull();
		expect(result!.category).toBe("wsl");
		expect(result!.name).toBe("Windows Defender exclusions");
	});

	test("returns CheckResult with PowerShell commands when isWsl is true", async () => {
		const result = await checkDefenderExclusions(true);
		expect(result).not.toBeNull();
		expect(result!.fix).toBeDefined();

		const fixResult = await result!.fix!.apply();
		expect(fixResult.applied).toBe(false);
		expect(fixResult.advisory).toBeDefined();
		expect(fixResult.advisory).toContain("PowerShell");
		expect(fixResult.advisory).toContain("Add-MpPreference");
	});
});

// ---------------------------------------------------------------------------
// 6. Fix mode tests (fix.ts)
// ---------------------------------------------------------------------------

describe("runFixMode", () => {
	let logSpy: ReturnType<typeof spyOn>;
	let errorSpy: ReturnType<typeof spyOn>;
	let exitSpy: ReturnType<typeof spyOn>;
	let originalIsTTY: boolean | undefined;

	beforeEach(() => {
		logSpy = spyOn(console, "log").mockImplementation(() => {});
		errorSpy = spyOn(console, "error").mockImplementation(() => {});
		exitSpy = spyOn(process, "exit").mockImplementation((() => {
			throw new Error("process.exit called");
		}) as any);
		originalIsTTY = process.stdout.isTTY;
	});

	afterEach(() => {
		logSpy.mockRestore();
		errorSpy.mockRestore();
		exitSpy.mockRestore();
		Object.defineProperty(process.stdout, "isTTY", {
			value: originalIsTTY,
			writable: true,
			configurable: true,
		});
	});

	test("reports 'No fixable issues found' when no fixes exist", async () => {
		const checks: CheckResult[] = [
			makeCheck({ status: "pass" }),
			makeCheck({ status: "warn" }),
			// Neither has a fix property
		];

		await runFixMode(checks, { yes: false, dryRun: false });
		// @clack/prompts log.info is used internally; the function should return
		// without error. We verify it didn't call process.exit.
		expect(exitSpy).not.toHaveBeenCalled();
	});

	test("exits with error in non-TTY without --yes", async () => {
		Object.defineProperty(process.stdout, "isTTY", {
			value: false,
			writable: true,
			configurable: true,
		});

		const checks: CheckResult[] = [
			makeCheck({
				status: "warn",
				fix: makeFix(),
			}),
		];

		expect(runFixMode(checks, { yes: false, dryRun: false })).rejects.toThrow();
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	test("dry run mode lists fixes without applying", async () => {
		// dry-run still goes through the TTY guard when yes=false,
		// so simulate an interactive terminal
		Object.defineProperty(process.stdout, "isTTY", {
			value: true,
			writable: true,
			configurable: true,
		});

		const applyFn = mock(() =>
			Promise.resolve({ applied: true, message: "Applied" }),
		);

		const checks: CheckResult[] = [
			makeCheck({
				status: "warn",
				fix: makeFix({
					label: "Fix the thing",
					impact: "minor",
					apply: applyFn,
				}),
			}),
		];

		await runFixMode(checks, { yes: false, dryRun: true });

		// apply should NOT have been called
		expect(applyFn).not.toHaveBeenCalled();
		// Should not exit with error
		expect(exitSpy).not.toHaveBeenCalled();
	});

	test("auto-apply mode (--yes) applies all fixes", async () => {
		const applyFn1 = mock(() =>
			Promise.resolve({ applied: true, message: "Fixed A" }),
		);
		const applyFn2 = mock(() =>
			Promise.resolve({ applied: true, message: "Fixed B" }),
		);

		const checks: CheckResult[] = [
			makeCheck({
				name: "Check A",
				category: "environment",
				status: "warn",
				fix: makeFix({ apply: applyFn1 }),
			}),
			makeCheck({
				name: "Check B",
				category: "auth",
				status: "warn",
				fix: makeFix({ apply: applyFn2 }),
			}),
			// This one has no fix — should be skipped
			makeCheck({ name: "Check C", status: "pass" }),
		];

		await runFixMode(checks, { yes: true, dryRun: false });

		expect(applyFn1).toHaveBeenCalledTimes(1);
		expect(applyFn2).toHaveBeenCalledTimes(1);
	});

	test("category filter (--only) limits which fixes run", async () => {
		const authApply = mock(() =>
			Promise.resolve({ applied: true, message: "Fixed auth" }),
		);
		const envApply = mock(() =>
			Promise.resolve({ applied: true, message: "Fixed env" }),
		);

		const checks: CheckResult[] = [
			makeCheck({
				name: "Auth check",
				category: "auth",
				status: "warn",
				fix: makeFix({ apply: authApply }),
			}),
			makeCheck({
				name: "Env check",
				category: "environment",
				status: "warn",
				fix: makeFix({ apply: envApply }),
			}),
		];

		await runFixMode(checks, { yes: true, dryRun: false, only: "auth" });

		expect(authApply).toHaveBeenCalledTimes(1);
		expect(envApply).not.toHaveBeenCalled();
	});

	test("category filter accepts 'env' alias for 'environment'", async () => {
		const envApply = mock(() =>
			Promise.resolve({ applied: true, message: "Fixed env" }),
		);
		const authApply = mock(() =>
			Promise.resolve({ applied: true, message: "Fixed auth" }),
		);

		const checks: CheckResult[] = [
			makeCheck({
				name: "Env check",
				category: "environment",
				status: "warn",
				fix: makeFix({ apply: envApply }),
			}),
			makeCheck({
				name: "Auth check",
				category: "auth",
				status: "warn",
				fix: makeFix({ apply: authApply }),
			}),
		];

		await runFixMode(checks, { yes: true, dryRun: false, only: "env" });

		expect(envApply).toHaveBeenCalledTimes(1);
		expect(authApply).not.toHaveBeenCalled();
	});

	test("unknown --only category exits with error", async () => {
		const checks: CheckResult[] = [
			makeCheck({
				status: "warn",
				fix: makeFix(),
			}),
		];

		expect(
			runFixMode(checks, {
				yes: true,
				dryRun: false,
				only: "bogus",
			}),
		).rejects.toThrow();
		expect(exitSpy).toHaveBeenCalledWith(1);
	});
});
