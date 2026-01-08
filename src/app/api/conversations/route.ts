import { NextResponse } from 'next/server';
import { initDb, getConversations, createConversation } from '@/lib/db';

// GET /api/conversations - List all conversations
export async function GET() {
  try {
    await initDb();
    const conversations = await getConversations();
    return NextResponse.json(conversations);
  } catch (error) {
    console.error('Failed to get conversations:', error);
    return NextResponse.json(
      { error: 'Failed to get conversations' },
      { status: 500 }
    );
  }
}

// POST /api/conversations - Create a new conversation
export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json();
    const title = body.title || 'New conversation';
    const conversation = await createConversation(title);
    return NextResponse.json(conversation);
  } catch (error) {
    console.error('Failed to create conversation:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
