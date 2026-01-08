import { NextResponse } from 'next/server';
import { initDb, getConversation, updateConversation, deleteConversation } from '@/lib/db';

// GET /api/conversations/[id] - Get a conversation with messages
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDb();
    const { id } = await params;
    const result = await getConversation(id);

    if (!result) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to get conversation:', error);
    return NextResponse.json(
      { error: 'Failed to get conversation' },
      { status: 500 }
    );
  }
}

// PATCH /api/conversations/[id] - Update a conversation (e.g., rename)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDb();
    const { id } = await params;
    const body = await request.json();

    await updateConversation(id, { title: body.title });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update conversation:', error);
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    );
  }
}

// DELETE /api/conversations/[id] - Delete a conversation
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDb();
    const { id } = await params;

    await deleteConversation(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete conversation:', error);
    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    );
  }
}
