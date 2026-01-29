'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Message } from '@/hooks/useTsugiChat';

export interface Conversation {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  mode: 'task' | 'codify-skill';
}

export interface GroupedConversations {
  today: Conversation[];
  yesterday: Conversation[];
  lastWeek: Conversation[];
  lastMonth: Conversation[];
  older: Conversation[];
}

/**
 * Hook for conversation CRUD operations.
 *
 * With route-based conversation isolation, this hook no longer tracks
 * current conversation ID or handles switching - that's handled by
 * Next.js routing. This hook is now purely for CRUD operations.
 */
export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      const response = await fetch('/api/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load conversations on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const createConversation = useCallback(async (title: string = 'New conversation', mode: 'task' | 'codify-skill' = 'task'): Promise<Conversation> => {
    const response = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, mode }),
    });

    if (!response.ok) {
      throw new Error('Failed to create conversation');
    }

    const conversation = await response.json();
    setConversations((prev) => [conversation, ...prev]);
    return conversation;
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete conversation');
      }

      setConversations((prev) => prev.filter((c) => c.id !== id));
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  }, []);

  const renameConversation = useCallback(async (id: string, title: string) => {
    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        throw new Error('Failed to rename conversation');
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, title, updated_at: Date.now() } : c
        )
      );
    } catch (error) {
      console.error('Failed to rename conversation:', error);
    }
  }, []);

  const updateMode = useCallback(async (id: string, mode: 'task' | 'codify-skill') => {
    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });

      if (!response.ok) {
        throw new Error('Failed to update conversation mode');
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, mode, updated_at: Date.now() } : c
        )
      );
    } catch (error) {
      console.error('Failed to update conversation mode:', error);
    }
  }, []);

  const saveMessage = useCallback(async (conversationId: string, message: Message, sequenceOrder: number) => {
    try {
      // AI SDK uses createdAt instead of timestamp - cast to access it
      const messageWithDate = message as unknown as { createdAt?: Date };
      const createdAt = messageWithDate.createdAt instanceof Date
        ? messageWithDate.createdAt.toISOString()
        : new Date().toISOString();

      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            ...message,
            createdAt,
          },
          sequenceOrder,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save message');
      }

      // Update conversation's position in list (move to top)
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === conversationId);
        if (idx > 0) {
          const updated = [...prev];
          const [conv] = updated.splice(idx, 1);
          conv.updated_at = Date.now();
          updated.unshift(conv);
          return updated;
        }
        return prev;
      });
    } catch (error) {
      console.error('Failed to save message:', error);
    }
  }, []);

  // Group conversations by date
  const groupedConversations = useMemo((): GroupedConversations => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const lastWeek = today - 7 * 86400000;
    const lastMonth = today - 30 * 86400000;

    const groups: GroupedConversations = {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    };

    for (const conv of conversations) {
      if (conv.updated_at >= today) {
        groups.today.push(conv);
      } else if (conv.updated_at >= yesterday) {
        groups.yesterday.push(conv);
      } else if (conv.updated_at >= lastWeek) {
        groups.lastWeek.push(conv);
      } else if (conv.updated_at >= lastMonth) {
        groups.lastMonth.push(conv);
      } else {
        groups.older.push(conv);
      }
    }

    return groups;
  }, [conversations]);

  return {
    conversations,
    groupedConversations,
    isLoading,
    createConversation,
    deleteConversation,
    renameConversation,
    updateMode,
    saveMessage,
    refreshConversations: fetchConversations,
  };
}
