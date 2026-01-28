import { NextResponse } from 'next/server';
import { initDb, saveMessage, getConversation } from '@/lib/db';
import type { Message } from '@/lib/messages/transform';

// GET /api/conversations/[id]/messages - Get conversation with messages
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDb();
    const { id } = await params;

    const data = await getConversation(id);
    if (!data) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to get conversation:', error);
    return NextResponse.json(
      { error: 'Failed to get conversation' },
      { status: 500 }
    );
  }
}

// POST /api/conversations/[id]/messages - Save a message
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDb();
    const { id } = await params;
    const body = await request.json();

    // Support both AI SDK format (createdAt) and legacy format (timestamp)
    const message: Message & { id: string; createdAt?: Date; timestamp?: Date } = {
      ...body.message,
      // AI SDK uses createdAt
      createdAt: body.message.createdAt ? new Date(body.message.createdAt) : undefined,
      // Legacy format uses timestamp
      timestamp: body.message.timestamp ? new Date(body.message.timestamp) : undefined,
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
