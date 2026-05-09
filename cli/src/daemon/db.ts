import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";
import { dirname } from "path";

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  cwd TEXT NOT NULL,
  session_id TEXT,
  objective TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paused INTEGER NOT NULL DEFAULT 0,
  loop_count INTEGER NOT NULL DEFAULT 0,
  max_loops INTEGER NOT NULL DEFAULT 30,
  failed_validation_count INTEGER NOT NULL DEFAULT 0,
  repeated_instruction_count INTEGER NOT NULL DEFAULT 0,
  state_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goal_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id TEXT,
  session_id TEXT,
  cwd TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goal_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  decision TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT NOT NULL,
  next_instruction TEXT,
  confidence REAL,
  evidence_json TEXT NOT NULL,
  model_info_json TEXT
);

CREATE TABLE IF NOT EXISTS turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id TEXT,
  session_id TEXT,
  cwd TEXT NOT NULL,
  turn_index INTEGER,
  created_at TEXT NOT NULL,
  user_prompt TEXT,
  assistant_last_message TEXT,
  status TEXT,
  summary_json TEXT
);

CREATE TABLE IF NOT EXISTS tool_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id TEXT,
  session_id TEXT,
  cwd TEXT NOT NULL,
  created_at TEXT NOT NULL,
  tool_name TEXT,
  status TEXT,
  input_json TEXT,
  output_excerpt TEXT,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS compactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id TEXT,
  session_id TEXT,
  cwd TEXT NOT NULL,
  created_at TEXT NOT NULL,
  phase TEXT NOT NULL,
  trigger TEXT,
  compact_summary TEXT,
  handoff_path TEXT,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS context_grades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id TEXT,
  session_id TEXT,
  cwd TEXT NOT NULL,
  created_at TEXT NOT NULL,
  score REAL,
  grade_json TEXT NOT NULL,
  model_info_json TEXT
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  goal_id TEXT,
  session_id TEXT,
  cwd TEXT NOT NULL,
  command TEXT NOT NULL,
  purpose TEXT,
  status TEXT NOT NULL,
  exit_code INTEGER,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  stdout_path TEXT,
  stderr_path TEXT,
  summary_path TEXT,
  result_json TEXT,
  model_info_json TEXT
);

CREATE TABLE IF NOT EXISTS model_failures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  task TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  status TEXT NOT NULL,
  duration_ms INTEGER,
  error_class TEXT,
  error_message TEXT,
  fallback_used TEXT,
  payload_json TEXT
);
`;

export function openGoalDatabase(dbPath: string): Database {
	mkdirSync(dirname(dbPath), { recursive: true });
	const db = new Database(dbPath, { create: true });
	db.exec("PRAGMA journal_mode = WAL;");
	db.exec("PRAGMA foreign_keys = ON;");
	db.exec(CREATE_TABLES_SQL);
	return db;
}

export function closeGoalDatabase(db: Database): void {
	db.close();
}
