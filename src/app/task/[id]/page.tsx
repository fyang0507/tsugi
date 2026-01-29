import { redirect } from 'next/navigation';
import { initDb, getConversation } from '@/lib/db';
import ChatContent from './ChatContent';
import type { Message } from '@/hooks/useTsugiChat';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ConversationPage({ params }: PageProps) {
  const { id } = await params;

  // Initialize database and fetch conversation
  await initDb();
  const data = await getConversation(id);

  // If conversation doesn't exist, redirect to /task
  if (!data) {
    redirect('/task');
  }

  const { conversation, messages } = data;

  // Transform messages to ensure Date objects are serialized correctly for client
  const serializedMessages = messages.map((m) => ({
    ...m,
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
  })) as unknown as Message[];

  return (
    <ChatContent
      key={id}
      conversationId={id}
      initialMessages={serializedMessages}
      initialMode={conversation.mode}
    />
  );
}
