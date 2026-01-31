import { NextResponse } from 'next/server';
import { initDb, getDb } from '@/lib/db';

/**
 * PATCH /api/conversations/[id]/messages/[messageId]/stats
 *
 * Persists resolved stats to the database when they become available.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const { id: conversationId, messageId } = await params;
  const { stats } = await request.json();

  await initDb();
  const client = getDb();

  // Fetch current metadata
  const result = await client.execute({
    sql: `SELECT metadata FROM messages WHERE id = ? AND conversation_id = ?`,
    args: [messageId, conversationId],
  });

  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  // Parse and merge metadata
  const currentMetadata = result.rows[0].metadata
    ? JSON.parse(result.rows[0].metadata as string)
    : {};

  const updatedMetadata = {
    ...currentMetadata,
    stats: { ...currentMetadata.stats, ...stats },
  };

  // Update database
  await client.execute({
    sql: `UPDATE messages SET metadata = ? WHERE id = ? AND conversation_id = ?`,
    args: [JSON.stringify(updatedMetadata), messageId, conversationId],
  });

  return NextResponse.json({ success: true });
}
