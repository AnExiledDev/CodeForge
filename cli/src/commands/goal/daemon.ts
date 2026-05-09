import type { Command } from "commander";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { dirname } from "path";
import { loadDaemonConfig } from "../../daemon/config.js";

export function registerGoalDaemonCommand(parent: Command): void {
	const daemon = parent
		.command("daemon")
		.description("Start the goal daemon HTTP server")
		.option("--port <port>", "Override daemon port", Number.parseInt)
		.option("--detach", "Fork to background and write PID file")
		.option("--_foreground", "Internal: run in foreground (used by --detach)")
		.action(async (options) => {
			const config = loadDaemonConfig();

			if (options.port) {
				config.port = options.port;
			}

			if (options._foreground || !options.detach) {
				// Foreground mode: start server directly
				const { startServer } = await import("../../daemon/server.js");
				const server = await startServer(config);

				console.log(`Goal daemon running`);
				console.log(`  Port:  ${server.port}`);
				console.log(`  DB:    ${config.dbPath}`);
				console.log(`  PID:   ${process.pid}`);
				console.log(`\nPress Ctrl+C to stop.`);

				// Write PID file for status checks
				mkdirSync(dirname(config.pidPath), { recursive: true });
				writeFileSync(config.pidPath, String(process.pid));

				return;
			}

			// Detach mode: spawn a child process in foreground mode
			mkdirSync(dirname(config.logPath), { recursive: true });
			mkdirSync(dirname(config.pidPath), { recursive: true });

			const logFile = Bun.file(config.logPath);

			const args = [process.argv[0], "run", process.argv[1], "goal", "daemon", "--_foreground"];
			if (options.port) {
				args.push("--port", String(options.port));
			}

			const child = Bun.spawn(args, {
				stdout: logFile,
				stderr: logFile,
				stdin: "ignore",
			});

			if (!child.pid) {
				console.error("Failed to spawn daemon process.");
				process.exit(1);
			}

			writeFileSync(config.pidPath, String(child.pid));
			console.log(`Goal daemon started (PID ${child.pid})`);
			console.log(`  Port: ${config.port}`);
			console.log(`  Log:  ${config.logPath}`);
			console.log(`  PID:  ${config.pidPath}`);
			// Unref so parent can exit
			child.unref();
		});

	daemon
		.command("stop")
		.description("Stop the running goal daemon")
		.action(() => {
			const config = loadDaemonConfig();

			if (!existsSync(config.pidPath)) {
				console.log("No PID file found. Daemon may not be running.");
				process.exit(1);
			}

			const pidStr = readFileSync(config.pidPath, "utf-8").trim();
			const pid = Number.parseInt(pidStr, 10);

			if (Number.isNaN(pid)) {
				console.error(`Invalid PID in ${config.pidPath}: ${pidStr}`);
				unlinkSync(config.pidPath);
				process.exit(1);
			}

			try {
				process.kill(pid, "SIGTERM");
				console.log(`Sent SIGTERM to daemon (PID ${pid}).`);
			} catch (err) {
				const code = (err as NodeJS.ErrnoException).code;
				if (code === "ESRCH") {
					console.log(`Daemon process (PID ${pid}) not found. Cleaning up PID file.`);
				} else {
					console.error(`Failed to stop daemon: ${err}`);
				}
			}

			try {
				unlinkSync(config.pidPath);
			} catch {
				// PID file already gone
			}
		});
}
