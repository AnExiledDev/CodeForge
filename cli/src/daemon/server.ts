import { mkdirSync } from "fs";
import { dirname } from "path";
import type { Server } from "bun";
import type { DaemonConfig } from "../schemas/goal.js";
import { closeGoalDatabase, openGoalDatabase } from "./db.js";
import { handleRequest, setStartTime } from "./routes.js";

function isLoopback(host: string): boolean {
	return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

export async function startServer(config: DaemonConfig): Promise<Server> {
	if (!isLoopback(config.host)) {
		throw new Error(
			`Refusing to bind to non-loopback address: ${config.host}. The daemon must listen on 127.0.0.1 or localhost.`,
		);
	}

	// Ensure directories exist for DB and logs
	mkdirSync(dirname(config.dbPath), { recursive: true });
	mkdirSync(dirname(config.logPath), { recursive: true });

	const db = openGoalDatabase(config.dbPath);
	setStartTime(Date.now());

	const server = Bun.serve({
		hostname: config.host,
		port: config.port,
		fetch(req) {
			return handleRequest(req, { db, config });
		},
	});

	function shutdown() {
		closeGoalDatabase(db);
		server.stop(true);
		// Clean up PID file if it exists
		try {
			const { unlinkSync, existsSync } = require("fs");
			if (existsSync(config.pidPath)) {
				unlinkSync(config.pidPath);
			}
		} catch {
			// Best-effort cleanup
		}
		process.exit(0);
	}

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	return server;
}
