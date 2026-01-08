import { createClient, Client } from '@libsql/client';
import type { Message, AgentIteration, MessageStats, MessagePart } from '@/hooks/useForgeChat';

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
}

export interface Conversation {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

// Initialize database schema
export async function initDb(): Promise<void> {
  const client = getDb();

  await client.execute(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
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
      sequence_order INTEGER NOT NULL
    )
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON messages(conversation_id, sequence_order)
  `);
}

// Generate a unique ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// Create a new conversation
export async function createConversation(title: string): Promise<Conversation> {
  const client = getDb();
  const id = generateId();
  const now = Date.now();

  await client.execute({
    sql: `INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    args: [id, title, now, now],
  });

  return { id, title, created_at: now, updated_at: now };
}

// Get all conversations
export async function getConversations(): Promise<Conversation[]> {
  const client = getDb();
  const result = await client.execute(`
    SELECT id, title, created_at, updated_at
    FROM conversations
    ORDER BY updated_at DESC
  `);

  return result.rows.map((row) => ({
    id: row.id as string,
    title: row.title as string,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  }));
}

// Get a single conversation with its messages
export async function getConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] } | null> {
  const client = getDb();

  const convResult = await client.execute({
    sql: `SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?`,
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
  };

  const msgResult = await client.execute({
    sql: `SELECT id, conversation_id, role, content, metadata, timestamp, sequence_order
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
  }));

  return { conversation, messages };
}

// Update a conversation
export async function updateConversation(id: string, data: { title?: string }): Promise<void> {
  const client = getDb();
  const now = Date.now();

  if (data.title !== undefined) {
    await client.execute({
      sql: `UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?`,
      args: [data.title, now, id],
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
  const content = message.role === 'user'
    ? message.rawContent
    : JSON.stringify(message.iterations || []);

  const metadata = message.stats ? JSON.stringify({ stats: message.stats }) : null;

  await client.execute({
    sql: `INSERT OR REPLACE INTO messages (id, conversation_id, role, content, metadata, timestamp, sequence_order)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      message.id,
      conversationId,
      message.role,
      content,
      metadata,
      message.timestamp.getTime(),
      sequenceOrder,
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
  const iterations: AgentIteration[] | undefined = isAssistant
    ? JSON.parse(row.content)
    : undefined;
  const metadata = row.metadata ? JSON.parse(row.metadata) : {};

  return {
    id: row.id,
    role: row.role,
    rawContent: isAssistant ? '' : row.content,
    iterations: iterations,
    parts: reconstructParts(row.role, isAssistant ? iterations : row.content),
    timestamp: new Date(row.timestamp),
    stats: metadata.stats,
  };
}

// Reconstruct MessagePart[] from iterations (for assistant) or content (for user)
function reconstructParts(role: string, data: AgentIteration[] | string | undefined): MessagePart[] {
  if (role === 'user') {
    return [{ type: 'text', content: data as string }];
  }

  const iterations = data as AgentIteration[] | undefined;
  if (!iterations || iterations.length === 0) {
    return [];
  }

  const parts: MessagePart[] = [];

  for (const iter of iterations) {
    // Parse rawContent to extract thinking, shell commands, and text
    let remaining = iter.rawContent;

    // Extract thinking blocks
    const thinkingMatches = remaining.match(/<thinking>([\s\S]*?)<\/thinking>/g);
    if (thinkingMatches) {
      for (const match of thinkingMatches) {
        const content = match.replace(/<\/?thinking>/g, '').trim();
        if (content) {
          parts.push({ type: 'reasoning', content });
        }
      }
      remaining = remaining.replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
    }

    // Extract shell commands and interleaved text
    const shellRegex = /<shell>([\s\S]*?)<\/shell>/g;
    let lastIndex = 0;
    let shellMatch;

    while ((shellMatch = shellRegex.exec(remaining)) !== null) {
      // Add text before this shell command
      const textBefore = remaining.slice(lastIndex, shellMatch.index).trim();
      if (textBefore) {
        parts.push({ type: 'text', content: textBefore });
      }

      // Add the tool part
      const command = shellMatch[1].trim();
      parts.push({
        type: 'tool',
        command,
        content: iter.toolOutput || '',
        toolStatus: 'completed',
      });

      lastIndex = shellMatch.index + shellMatch[0].length;
    }

    // Add remaining text after last shell command
    const remainingText = remaining.slice(lastIndex).trim();
    if (remainingText) {
      parts.push({ type: 'text', content: remainingText });
    }
  }

  return parts;
}
