import { createClient, Client } from '@libsql/client';
import type { Message } from '@/hooks/useForgeChat';

let db: Client | null = null;

export function getDb(): Client {
  if (!db) {
    db = createClient({
      url: process.env.TURSO_DATABASE_URL || 'file:./data/skillforge.db',
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return db;
}

// Types for DB operations
export interface DbMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;      // User: plain text. Assistant: JSON AgentIteration[]
  metadata: string | null;  // JSON: { stats?: MessageStats }
  timestamp: number;
  sequence_order: number;
  agent: 'task' | 'skill';  // Which agent generated this message
}

export interface Conversation {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  mode: 'task' | 'codify-skill';
}

// Initialize database schema
export async function initDb(): Promise<void> {
  const client = getDb();

  // MIGRATION v2: Drop old tables to add agent column (remove after deploy)
  await client.execute(`DROP TABLE IF EXISTS messages`);
  await client.execute(`DROP TABLE IF EXISTS conversations`);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      mode TEXT DEFAULT 'task'
    )
  `);

  // Migration: add mode column to existing tables
  try {
    await client.execute(`ALTER TABLE conversations ADD COLUMN mode TEXT DEFAULT 'task'`);
  } catch {
    // Column already exists, ignore
  }

  await client.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      timestamp INTEGER NOT NULL,
      sequence_order INTEGER NOT NULL,
      agent TEXT NOT NULL DEFAULT 'task'
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
}

// Generate a unique ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// Create a new conversation
export async function createConversation(title: string, mode: 'task' | 'codify-skill' = 'task'): Promise<Conversation> {
  const client = getDb();
  const id = generateId();
  const now = Date.now();

  await client.execute({
    sql: `INSERT INTO conversations (id, title, created_at, updated_at, mode) VALUES (?, ?, ?, ?, ?)`,
    args: [id, title, now, now, mode],
  });

  return { id, title, created_at: now, updated_at: now, mode };
}

// Get all conversations
export async function getConversations(): Promise<Conversation[]> {
  const client = getDb();
  const result = await client.execute(`
    SELECT id, title, created_at, updated_at, mode
    FROM conversations
    ORDER BY updated_at DESC
  `);

  return result.rows.map((row) => ({
    id: row.id as string,
    title: row.title as string,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
    mode: (row.mode as 'task' | 'codify-skill') || 'task',
  }));
}

// Get a single conversation with its messages
export async function getConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] } | null> {
  const client = getDb();

  const convResult = await client.execute({
    sql: `SELECT id, title, created_at, updated_at, mode FROM conversations WHERE id = ?`,
    args: [id],
  });

  if (convResult.rows.length === 0) {
    return null;
  }

  const row = convResult.rows[0];
  const conversation: Conversation = {
    id: row.id as string,
    title: row.title as string,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
    mode: (row.mode as 'task' | 'codify-skill') || 'task',
  };

  const msgResult = await client.execute({
    sql: `SELECT id, conversation_id, role, content, metadata, timestamp, sequence_order, agent
          FROM messages
          WHERE conversation_id = ?
          ORDER BY sequence_order ASC`,
    args: [id],
  });

  const messages = msgResult.rows.map((r) => hydrateMessage({
    id: r.id as string,
    conversation_id: r.conversation_id as string,
    role: r.role as 'user' | 'assistant',
    content: r.content as string,
    metadata: r.metadata as string | null,
    timestamp: r.timestamp as number,
    sequence_order: r.sequence_order as number,
    agent: (r.agent as 'task' | 'skill') || 'task',
  }));

  return { conversation, messages };
}

// Update a conversation
export async function updateConversation(id: string, data: { title?: string; mode?: 'task' | 'codify-skill' }): Promise<void> {
  const client = getDb();
  const now = Date.now();

  if (data.title !== undefined) {
    await client.execute({
      sql: `UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?`,
      args: [data.title, now, id],
    });
  }

  if (data.mode !== undefined) {
    await client.execute({
      sql: `UPDATE conversations SET mode = ?, updated_at = ? WHERE id = ?`,
      args: [data.mode, now, id],
    });
  }
}

// Delete a conversation (messages deleted via CASCADE)
export async function deleteConversation(id: string): Promise<void> {
  const client = getDb();

  // Delete messages first (CASCADE may not work in all SQLite versions)
  await client.execute({
    sql: `DELETE FROM messages WHERE conversation_id = ?`,
    args: [id],
  });

  await client.execute({
    sql: `DELETE FROM conversations WHERE id = ?`,
    args: [id],
  });
}

// Save a single message
export async function saveMessage(
  conversationId: string,
  message: Message,
  sequenceOrder: number
): Promise<void> {
  const client = getDb();

  // Content format differs by role
  // Assistant messages store both iterations and parts to preserve full fidelity
  const content = message.role === 'user'
    ? message.rawContent
    : JSON.stringify({ iterations: message.iterations || [], parts: message.parts || [] });

  const metadata = message.stats ? JSON.stringify({ stats: message.stats }) : null;

  await client.execute({
    sql: `INSERT OR REPLACE INTO messages (id, conversation_id, role, content, metadata, timestamp, sequence_order, agent)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      message.id,
      conversationId,
      message.role,
      content,
      metadata,
      message.timestamp.getTime(),
      sequenceOrder,
      message.agent || 'task',
    ],
  });

  // Update conversation's updated_at timestamp
  await client.execute({
    sql: `UPDATE conversations SET updated_at = ? WHERE id = ?`,
    args: [Date.now(), conversationId],
  });
}

// Hydrate a DB row back to a Message
export function hydrateMessage(row: DbMessage): Message {
  const isAssistant = row.role === 'assistant';
  const metadata = row.metadata ? JSON.parse(row.metadata) : {};

  if (!isAssistant) {
    return {
      id: row.id,
      role: row.role,
      rawContent: row.content,
      iterations: undefined,
      parts: [{ type: 'text', content: row.content }],
      timestamp: new Date(row.timestamp),
      stats: metadata.stats,
      agent: row.agent,
    };
  }

  const { iterations, parts } = JSON.parse(row.content);

  return {
    id: row.id,
    role: row.role,
    rawContent: '',
    iterations,
    parts,
    timestamp: new Date(row.timestamp),
    stats: metadata.stats,
    agent: row.agent,
  };
}
