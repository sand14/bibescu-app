import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');

let _db: DatabaseSync | null = null;
let _schemaInitialized = false;

function initSchema(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      report_type TEXT NOT NULL,
      filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
  `);

  // Immediately flush table schemas into the primary .db file
  try {
    database.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch {
    // Ignore if locked by concurrent reader
  }
}

export function getDb(): DatabaseSync {
  if (!_db) {
    if (!fs.existsSync(/*turbopackIgnore: true*/ dataDir)) {
      fs.mkdirSync(/*turbopackIgnore: true*/ dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, 'bibescu.db');
    _db = new DatabaseSync(dbPath);
    _db.exec('PRAGMA busy_timeout = 10000;');
    _db.exec('PRAGMA journal_mode = WAL;');
    _db.exec('PRAGMA wal_autocheckpoint = 1;');
    _db.exec('PRAGMA foreign_keys = ON;');
  }

  if (!_schemaInitialized) {
    initSchema(_db);
    _schemaInitialized = true;
  }

  return _db;
}

export function checkpointDb() {
  try {
    const database = getDb();
    database.exec('PRAGMA wal_checkpoint(PASSIVE);');
  } catch {
    // Ignore checkpoint errors
  }
}

// Lazy Proxy: Ensures DB is never opened during `next build` static analysis,
// but works transparently as `db.prepare(...)`, `db.exec(...)` at runtime.
const db = new Proxy({} as DatabaseSync, {
  get(_target, prop) {
    const instance = getDb();
    const val = (instance as any)[prop];
    if (typeof val === 'function') {
      return val.bind(instance);
    }
    return val;
  },
});

export default db;
export { dataDir };
