import { NextResponse } from 'next/server';
import { initDb, saveMessage } from '@/lib/db';
import type { Message } from '@/hooks/useForgeChat';

// POST /api/conversations/[id]/messages - Save a message
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDb();
    const { id } = await params;
    const body = await request.json();

    const message: Message = {
      ...body.message,
      timestamp: new Date(body.message.timestamp),
    };

    await saveMessage(id, message, body.sequenceOrder);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save message:', error);
    return NextResponse.json(
      { error: 'Failed to save message' },
      { status: 500 }
    );
  }
}
