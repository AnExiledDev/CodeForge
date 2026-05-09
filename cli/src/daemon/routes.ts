import type { Database } from "bun:sqlite";
import { statSync } from "fs";
import type { DaemonConfig, HealthResponse, StatusResponse } from "../schemas/goal.js";

let serverStartTime = Date.now();

export function setStartTime(time: number): void {
	serverStartTime = time;
}

function uptimeSeconds(): number {
	return Math.floor((Date.now() - serverStartTime) / 1000);
}

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function handleHealth(): Response {
	const body: HealthResponse = {
		status: "ok",
		version: "1.0.0",
		uptime: uptimeSeconds(),
		db: "connected",
		pid: process.pid,
	};
	return json(body);
}

function handleStatus(db: Database, config: DaemonConfig): Response {
	let dbSize = 0;
	try {
		dbSize = statSync(config.dbPath).size;
	} catch {
		// DB file may not be accessible yet
	}

	const body: StatusResponse = {
		daemon: "running",
		port: config.port,
		db: { path: config.dbPath, size: dbSize },
		activeGoal: null,
		uptime: uptimeSeconds(),
	};
	return json(body);
}

export function handleRequest(
	req: Request,
	ctx: { db: Database; config: DaemonConfig },
): Response | Promise<Response> {
	const url = new URL(req.url);
	const { pathname } = url;
	const method = req.method;

	if (method === "GET" && pathname === "/health") {
		return handleHealth();
	}

	if (method === "GET" && pathname === "/status") {
		return handleStatus(ctx.db, ctx.config);
	}

	return json({ error: "Not found" }, 404);
}
