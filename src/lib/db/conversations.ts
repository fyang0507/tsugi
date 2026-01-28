import { getDb, generateId } from './client';
import type { Message } from '@/lib/messages/transform';

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
  raw_payload: string | null;  // JSON: Raw stream parts from agent.stream() for debugging
}

export interface Conversation {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  mode: 'task' | 'codify-skill';
}

/**
 * Create a new conversation
 */
export async function createConversation(
  title: string,
  mode: 'task' | 'codify-skill' = 'task'
): Promise<Conversation> {
  const client = getDb();
  const id = generateId();
  const now = Date.now();

  await client.execute({
    sql: `INSERT INTO conversations (id, title, created_at, updated_at, mode) VALUES (?, ?, ?, ?, ?)`,
    args: [id, title, now, now, mode],
  });

  return { id, title, created_at: now, updated_at: now, mode };
}

/**
 * Get all conversations
 */
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

/**
 * Get a single conversation with its messages
 */
export async function getConversation(
  id: string
): Promise<{ conversation: Conversation; messages: Message[] } | null> {
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
    sql: `SELECT id, conversation_id, role, content, metadata, timestamp, sequence_order, agent, raw_payload
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
    raw_payload: r.raw_payload as string | null,
  }));

  return { conversation, messages };
}

/**
 * Update a conversation
 */
export async function updateConversation(
  id: string,
  data: { title?: string; mode?: 'task' | 'codify-skill' }
): Promise<void> {
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

/**
 * Delete a conversation (messages deleted via CASCADE)
 */
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

/**
 * Save a single message
 * Supports both AI SDK format (createdAt) and legacy format (timestamp)
 */
export async function saveMessage(
  conversationId: string,
  message: Message & { id: string; createdAt?: Date; timestamp?: Date },
  sequenceOrder: number
): Promise<void> {
  const client = getDb();

  // Extract text content for user messages
  let userContent = '';
  if (message.role === 'user') {
    // AI SDK format: extract from text part
    const textPart = message.parts?.find((p): p is { type: 'text'; text: string } => p.type === 'text');
    userContent = textPart?.text || message.rawContent || message.content || '';
  }

  // Content format differs by role
  // Assistant messages store parts (single source of truth)
  const content = message.role === 'user'
    ? userContent
    : JSON.stringify({ parts: message.parts || [] });

  // Get stats from either direct field or metadata
  const stats = message.stats || message.metadata?.stats;
  const metadata = stats ? JSON.stringify({ stats }) : null;

  const rawPayload = message.rawPayload ? JSON.stringify(message.rawPayload) : null;

  // Support both AI SDK (createdAt) and legacy (timestamp) formats
  const messageTime = message.createdAt || message.timestamp || new Date();
  const timestamp = messageTime instanceof Date ? messageTime.getTime() : Date.now();

  // Get agent from either direct field or metadata
  const agent = message.agent || message.metadata?.agent || 'task';

  await client.execute({
    sql: `INSERT OR REPLACE INTO messages (id, conversation_id, role, content, metadata, timestamp, sequence_order, agent, raw_payload)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      message.id,
      conversationId,
      message.role,
      content,
      metadata,
      timestamp,
      sequenceOrder,
      agent,
      rawPayload,
    ],
  });

  // Update conversation's updated_at timestamp
  await client.execute({
    sql: `UPDATE conversations SET updated_at = ? WHERE id = ?`,
    args: [Date.now(), conversationId],
  });
}

/**
 * Hydrate a DB row back to a Message (AI SDK UIMessage compatible format)
 */
export function hydrateMessage(row: DbMessage): Message {
  const isAssistant = row.role === 'assistant';
  const metadata = row.metadata ? JSON.parse(row.metadata) : {};
  const rawPayload = row.raw_payload ? JSON.parse(row.raw_payload) : undefined;

  if (!isAssistant) {
    // User message - use AI SDK text part format
    return {
      id: row.id,
      role: row.role,
      parts: [{ type: 'text', text: row.content }],
      // AI SDK uses createdAt
      createdAt: new Date(row.timestamp),
      // Store in metadata for AI SDK compatibility
      metadata: {
        stats: metadata.stats,
        agent: row.agent,
      },
      // Legacy fields for backward compatibility
      rawContent: row.content,
      timestamp: new Date(row.timestamp),
      stats: metadata.stats,
      agent: row.agent,
      rawPayload,
    };
  }

  const { parts } = JSON.parse(row.content);

  return {
    id: row.id,
    role: row.role,
    parts,
    // AI SDK uses createdAt
    createdAt: new Date(row.timestamp),
    // Store in metadata for AI SDK compatibility
    metadata: {
      stats: metadata.stats,
      agent: row.agent,
    },
    // Legacy fields for backward compatibility
    rawContent: '',
    timestamp: new Date(row.timestamp),
    stats: metadata.stats,
    agent: row.agent,
    rawPayload,
  };
}
