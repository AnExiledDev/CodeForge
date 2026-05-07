import { Database } from "bun:sqlite";
import { statSync } from "fs";
import type {
	IndexedFile,
	IndexedFolder,
	IndexedSymbol,
	IndexStats,
	SearchHit,
	SymbolKind,
} from "../schemas/index.js";

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS files (
  path TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  size INTEGER,
  language TEXT,
  line_count INTEGER,
  last_indexed TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS folders (
  path TEXT PRIMARY KEY,
  description TEXT,
  file_count INTEGER DEFAULT 0,
  last_indexed TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  file_path TEXT NOT NULL,
  line_start INTEGER,
  line_end INTEGER,
  signature TEXT,
  docstring TEXT,
  parent_name TEXT,
  exported INTEGER DEFAULT 0,
  language TEXT NOT NULL,
  FOREIGN KEY (file_path) REFERENCES files(path) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_path);
CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);

CREATE VIRTUAL TABLE IF NOT EXISTS symbols_fts USING fts5(
  name, signature, docstring, file_path,
  content=symbols, content_rowid=id
);

CREATE TRIGGER IF NOT EXISTS symbols_ai AFTER INSERT ON symbols BEGIN
  INSERT INTO symbols_fts(rowid, name, signature, docstring, file_path)
  VALUES (new.id, new.name, new.signature, new.docstring, new.file_path);
END;
CREATE TRIGGER IF NOT EXISTS symbols_ad AFTER DELETE ON symbols BEGIN
  INSERT INTO symbols_fts(symbols_fts, rowid, name, signature, docstring, file_path)
  VALUES('delete', old.id, old.name, old.signature, old.docstring, old.file_path);
END;
CREATE TRIGGER IF NOT EXISTS symbols_au AFTER UPDATE ON symbols BEGIN
  INSERT INTO symbols_fts(symbols_fts, rowid, name, signature, docstring, file_path)
  VALUES('delete', old.id, old.name, old.signature, old.docstring, old.file_path);
  INSERT INTO symbols_fts(rowid, name, signature, docstring, file_path)
  VALUES (new.id, new.name, new.signature, new.docstring, new.file_path);
END;
`;

export function openDatabase(dbPath: string): Database {
	const db = new Database(dbPath, { create: true });
	db.exec("PRAGMA journal_mode = WAL;");
	db.exec("PRAGMA foreign_keys = ON;");
	db.exec(CREATE_TABLES_SQL);
	return db;
}

export function closeDatabase(db: Database): void {
	db.close();
}

export function insertFiles(db: Database, files: IndexedFile[]): void {
	const stmt = db.prepare(
		`INSERT OR REPLACE INTO files (path, hash, size, language, line_count, last_indexed)
		 VALUES (?, ?, ?, ?, ?, ?)`,
	);
	const tx = db.transaction(() => {
		for (const f of files) {
			stmt.run(f.path, f.hash, f.size, f.language, f.lineCount, f.lastIndexed);
		}
	});
	tx();
}

export function insertSymbols(
	db: Database,
	symbols: Omit<IndexedSymbol, "id">[],
): void {
	const stmt = db.prepare(
		`INSERT INTO symbols (name, kind, file_path, line_start, line_end, signature, docstring, parent_name, exported, language)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	);
	const tx = db.transaction(() => {
		for (const s of symbols) {
			stmt.run(
				s.name,
				s.kind,
				s.filePath,
				s.lineStart,
				s.lineEnd,
				s.signature,
				s.docstring,
				s.parentName,
				s.exported ? 1 : 0,
				s.language,
			);
		}
	});
	tx();
}

export function deleteFileAndSymbols(db: Database, filePath: string): void {
	db.run("DELETE FROM symbols WHERE file_path = ?", [filePath]);
	db.run("DELETE FROM files WHERE path = ?", [filePath]);
}

export function upsertFolders(db: Database, folders: IndexedFolder[]): void {
	const stmt = db.prepare(
		`INSERT OR REPLACE INTO folders (path, description, file_count, last_indexed)
		 VALUES (?, ?, ?, ?)`,
	);
	const tx = db.transaction(() => {
		for (const f of folders) {
			stmt.run(f.path, f.description, f.fileCount, f.lastIndexed);
		}
	});
	tx();
}

