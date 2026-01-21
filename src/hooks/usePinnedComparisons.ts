'use client';

import { useState, useCallback } from 'react';

export interface PinnedComparison {
  id: string;
  name: string;
  leftConversationId: string;
  rightConversationId: string;
  leftTitle: string;
  rightTitle: string;
  createdAt: number;
}

interface UsePinnedComparisonsReturn {
  pinnedComparisons: PinnedComparison[];
  pinComparison: (
    name: string,
    leftConversationId: string,
    rightConversationId: string,
    leftTitle: string,
    rightTitle: string
  ) => string;
  unpinComparison: (id: string) => void;
  renameComparison: (id: string, newName: string) => void;
  isPinned: (leftConversationId: string | null, rightConversationId: string | null) => boolean;
}

export function usePinnedComparisons(): UsePinnedComparisonsReturn {
  const [pinnedComparisons, setPinnedComparisons] = useState<PinnedComparison[]>([]);

  const pinComparison = useCallback((
    name: string,
    leftConversationId: string,
    rightConversationId: string,
    leftTitle: string,
    rightTitle: string
  ): string => {
    const id = crypto.randomUUID();
    const newComparison: PinnedComparison = {
      id,
      name,
      leftConversationId,
      rightConversationId,
      leftTitle,
      rightTitle,
      createdAt: Date.now(),
    };
    setPinnedComparisons(prev => [...prev, newComparison]);
    return id;
  }, []);

  const unpinComparison = useCallback((id: string): void => {
    setPinnedComparisons(prev => prev.filter(c => c.id !== id));
  }, []);

  const renameComparison = useCallback((id: string, newName: string): void => {
    setPinnedComparisons(prev =>
      prev.map(c => (c.id === id ? { ...c, name: newName } : c))
    );
  }, []);

  const isPinned = useCallback((leftConversationId: string | null, rightConversationId: string | null): boolean => {
    if (!leftConversationId || !rightConversationId) return false;
    return pinnedComparisons.some(
      c => c.leftConversationId === leftConversationId && c.rightConversationId === rightConversationId
    );
  }, [pinnedComparisons]);

  return {
    pinnedComparisons,
    pinComparison,
    unpinComparison,
    renameComparison,
    isPinned,
  };
}
