import { NextResponse } from 'next/server';
import { initDb, getDb } from '@/lib/db';
import { fetchTraceStats } from '@/lib/braintrust-api';

/**
 * GET /api/stats/[rootSpanId]?conversationId=xxx
 *
 * Polling endpoint for fetching token stats with eventual consistency.
 * Validates that the rootSpanId belongs to a message in the specified conversation.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ rootSpanId: string }> }
) {
  const { rootSpanId } = await params;
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversationId');

  // Security: Require conversationId to validate ownership
  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
  }

  // Validate rootSpanId belongs to a message in this conversation
  await initDb();
  const client = getDb();
  const result = await client.execute({
    sql: `SELECT id FROM messages
          WHERE conversation_id = ?
          AND metadata LIKE ?
          LIMIT 1`,
    args: [conversationId, `%"rootSpanId":"${rootSpanId}"%`],
  });

  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Fetch stats from Braintrust
  const stats = await fetchTraceStats(rootSpanId);

  return NextResponse.json({
    status: stats ? 'resolved' : 'pending',
    stats: stats ? {
      promptTokens: stats.promptTokens,
      completionTokens: stats.completionTokens,
      cachedTokens: stats.cachedTokens,
      reasoningTokens: stats.reasoningTokens,
    } : null,
  });
}