export function searchSymbols(
	db: Database,
	query: string,
	limit = 20,
): SearchHit[] {
	const rows = db
		.prepare(
			`SELECT s.id, s.name, s.kind, s.file_path, s.line_start, s.line_end,
			        s.signature, s.docstring, s.parent_name, s.exported, s.language,
			        fts.rank
			 FROM symbols_fts fts
			 JOIN symbols s ON s.id = fts.rowid
			 WHERE symbols_fts MATCH ?
			 ORDER BY fts.rank
			 LIMIT ?`,
		)
		// Type cast from SQLite row — schema enforced at table creation (see createTables above)
		.all(query, limit) as Array<{
		id: number;
		name: string;
		kind: string;
		file_path: string;
		line_start: number;
		line_end: number;
		signature: string | null;
		docstring: string | null;
		parent_name: string | null;
		exported: number;
		language: string;
		rank: number;
	}>;

	return rows.map((row) => ({
		symbol: {
			id: row.id,
			name: row.name,
			kind: row.kind as SymbolKind,
			filePath: row.file_path,
			lineStart: row.line_start,
			lineEnd: row.line_end,
			signature: row.signature,
			docstring: row.docstring,
			parentName: row.parent_name,
			exported: row.exported === 1,
			language: row.language,
		},
		rank: row.rank,
	}));
}

export function getFileSymbols(
	db: Database,
	filePath: string,
): IndexedSymbol[] {
	const rows = db
		.prepare(
			`SELECT id, name, kind, file_path, line_start, line_end,
			        signature, docstring, parent_name, exported, language
			 FROM symbols WHERE file_path = ?
			 ORDER BY line_start`,
		)
		.all(filePath) as Array<{
		id: number;
		name: string;
		kind: string;
		file_path: string;
		line_start: number;
		line_end: number;
		signature: string | null;
		docstring: string | null;
		parent_name: string | null;
		exported: number;
		language: string;
	}>;

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		kind: row.kind as SymbolKind,
		filePath: row.file_path,
		lineStart: row.line_start,
		lineEnd: row.line_end,
		signature: row.signature,
		docstring: row.docstring,
		parentName: row.parent_name,
		exported: row.exported === 1,
		language: row.language,
	}));
}

export function getStats(db: Database, dbPath: string): IndexStats {
	const totalFiles = (
		db.prepare("SELECT COUNT(*) as cnt FROM files").get() as { cnt: number }
	).cnt;
	const totalSymbols = (
		db.prepare("SELECT COUNT(*) as cnt FROM symbols").get() as { cnt: number }
	).cnt;
	const totalFolders = (
		db.prepare("SELECT COUNT(*) as cnt FROM folders").get() as { cnt: number }
	).cnt;

	const langRows = db
		.prepare(
			`SELECT f.language,
			        COUNT(DISTINCT f.path) as file_count,
			        COUNT(s.id) as symbol_count
			 FROM files f
			 LEFT JOIN symbols s ON s.file_path = f.path
			 GROUP BY f.language`,
		)
		.all() as Array<{
		language: string;
		file_count: number;
		symbol_count: number;
	}>;

	const byLanguage: Record<string, { files: number; symbols: number }> = {};
	for (const row of langRows) {
		byLanguage[row.language] = {
			files: row.file_count,
			symbols: row.symbol_count,
		};
	}

	const lastBuildRow = db
		.prepare("SELECT MAX(last_indexed) as last_build FROM files")
		.get() as { last_build: string | null };

	let dbSizeBytes = 0;
	try {
		dbSizeBytes = statSync(dbPath).size;
	} catch {
		// DB file may not be accessible
	}

	return {
		totalFiles,
		totalSymbols,
		totalFolders,
		byLanguage,
		lastBuildTime: lastBuildRow.last_build,
		dbSizeBytes,
	};
}

export function getAllFolders(db: Database): IndexedFolder[] {
	const rows = db
		.prepare(
			`SELECT path, description, file_count, last_indexed
			 FROM folders ORDER BY path`,
		)
		.all() as Array<{
		path: string;
		description: string | null;
		file_count: number;
		last_indexed: string;
	}>;

	return rows.map((row) => ({
		path: row.path,
		description: row.description,
		fileCount: row.file_count,
		lastIndexed: row.last_indexed,
	}));
}

export function getFileByPath(db: Database, path: string): IndexedFile | null {
	const row = db
		.prepare(
			`SELECT path, hash, size, language, line_count, last_indexed
			 FROM files WHERE path = ?`,
		)
		.get(path) as {
		path: string;
		hash: string;
		size: number;
		language: string;
		line_count: number;
		last_indexed: string;
	} | null;

	if (!row) return null;

	return {
		path: row.path,
		hash: row.hash,
		size: row.size,
		language: row.language,
		lineCount: row.line_count,
		lastIndexed: row.last_indexed,
	};
}

export function rebuildFts(db: Database): void {
	db.exec("INSERT INTO symbols_fts(symbols_fts) VALUES('rebuild')");
}
