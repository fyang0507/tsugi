import { createClient, Client } from '@libsql/client';

let db: Client | null = null;

/**
 * Get the database client instance (singleton)
 */
export function getDb(): Client {
  if (!db) {
    db = createClient({
      url: process.env.TURSO_DATABASE_URL || 'file:./data/tsugi.db',
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return db;
}

/**
 * Generate a unique ID for database records
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

/**
 * Initialize database schema - creates all required tables
 */
export async function initDb(): Promise<void> {
  const client = getDb();

  await client.execute(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      mode TEXT DEFAULT 'task'
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      timestamp INTEGER NOT NULL,
      sequence_order INTEGER NOT NULL,
      agent TEXT NOT NULL DEFAULT 'task',
      raw_payload TEXT
    )
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON messages(conversation_id, sequence_order)
  `);

  // Skills tables for cloud storage
  await client.execute(`
    CREATE TABLE IF NOT EXISTS skills (
      name TEXT PRIMARY KEY,
      description TEXT,
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS skill_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_name TEXT NOT NULL,
      filename TEXT NOT NULL,
      blob_url TEXT NOT NULL,
      FOREIGN KEY (skill_name) REFERENCES skills(name) ON DELETE CASCADE,
      UNIQUE(skill_name, filename)
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS pinned_comparisons (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      left_conversation_id TEXT NOT NULL,
      right_conversation_id TEXT NOT NULL,
      left_title TEXT NOT NULL,
      right_title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(left_conversation_id, right_conversation_id)
    )
  `);
}
